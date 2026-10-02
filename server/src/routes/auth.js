const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const env = require('../config/env');
const { sequelize, User, GraduateProfile, InvestorProfile, Document } = require('../models');
const { badRequest, conflict, HttpError } = require('../middleware/errors');
const { upload, validateDocument } = require('../middleware/upload');
const { loginLimiter, codeLimiter, uploadLimiter } = require('../middleware/rateLimits');
const {
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  isApprovedGraduate,
  isApprovedInvestor,
} = require('../middleware/auth');
const { issueCode, verifyCode } = require('../services/otp');
const { enqueueEmail } = require('../services/mailer');
const storage = require('../services/storage');
const audit = require('../services/audit');
const { enqueueDocumentVerification } = require('../workers/jobs');

const router = express.Router();

// --- Validation ---
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(254);
const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128)
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.');
const fullName = z.string().trim().min(3, 'Enter your full name as it appears on your documents.').max(150);

const isAlumniEmail = (address) => env.alumniDomains.includes(address.split('@')[1]);

const graduateSchema = z.object({
  fullName,
  email: email.refine(isAlumniEmail, {
    message: `Use your official ALU email address (@${env.alumniDomains.join(' or @')}).`,
  }),
  password,
  cohortYear: z.coerce.number().int().min(2015, 'Enter a valid graduation year.').max(new Date().getFullYear() + 1),
  program: z.string().trim().min(2, 'Enter your degree programme.').max(150),
});

const investorSchema = z.object({
  fullName,
  email,
  password,
  investorType: z.enum(['investor', 'sponsor']).default('investor'),
  organisation: z.string().trim().min(2, 'Enter your organisation.').max(150),
  website: z
    .string()
    .trim()
    .max(255)
    .url('Enter a full website address, e.g. https://example.com')
    .optional()
    .or(z.literal('')),
  sectors: z.array(z.string().trim().max(80)).max(15).default([]),
  bio: z.string().trim().max(2000).optional().or(z.literal('')),
});

// --- Helpers ---
function serializeUser(user) {
  const graduate = user.graduateProfile;
  const investor = user.investorProfile;
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    theme: user.theme,
    emailVerified: Boolean(user.emailVerifiedAt),
    approved:
      user.role === 'graduate'
        ? isApprovedGraduate(user)
        : user.role === 'investor'
          ? isApprovedInvestor(user)
          : user.status === 'active',
    graduateProfile: graduate
      ? {
          cohortYear: graduate.cohortYear,
          program: graduate.program,
          verificationStatus: graduate.verificationStatus,
          bio: graduate.bio,
        }
      : undefined,
    investorProfile: investor
      ? {
          investorType: investor.investorType,
          organisation: investor.organisation,
          website: investor.website,
          sectors: investor.sectors || [],
          bio: investor.bio,
        }
      : undefined,
    createdAt: user.createdAt,
  };
}

async function sendVerificationCode(user) {
  const code = await issueCode(user.id, 'email_verification');
  await enqueueEmail({
    eventKey: `email-verification:${user.id}:${Date.now()}`,
    to: user.email,
    recipientId: user.id,
    subject: 'Your ALU Ventures verification code',
    paragraphs: [
      `Hello ${user.fullName},`,
      `Your verification code is ${code}. It expires in 10 minutes and can only be used once.`,
      'If you did not create an ALU Ventures account, you can ignore this email.',
    ],
  });
  return code;
}

const loadFullUser = (where) =>
  User.findOne({
    where,
    include: [
      { model: GraduateProfile, as: 'graduateProfile' },
      { model: InvestorProfile, as: 'investorProfile' },
    ],
  });

async function ensureEmailAvailable(address) {
  const existing = await User.findOne({ where: { email: address } });
  if (existing) {
    throw conflict(
      existing.status === 'pending_email'
        ? 'This email is registered but not yet verified. Sign in to receive a new verification code.'
        : 'An account with this email already exists. Sign in or reset your password.'
    );
  }
}

// --- Registration ---
// FR02: alumni-domain email + OTP + degree upload; an administrator approves.
router.post('/register/graduate', uploadLimiter, upload.single('degreeCertificate'), async (req, res) => {
  const data = graduateSchema.parse(req.body);
  await ensureEmailAvailable(data.email);
  const file = await validateDocument(req.file, 'Your ALU degree certificate');

  const storageKey = await storage.put(file.buffer, { prefix: 'degree-certificates', mimeType: file.mimeType });
  let user;
  let document;
  try {
    await sequelize.transaction(async (transaction) => {
      user = await User.create(
        {
          email: data.email,
          fullName: data.fullName,
          role: 'graduate',
          status: 'pending_email',
          passwordHash: await bcrypt.hash(data.password, 12),
        },
        { transaction }
      );
      await GraduateProfile.create(
        { userId: user.id, cohortYear: data.cohortYear, program: data.program },
        { transaction }
      );
      document = await Document.create(
        {
          uploaderId: user.id,
          projectId: null,
          kind: 'degree_certificate',
          storageKey,
          originalName: file.originalName,
          mimeType: file.mimeType,
          sizeBytes: file.size,
        },
        { transaction }
      );
      await audit.record(
        { actorId: user.id, action: 'account.registered', entityType: 'user', entityId: user.id, metadata: { role: 'graduate' } },
        { transaction }
      );
    });
  } catch (err) {
    await storage.remove(storageKey).catch(() => {});
    throw err;
  }

  enqueueDocumentVerification(document.id);
  await sendVerificationCode(user);
  res.status(201).json({ message: 'Account created. Check your email for a verification code.', email: user.email });
});

