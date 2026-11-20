const { randomUUID } = require("node:crypto");
const { query } = require("../../database/connection");
const { audit } = require("../../database/audit");

async function list() {
  return (await query("SELECT * FROM mdpreview.templates ORDER BY name")).rows;
}
async function save({ id, name, content }, ip) {
  if (id) {
    const result = await query(
      "UPDATE mdpreview.templates SET name=$2,content=$3,modified=now() WHERE id=$1",
      [id, name.trim(), content],
    );
    if (result.rowCount) await audit("TEMPLATE_SAVE", name.trim(), ip);
    return result.rowCount;
  }
  await query(
    "INSERT INTO mdpreview.templates(id,name,content) VALUES($1,$2,$3)",
    [randomUUID(), name.trim(), content],
  );
  await audit("TEMPLATE_SAVE", name.trim(), ip);
  return 1;
}
async function remove(id, ip) {
  await query("DELETE FROM mdpreview.templates WHERE id=$1", [id]);
  await audit("TEMPLATE_DELETE", id, ip);
}
module.exports = { list, save, remove };
