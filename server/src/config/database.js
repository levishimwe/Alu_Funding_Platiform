const fs = require('fs');
const { Sequelize } = require('sequelize');
const env = require('./env');

// Aiven requires TLS. We verify the server certificate against Aiven's CA;
// verification is never disabled.
function sslOptions() {
  return {
    ca: fs.readFileSync(env.db.sslCaPath, 'utf8'),
    rejectUnauthorized: true,
  };
}

function createSequelize(databaseName = env.db.name) {
  return new Sequelize(databaseName, env.db.user, env.db.password, {
    host: env.db.host,
    port: env.db.port,
    dialect: 'mysql',
    dialectOptions: { ssl: sslOptions() },
    timezone: '+00:00',
    logging: process.env.DB_LOG === '1' ? console.log : false,
    pool: { max: 10, min: 0, idle: 10000, acquire: 30000 },
    define: { underscored: true, timestamps: true },
  });
}

const sequelize = createSequelize();

module.exports = { sequelize, createSequelize, sslOptions };
