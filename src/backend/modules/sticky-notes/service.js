const { query, transaction, fail } = require("../../database/connection");
const { audit } = require("../../database/audit");

const colors = new Set(["yellow", "sage", "rose", "blue", "lilac", "stone"]);
const uuid = (value) => typeof value === "string" && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const text = (value, max) => typeof value === "string" && value.length <= max && !value.includes("\0");
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

async function list() {
  return (await query("SELECT revision,notes,modified FROM mdpreview.sticky_board WHERE id=1")).rows[0];
}

async function save(body, ip) {
  if (!body || !integer(body.revision, 1, 2147483646) ||
    !Array.isArray(body.notes) || body.notes.length > 100 ||
    body.notes.some((note) => !note || !uuid(note.id) || !text(note.title, 120) ||
      !text(note.body, 10000) || !colors.has(note.color) ||
      !integer(note.w, 240, 700) || !integer(note.h, 210, 800) ||
      !integer(note.x, 0, 2300 - note.w) || !integer(note.y, 0, 1550 - note.h)) ||
    new Set(body.notes.map((note) => note.id.toLowerCase())).size !== body.notes.length)
    throw fail(400, "Catatan tidak valid. Maksimal 100 catatan, judul 120 dan isi 10.000 karakter.");
  const notes = body.notes.map(({ id, title, body: content, color, x, y, w, h }) =>
    ({ id: id.toLowerCase(), title, body: content, color, x, y, w, h }));
  return transaction(async (client) => {
    const updated = await client.query(
      "UPDATE mdpreview.sticky_board SET notes=$1::jsonb,revision=revision+1,modified=now() WHERE id=1 AND revision=$2 RETURNING revision,modified",
      [JSON.stringify(notes), body.revision],
    );
    if (!updated.rowCount)
      throw fail(409, "Canvas berubah di perangkat lain. Unduh salinan perubahanmu sebelum memuat versi terbaru.", { conflict: true });
    await audit("STICKY_NOTES_SAVE", `${notes.length} catatan`, ip, client);
    return updated.rows[0];
  });
}

module.exports = { list, save };
