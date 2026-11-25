const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.backend.json'], { cwd: root, stdio: 'inherit' });
fs.copyFileSync(path.join(root, 'src/backend/database/schema.sql'), path.join(root, 'dist/server/backend/database/schema.sql'));
