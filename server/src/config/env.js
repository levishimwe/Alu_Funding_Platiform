const path = require('path');

const SERVER_ROOT = path.resolve(__dirname, '..', '..');
require('dotenv').config({ path: path.join(SERVER_ROOT, '.env'), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const isTest = process.env.NODE_ENV === 'test';

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest,
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  serverRoot: SERVER_ROOT,

  db: {
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT || 3306),
    // Tests run against a separate database on the same Aiven instance.
    name: isTest ? process.env.DB_NAME_TEST || 'alu_funding_test' : required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    sslCaPath: path.resolve(SERVER_ROOT, process.env.DB_SSL_CA || './certs/ca.pem'),
  },

  jwtSecret: required('JWT_SECRET'),
  sessionHours: Number(process.env.SESSION_HOURS || 12),

  alumniDomains: (process.env.ALUMNI_EMAIL_DOMAINS || 'alueducation.com')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localDir: path.resolve(SERVER_ROOT, process.env.UPLOAD_DIR || (isTest ? './uploads-test' : './uploads')),
  },

  mail: {
    // Tests never send real email; they use the in-memory JSON transport.
    host: isTest ? '' : process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: isTest ? '' : process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from:
      process.env.MAIL_FROM ||
      (process.env.SMTP_USER ? `"ALU Ventures" <${process.env.SMTP_USER}>` : 'ALU Ventures <no-reply@aluventures.local>'),
  },
};

module.exports = env;