// FR03: investor or sponsor identity, organisation, website and interests for review.
router.post('/register/investor', async (req, res) => {
  const data = investorSchema.parse(req.body);
  await ensureEmailAvailable(data.email);
  let user;
  await sequelize.transaction(async (transaction) => {
    user = await User.create(
      {
        email: data.email,
        fullName: data.fullName,
        role: 'investor',
        status: 'pending_email',
        passwordHash: await bcrypt.hash(data.password, 12),
      },
      { transaction }
    );
    await InvestorProfile.create(
      {
        userId: user.id,
        investorType: data.investorType,
        organisation: data.organisation,
        website: data.website || null,
        sectors: data.sectors,
        bio: data.bio || null,
      },
      { transaction }
    );
    await audit.record(
      { actorId: user.id, action: 'account.registered', entityType: 'user', entityId: user.id, metadata: { role: 'investor' } },
      { transaction }
    );
  });
  await sendVerificationCode(user);
  res.status(201).json({ message: 'Account created. Check your email for a verification code.', email: user.email });
});

// --- Email verification ---
router.post('/verify-email', codeLimiter, async (req, res) => {
  const data = z.object({ email, code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.') }).parse(req.body);
  const user = await loadFullUser({ email: data.email });
  if (!user || user.status !== 'pending_email') {
    throw badRequest('That code is invalid or has expired. Request a new code and try again.');
  }
  await verifyCode(user.id, 'email_verification', data.code);
  // Domain and OTP checks never grant approved status by themselves (FR02).
  await user.update({ emailVerifiedAt: new Date(), status: 'pending_review' });
  await audit.record({ actorId: user.id, action: 'account.email_verified', entityType: 'user', entityId: user.id });
  setSessionCookie(res, user);
  res.json({ user: serializeUser(user) });
});

router.post('/resend-code', codeLimiter, async (req, res) => {
  const data = z.object({ email }).parse(req.body);
  const user = await User.findOne({ where: { email: data.email } });
  if (user && user.status === 'pending_email') await sendVerificationCode(user);
  // Neutral response whether or not the account exists.
  res.json({ message: 'If that account is awaiting verification, a new code has been sent.' });
});

// --- Sessions ---
router.post('/login', loginLimiter, async (req, res) => {
  const data = z.object({ email, password: z.string().min(1, 'Enter your password.').max(128) }).parse(req.body);
  const user = await loadFullUser({ email: data.email });
  const valid = user && (await bcrypt.compare(data.password, user.passwordHash));
  if (!valid) throw new HttpError(401, 'Incorrect email or password.');

  if (user.status === 'pending_email') {
    await sendVerificationCode(user);
    throw new HttpError(403, 'Please verify your email first. We have sent you a new code.', {
      code: 'EMAIL_NOT_VERIFIED',
      email: user.email,
    });
  }
  if (user.status === 'rejected') {
    throw new HttpError(403, 'Your registration was not approved. Contact the ALU Ventures administrator for details.');
  }
  if (user.status === 'suspended') throw new HttpError(403, 'This account is suspended.');

  setSessionCookie(res, user);
  await audit.record({ actorId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id });
  res.json({ user: serializeUser(user) });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ message: 'Signed out.' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

// --- Password recovery (FR12) ---
router.post('/forgot-password', codeLimiter, async (req, res) => {
  const data = z.object({ email }).parse(req.body);
  const user = await User.findOne({ where: { email: data.email } });
  if (user && !['suspended', 'rejected'].includes(user.status)) {
    const code = await issueCode(user.id, 'password_reset');
    const link = `${env.clientUrl}/reset-password?email=${encodeURIComponent(user.email)}&code=${code}`;
    await enqueueEmail({
      eventKey: `password-reset:${user.id}:${Date.now()}`,
      to: user.email,
      recipientId: user.id,
      subject: 'Reset your ALU Ventures password',
      paragraphs: [
        `Hello ${user.fullName},`,
        `Your password reset code is ${code}. It expires in 10 minutes, allows five attempts and can only be used once.`,
        'If you did not ask to reset your password, you can ignore this email — your password will not change.',
      ],
      cta: { label: 'Reset password', url: link },
    });
    await audit.record({ actorId: user.id, action: 'auth.password_reset_requested', entityType: 'user', entityId: user.id });
  }
  // Neutral, enumeration-resistant response (NFR02).
  res.json({ message: 'If an account exists for that email, we have sent a reset code. It expires in 10 minutes.' });
});

router.post('/reset-password', codeLimiter, async (req, res) => {
  const data = z
    .object({
      email,
      code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
      password,
      confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] })
    .parse(req.body);

  const user = await User.findOne({ where: { email: data.email } });
  if (!user) throw badRequest('That code is invalid or has expired. Request a new code and try again.');
  await verifyCode(user.id, 'password_reset', data.code);

  // Bumping token_version invalidates every existing session (FR12).
  await user.update({
    passwordHash: await bcrypt.hash(data.password, 12),
    tokenVersion: user.tokenVersion + 1,
  });
  await audit.record({ actorId: user.id, action: 'auth.password_changed', entityType: 'user', entityId: user.id });
  await enqueueEmail({
    eventKey: `password-changed:${user.id}:${Date.now()}`,
    to: user.email,
    recipientId: user.id,
    subject: 'Your ALU Ventures password was changed',
    paragraphs: [
      `Hello ${user.fullName},`,
      'Your password was changed successfully and you have been signed out of all other sessions.',
      'If you did not make this change, reset your password immediately and contact the administrator.',
    ],
  });
  clearSessionCookie(res);
  res.json({ message: 'Password updated. Please sign in with your new password.' });
});

module.exports = router;
module.exports.serializeUser = serializeUser;
