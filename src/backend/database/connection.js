const { Pool } = require("pg");
const config = require("./config");
const pool = new Pool({ ...config(), max: 8, idleTimeoutMillis: 10000 });
pool.on("error", (error) =>
  console.error("Database pool error:", error.code || error.name),
);
const ROOT_ID = "00000000-0000-0000-0000-000000000000";
const fail = (status, message, extra = {}) =>
  Object.assign(new Error(message), { status, ...extra });
const query = (sql, values) => pool.query(sql, values);

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7827026)");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505")
      throw fail(409, "Nama atau lokasi tersebut sudah digunakan.");
    throw error;
  } finally {
    client.release();
  }
}
module.exports = { pool, query, transaction, fail, ROOT_ID };
