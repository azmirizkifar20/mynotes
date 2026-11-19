const fs = require('fs');
const path = require('path');
const { randomBytes } = require('node:crypto');

const directory = path.join(__dirname, '.data');
const filename = path.join(directory, 'file-access.json');
fs.mkdirSync(directory, { recursive: true });
let records = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : {};
if (!records || typeof records !== 'object' || Array.isArray(records) ||
    Object.values(records).some(record => !record || !['public', 'private'].includes(record.visibility) || !/^[a-f0-9]{48}$/.test(record.id))) {
  throw new Error('Invalid file-access metadata. Restore .data/file-access.json before starting.');
}

function write(next) {
  const temporary = filename + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, filename);
  records = next;
}

function get(filePath) {
  return records[filePath] || { visibility: 'public', id: null };
}

function set(filePath, visibility) {
  const record = { visibility, id: get(filePath).id || randomBytes(24).toString('hex') };
  write({ ...records, [filePath]: record });
  return record;
}

function prepareRename(from, to) {
  const next = { ...records };
  for (const [key, value] of Object.entries(records)) {
    if (key === from || key.startsWith(from + '/')) next[to + key.slice(from.length)] = value;
  }
  // Keep both paths protected if the process stops between metadata and filesystem rename.
  write(next);
}

function remove(target) {
  write(Object.fromEntries(Object.entries(records).filter(([key]) => key !== target && !key.startsWith(target + '/'))));
}

module.exports = { get, set, prepareRename, remove, entries: () => Object.entries(records) };
