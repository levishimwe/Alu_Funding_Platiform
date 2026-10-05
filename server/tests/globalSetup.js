// Migrates and seeds the dedicated test database before the suites run.
module.exports = async () => {
  process.env.NODE_ENV = 'test';
  const { createSequelize } = require('../src/config/database');
  const env = require('../src/config/env');
  if (env.db.name === 'defaultdb') throw new Error('Refusing to run tests against the application database.');
  const sequelize = createSequelize(env.db.name);
  const { createMigrator } = require('../scripts/migrate');
  await createMigrator(sequelize).up();
  await sequelize.close();
  const { seed } = require('../scripts/seed');
  await seed({ quiet: true });
  await require('../src/models').sequelize.close();
};
