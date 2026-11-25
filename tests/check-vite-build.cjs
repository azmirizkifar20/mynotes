const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/frontend/.vite/manifest.json'), 'utf8'));
const entry = manifest['src/frontend/main.ts'];
assert(entry?.isEntry, 'Vite entry must be present');
assert(entry.css?.length, 'Production build includes existing CSS');
for (const item of Object.values(manifest)) {
  for (const filename of [item.file, ...(item.css || []), ...(item.assets || [])]) {
    assert(!filename.startsWith('/') && !filename.includes('..'), 'Build paths are mount-relative');
    assert(fs.existsSync(path.join(root, 'dist/frontend', filename)));
  }
}
const js = fs.readFileSync(path.join(root, 'dist/frontend', entry.file), 'utf8');
assert(!js.includes('DB_PASSWORD') && !js.includes('R2_SECRET_ACCESS_KEY'), 'Server credentials stay outside frontend');
console.log('Vite manifest, relative assets and credential boundary checks passed.');
