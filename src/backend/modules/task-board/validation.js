const uuid = (value) => typeof value === "string" && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const priorities = new Set(["low", "normal", "high"]);
const validText = (value, max, required = true) => typeof value === "string" && !value.includes("\0") && value.length <= max && (!required || Boolean(value.trim()));
const validDate = (value) => value === "" || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "0001-01-01" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const validTagIds = (value) => Array.isArray(value) && value.length <= 20 && value.every(uuid) && new Set(value.map((id) => id.toLowerCase())).size === value.length;
const validChecklist = (value, incomplete = false) => Array.isArray(value) && value.length <= 100 && value.every((item) => item && uuid(item.id) && validText(item.text, 200, !incomplete) && typeof item.done === "boolean") && new Set(value.map((item) => item.id.toLowerCase())).size === value.length;
const normalizeChecklist = (items) => items.map((item) => ({ id: item.id.toLowerCase(), text: item.text, done: item.done }));

module.exports = { uuid, priorities, validText, validDate, validTagIds, validChecklist, normalizeChecklist };
