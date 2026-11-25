const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const bin = process.env.POSTGRES_BIN || path.join(root, '.data/postgres16/package/native/bin');
const executable = name => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
if (!fs.existsSync(executable('initdb'))) throw new Error('Set POSTGRES_BIN to a local PostgreSQL bin directory. Tests never use .env.');
fs.mkdirSync(path.join(root, '.data'), { recursive: true });
const scratch = fs.mkdtempSync(path.join(root, '.data/local-check-'));
const workspace = path.join(scratch, 'workspace');
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|LOCALAPPDATA)$/i.test(name)));
Object.assign(env, { DB_HOST: '127.0.0.1', DB_USER: 'fixture', DB_PASSWORD: 'fixture', DB_NAME: 'postgres', SESSION_SECRET: 'isolated-fixture-secret-0123456789abcdef', MDPREVIEW_TEST_ISOLATED: '1', HOME: scratch, USERPROFILE: scratch });
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: workspace, env, encoding: 'utf8', timeout: 60000, ...options });
  if (result.status !== 0) throw new Error((result.stdout || '') + (result.stderr || '') + (result.error || ''));
  return result.stdout;
}

async function main() {
  fs.mkdirSync(workspace);
  const source = process.env.LOCAL_TEST_SOURCE || root;
  for (const name of ['src', 'tests', 'dist', 'scripts', 'package.json', 'server.js']) fs.cpSync(path.join(source, name), path.join(workspace, name), { recursive: true });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(workspace, 'node_modules'), 'junction');
  fs.writeFileSync(path.join(workspace, 'local-network-only.cjs'), `
const net=require('node:net');
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){const options=net._normalizeArgs(args)[0];if(!['127.0.0.1','::1','localhost'].includes(options.host||'localhost'))throw Error('Fixture blocks external network');return connect.apply(this,args);};
`);
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  env.DB_PORT = String(probe.address().port);
  await new Promise(resolve => probe.close(resolve));
  const data = path.join(scratch, 'database');
  run(executable('initdb'), ['-D', data, '--no-locale', '--encoding=UTF8', '--auth=trust', '--username=fixture']);
  let started = false;
  const results = [];
  try {
    run(executable('pg_ctl'), ['-D', data, '-l', path.join(scratch, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${env.DB_PORT} -c shared_buffers=16MB -c max_connections=20`, '-w', 'start']);
    started = true;
    for (const name of fs.readdirSync(path.join(workspace, 'tests')).filter(name => /^check-.*\.cjs$/.test(name) && name !== 'check-vite-build.cjs')) {
      const client = new Client({ host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, database: env.DB_NAME });
      await client.connect();
      try { await client.query('DROP SCHEMA IF EXISTS mdpreview CASCADE'); }
      finally { await client.end(); }
      const result = spawnSync(process.execPath, ['--require', './local-network-only.cjs', 'tests/' + name], { cwd: workspace, env, encoding: 'utf8', timeout: 60000 });
      results.push({ name, passed: result.status === 0, output: ((result.stdout || '') + (result.stderr || '') + (result.error || '')).trim() });
      console.log(`${result.status === 0 ? 'PASS' : 'FAIL'} ${name}`);
      if (result.status !== 0) console.log(results.at(-1).output);
    }
  } finally {
    if (started) run(executable('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop']);
    fs.writeFileSync(path.join(scratch, 'results.json'), JSON.stringify(results, null, 2));
  }
  console.log(`Isolated local results: ${path.join(scratch, 'results.json')}`);
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
