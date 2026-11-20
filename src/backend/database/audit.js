const { pool } = require("./connection");
async function audit(action, detail, ip, client = pool) {
  await client.query(
    "INSERT INTO mdpreview.audit(action,detail,ip) VALUES($1,$2,$3)",
    [action, detail, ip || null],
  );
}
module.exports = { audit };
