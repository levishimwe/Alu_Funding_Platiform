// Seeds configuration data and the controlled staff accounts (FR03: staff and
// admin roles are provisioned, never self-assigned). Safe to run repeatedly.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');

const DEFAULT_SECTOR_KEYWORDS = {
  Agriculture: ['farm', 'farmer', 'crop', 'harvest', 'agri', 'agriculture', 'livestock', 'irrigation', 'seed', 'dairy', 'poultry', 'agribusiness', 'agritech', 'soil'],
  Technology: ['app', 'software', 'platform', 'saas', 'digital', 'mobile', 'web', 'ai', 'data', 'cloud', 'api', 'tech', 'online'],
  Fintech: ['payment', 'payments', 'fintech', 'loan', 'lending', 'credit', 'savings', 'wallet', 'banking', 'insurance', 'remittance', 'mobile money'],
  Healthcare: ['health', 'clinic', 'hospital', 'medical', 'patient', 'pharmacy', 'medicine', 'diagnostic', 'telemedicine', 'wellness', 'maternal'],
  Education: ['education', 'school', 'student', 'learning', 'teacher', 'tutor', 'course', 'edtech', 'training', 'curriculum', 'literacy'],
  Energy: ['energy', 'solar', 'electricity', 'power', 'battery', 'renewable', 'grid', 'biogas', 'clean cooking'],
  Logistics: ['logistics', 'delivery', 'transport', 'shipping', 'freight', 'fleet', 'courier', 'supply chain', 'warehouse', 'mobility'],
  'Retail & E-commerce': ['retail', 'shop', 'store', 'ecommerce', 'e-commerce', 'marketplace', 'consumer', 'fashion', 'apparel'],
  'Climate & Environment': ['climate', 'recycling', 'waste', 'environment', 'carbon', 'water', 'sanitation', 'circular', 'plastic'],
  'Creative & Media': ['media', 'film', 'music', 'art', 'design', 'content', 'creative', 'photography', 'tourism', 'hospitality'],
};

const DEFAULT_SETTINGS = {
  similarity_threshold: 0.75,
  ocr_name_match_threshold: 0.8,
};

function ensureSeedPassword(name) {
  if (process.env[name]) return process.env[name];
  const generated = crypto.randomBytes(9).toString('base64url') + 'A1!';
  fs.appendFileSync(path.join(env.serverRoot, '.env'), `\n${name}=${generated}\n`);
  process.env[name] = generated;
  console.log(`Generated ${name} and saved it to server/.env`);
  return generated;
}

async function seed({ quiet = false } = {}) {
  const { User, SectorKeyword, Setting } = require('../src/models');
  const log = quiet ? () => {} : console.log;

  for (const [sector, keywords] of Object.entries(DEFAULT_SECTOR_KEYWORDS)) {
    await SectorKeyword.findOrCreate({ where: { sector }, defaults: { keywords } });
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await Setting.findOrCreate({ where: { key }, defaults: { value } });
  }
  log(`Sector keyword map: ${Object.keys(DEFAULT_SECTOR_KEYWORDS).length} sectors; settings ready.`);

  const accounts = [
    {
      email: process.env.SEED_ADMIN_EMAIL || 'admin@aluventures.local',
      fullName: 'Platform Administrator',
      role: 'admin',
      passwordVar: 'SEED_ADMIN_PASSWORD',
    },
    {
      email: process.env.SEED_STAFF_EMAIL || 'staff@aluventures.local',
      fullName: 'ALU Entrepreneurship Staff',
      role: 'staff',
      passwordVar: 'SEED_STAFF_PASSWORD',
    },
  ];
  for (const account of accounts) {
    const existing = await User.findOne({ where: { email: account.email } });
    if (existing) {
      log(`${account.role} account already exists: ${account.email}`);
      continue;
    }
    const password = env.isTest ? 'TestPass!2026' : ensureSeedPassword(account.passwordVar);
    await User.create({
      email: account.email,
      fullName: account.fullName,
      role: account.role,
      status: 'active',
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(password, 12),
    });
    log(`Created ${account.role} account: ${account.email} (password in server/.env ${account.passwordVar})`);
  }
}

module.exports = { seed, DEFAULT_SECTOR_KEYWORDS, DEFAULT_SETTINGS };

if (require.main === module) {
  const { sequelize } = require('../src/config/database');
  seed()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}
