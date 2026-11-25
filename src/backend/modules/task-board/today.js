const { randomUUID } = require("node:crypto");
const { transaction, fail } = require("../../database/connection");
const { audit } = require("../../database/audit");
const { uuid } = require("./validation");
const board = require("./service");

function dayInJakarta() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function snapshot(client) {
  const day = dayInJakarta();
  const data = await board.snapshot(client);
  const tasks = data.tasks.filter((task) => !task.archivedAt &&
    !data.statuses.find((status) => status.id === task.statusId)?.completed);
  const setting = (await client.query("SELECT value FROM mdpreview.settings WHERE key='today_focus'")).rows[0]?.value;
  return {
    day, token: setting?.day === day ? setting.token : null,
    focusIds: setting?.day === day ? setting.ids.filter((id) => tasks.some((task) => task.id === id)) : [],
    statuses: data.statuses,
    tasks: tasks.map(({ id, number, title, statusId, priority, due, startDate }) =>
      ({ id, number, title, statusId, priority, due, startDate })),
  };
}

const list = () => transaction(snapshot);
async function save(body, ip) {
  if (!body || !Array.isArray(body.ids) || body.ids.length > 3 ||
    body.ids.some((id) => !uuid(id)) ||
    new Set(body.ids.map((id) => id.toLowerCase())).size !== body.ids.length ||
    (body.token !== null && !uuid(body.token)))
    throw fail(400, "Pilih maksimal 3 task berbeda untuk fokus hari ini.");
  return transaction(async (client) => {
    const current = await snapshot(client);
    if (body.day !== current.day || body.token !== current.token)
      throw fail(409, "Hari atau fokus sudah berubah. Muat ulang pilihan fokus sebelum menyimpan.");
    const ids = body.ids.map((id) => id.toLowerCase());
    if (ids.some((id) => !current.tasks.some((task) => task.id === id)))
      throw fail(409, "Ada task yang selesai, diarsipkan, atau dihapus. Muat ulang pilihan fokus.");
    const value = { day: current.day, token: randomUUID(), ids };
    await client.query("INSERT INTO mdpreview.settings(key,value) VALUES('today_focus',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [JSON.stringify(value)]);
    await audit("TODAY_FOCUS_SAVE", `${current.day}: ${ids.length} task`, ip, client);
    return { ...current, token: value.token, focusIds: ids };
  });
}
module.exports = { list, save, dayInJakarta };
