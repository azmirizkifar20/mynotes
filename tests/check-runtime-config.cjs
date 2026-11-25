const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function config(env) {
  const module = { exports: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../src/backend/config/env.js"), "utf8"),
    {
      module,
      process: { env },
      Buffer,
      require(name) {
        if (name === "./paths") return { root: "/fixture" };
        if (name === "dotenv") return { config() {} };
        return require(name);
      },
    },
  );
  return module.exports;
}

async function main() {
  for (const secret of [undefined, "", "fallback-secret-change-me", "short", " ".repeat(40)]) {
    assert.throws(
      () => config({ NODE_ENV: "production", SESSION_SECRET: secret }),
      /SESSION_SECRET/,
      "Missing or weak session configuration must prevent startup",
    );
  }
  const secret = "fixture-secret-0123456789-abcdefghijk";
  const defaults = config({ SESSION_SECRET: secret });
  assert.equal(defaults.sessionSecret, secret);
  assert.equal(defaults.host, "127.0.0.1");
  const settings = config({ SESSION_SECRET: secret, HOST: "::1", PORT: "19027" });
  let address;
  const startup = {};
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../dist/server/backend/startup.js"), "utf8"),
    {
      exports: startup,
      console: { log() {}, error(message) { throw new Error(message); } },
      process: { on() {} },
      require(name) {
        if (name === "./config/env") return settings;
        if (name === "./database")
          return { initialize: async () => {}, ready: async () => {}, pool: { end: async () => {} } };
        if (name === "./modules/documents/mirror")
          return { sync: async () => {}, start() {} };
        if (name === "./modules/task-board/attachment-storage")
          return { start() {}, stop() {} };
        if (name === "./application")
          return { listen(port, host) { address = { port, host }; return {}; } };
        throw new Error("Unexpected module: " + name);
      },
    },
  );
  await startup.start();
  assert.deepEqual(address, { port: 19027, host: "::1" });
  const module = { exports: {} };
  function appRequire(name) {
    if (name === "./config/env") return defaults;
    if (name === "./config/paths")
      return {
        root: require("node:os").tmpdir(),
        public: path.join(__dirname, "../src/frontend/public"),
        views: path.join(__dirname, "../src/frontend/views"),
      };
    if (name === "./modules/documents/markdown") return { documentData() {} };
    if (name === "./modules/auth/store") return { normalizeSession(req, res, next) { next(); } };
    if (name === "./rendering/frontend-assets") return { readFrontendAssets() { return { entry: "fixture.js", styles: [] }; } };
    if (name.startsWith("./")) return () => {};
    return require(name);
  }
  appRequire.resolve = require.resolve;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../dist/server/backend/application.js"), "utf8"),
    { exports: module.exports, require: appRequire },
  );
  const trusts = module.exports.default.get("trust proxy fn");
  assert.equal(trusts("127.0.0.1", 0), true);
  assert.equal(trusts("::1", 0), true);
  assert.equal(trusts("192.0.2.10", 0), false, "A direct non-loopback peer must not control forwarded identity");
  const paths = require('../dist/server/backend/config/paths');
  assert.equal(paths.root, path.resolve(__dirname, '..'), 'Compiled backend must keep the project root');
  assert.ok(fs.existsSync(path.join(__dirname, '../dist/server/backend/database/schema.sql')));
  console.log("Runtime configuration checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
