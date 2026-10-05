const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const { Notification, User, GraduateProfile } = require('../src/models');

const SAMPLES = path.join(__dirname, '..', 'samples');
const sample = (name) => fs.readFileSync(path.join(SAMPLES, name));
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

// Agent that keeps cookies and sends the CSRF header on every request.
function agent() {
  const a = request.agent(app);
  const wrap = (method) => (url) => a[method](url).set('X-Requested-With', 'fetch');
  return { get: wrap('get'), post: wrap('post'), patch: wrap('patch'), put: wrap('put'), delete: wrap('delete'), raw: a };
}

// Reads the most recent 6-digit code emailed to an address (from the outbox).
async function latestCode(email) {
  const n = await Notification.findOne({ where: { toEmail: email }, order: [['id', 'DESC']] });
  const match = n && n.bodyText.match(/code is (\d{6})/);
  return match ? match[1] : null;
}

async function registerGraduate(client, { fullName = 'Amina Uwase', file = 'degree-amina-uwase.pdf', email } = {}) {
  const address = email || `grad${unique()}@alustudent.com`;
  const res = await client
    .post('/api/auth/register/graduate')
    .field('fullName', fullName)
    .field('email', address)
    .field('password', 'Password123')
    .field('cohortYear', '2024')
    .field('program', 'BSc Software Engineering')
    .attach('degreeCertificate', sample(file), file);
  return { res, email: address };
}

async function verifyEmail(client, email) {
  const code = await latestCode(email);
  return client.post('/api/auth/verify-email').send({ email, code });
}

// Stand-in for the admin approval (Phase 4 exposes this through the admin API).
async function approveGraduateDirectly(email) {
  const user = await User.findOne({ where: { email } });
  await user.update({ status: 'active' });
  await GraduateProfile.update({ verificationStatus: 'approved' }, { where: { userId: user.id } });
  return user;
}

module.exports = { agent, latestCode, registerGraduate, verifyEmail, approveGraduateDirectly, sample, unique };
