require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

module.exports = function databaseConfig(database = process.env.DB_NAME) {
  for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  }
  if (!/^\d+$/.test(process.env.DB_PORT) || Number(process.env.DB_PORT) < 1 || Number(process.env.DB_PORT) > 65535) throw new Error('Invalid DB_PORT');
  return { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database, connectionTimeoutMillis: 8000 };
};
