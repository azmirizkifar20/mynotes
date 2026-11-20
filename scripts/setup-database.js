const { Client } = require("pg");
const config = require("../src/backend/database/config");

(async () => {
  let client = new Client(config());
  try {
    await client.connect();
    console.log(
      "Database connection authenticated; target database already exists.",
    );
  } catch (error) {
    await client.end().catch(() => {});
    if (error.code !== "3D000") throw error;
    const admin = new Client(config("postgres"));
    try {
      await admin.connect();
      const name = process.env.DB_NAME.replace(/"/g, '""');
      try {
        await admin.query(`CREATE DATABASE "${name}"`);
      } catch (createError) {
        if (createError.code !== "42P04") throw createError;
      }
      console.log("Target database created.");
    } finally {
      await admin.end();
    }
    client = new Client(config());
    await client.connect();
  }
  try {
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA IF NOT EXISTS mdpreview");
    await client.query("CREATE TABLE mdpreview.connection_probe (id integer)");
    await client.query("ROLLBACK");
    console.log("Database read/write and schema permissions OK.");
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error("Database setup failed:", error.code || error.name);
  process.exitCode = 1;
});
