const assert = require("node:assert/strict");
const crypto = require("node:crypto");
assert.equal(process.env.MDPREVIEW_TEST_ISOLATED, "1", "Run only in a disposable, isolated fixture database");
assert.equal(process.env.DB_HOST, "127.0.0.1");
assert.equal(process.env.DB_USER, "fixture");
assert.equal(process.env.DB_NAME, "postgres");
assert.equal(require("node:fs").existsSync(require("node:path").join(__dirname, "../.env")), false, "The fixture source copy must not contain .env");
const { isoCBOR } = require("@simplewebauthn/server/helpers");

const origin = "http://localhost:19027";
process.env.PASSKEY_AUTH_URL = origin;
process.env.PASSKEY_APP_URLS = origin + "," + origin + "/mynotes";
const bytes = (value) => Buffer.from(value).toString("base64url");
const hash = (value) => crypto.createHash("sha256").update(value).digest();

function request(baseUrl = "") {
  const req = {
    protocol: "http", method: "POST", baseUrl,
    sessionID: crypto.randomUUID(), session: { cookie: {} }, body: {},
    get: (name) => name === "host" ? "localhost:19027" : origin,
  };
  req.session.regenerate = (done) => {
    req.sessionID = crypto.randomUUID();
    done();
  };
  return req;
}

function authenticator() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const id = crypto.randomBytes(32);
  const cose = isoCBOR.encode(new Map([
    [1, 2], [3, -7], [-1, 1],
    [-2, new Uint8Array(Buffer.from(jwk.x, "base64url"))],
    [-3, new Uint8Array(Buffer.from(jwk.y, "base64url"))],
  ]));
  function data(challenge, type, overrides = {}) {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false, ...overrides }));
  }
  return {
    id: bytes(id),
    registration(challenge) {
      const length = Buffer.alloc(2);
      length.writeUInt16BE(id.length);
      const authData = Buffer.concat([hash("localhost"), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), length, id, Buffer.from(cose)]);
      return {
        id: bytes(id), rawId: bytes(id), type: "public-key", clientExtensionResults: {},
        response: {
          clientDataJSON: bytes(data(challenge, "webauthn.create")),
          attestationObject: bytes(isoCBOR.encode(new Map([["fmt", "none"], ["attStmt", new Map()], ["authData", new Uint8Array(authData)]]))),
          transports: ["internal"],
        },
      };
    },
    assertion(challenge, counter, change = {}) {
      const count = Buffer.alloc(4);
      count.writeUInt32BE(counter);
      const authData = Buffer.concat([hash(change.rp || "localhost"), Buffer.from([change.flags ?? 0x05]), count]);
      const client = data(change.challenge || challenge, "webauthn.get", { origin: change.origin || origin });
      const signature = crypto.sign("sha256", Buffer.concat([authData, hash(client)]), privateKey);
      if (change.signature) signature[signature.length - 1] ^= 1;
      return {
        id: bytes(id), rawId: bytes(id), type: "public-key", clientExtensionResults: {},
        response: { authenticatorData: bytes(authData), clientDataJSON: bytes(client), signature: bytes(signature), userHandle: change.userHandle },
      };
    },
  };
}

async function main() {
  const code = "isolated-bootstrap-code";
  process.env.ACCESS_CODE_HASH = await require("bcrypt").hash(code, 4);
  const db = require("../src/backend/database");
  const passkeys = require("../src/backend/modules/auth/passkeys");
  const store = require("../src/backend/modules/auth/store");
  try {
    await db.initialize();
    const req = request();
    req.body = { code: "wrong" };
    await assert.rejects(passkeys.setup(req));
    req.body = { code };
    await passkeys.setup(req);
    assert.notEqual(req.session.authenticated, true, "Bootstrap must not grant workspace access");
    const device = authenticator();
    req.body = { name: "Software fixture only" };
    const until = req.session.passkeySetup.until;
    req.session.passkeySetup.until = Date.now() - 1;
    await assert.rejects(passkeys.registrationOptions(req));
    req.session.passkeySetup.until = until;
    const registration = await passkeys.registrationOptions(req);
    req.body = { challengeId: registration.challengeId, response: device.registration(registration.options.challenge) };
    assert.equal((await passkeys.verifyRegistration(req)).id, device.id);
    await assert.rejects(passkeys.verifyRegistration(req));
    req.body = { code };
    await assert.rejects(passkeys.setup(req));

    async function authenticate(change = {}, counter = 1, bridgeToken) {
      req.body = { bridgeToken };
      const pending = await passkeys.authenticationOptions(req);
      req.body = { challengeId: pending.challengeId, response: device.assertion(pending.options.challenge, counter, change) };
      return passkeys.verifyAuthentication(req);
    }
    for (const change of [
      { origin: "https://wrong.example" }, { rp: "wrong.example" }, { flags: 1 },
      { signature: true }, { challenge: bytes(crypto.randomBytes(32)) }, { userHandle: "wrong-owner" },
    ]) await assert.rejects(authenticate(change));
    assert.equal((await authenticate()).id, device.id);
    await assert.rejects(passkeys.verifyAuthentication(req));
    await assert.rejects(authenticate({}, 1), "A repeated nonzero authenticator counter must fail");

    const secondary = request("/mynotes");
    const bridge = await passkeys.startBridge(secondary);
    const approved = await authenticate({}, 2, bridge.token);
    assert.match(approved.completion, /^[a-f0-9]{64}$/);
    secondary.body = { token: bridge.token, completion: "0".repeat(64) };
    await assert.rejects(passkeys.claimBridge(secondary));
    secondary.body.completion = approved.completion;
    await assert.rejects(passkeys.claimBridge({ ...secondary, sessionID: crypto.randomUUID() }));
    await assert.rejects(passkeys.claimBridge({ ...secondary, baseUrl: "" }));
    assert.equal(await passkeys.claimBridge(secondary), device.id);
    await assert.rejects(passkeys.claimBridge(secondary));
    const expiring = await passkeys.startBridge(secondary);
    const expiredApproval = await authenticate({}, 3, expiring.token);
    await db.query("UPDATE mdpreview.auth_bridges SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [store.hash(expiring.token)]);
    secondary.body = { token: expiring.token, completion: expiredApproval.completion };
    await assert.rejects(passkeys.claimBridge(secondary));

    const settings = await store.settings();
    req.session = { authenticated: true, authMethod: "passkey", passkeyId: device.id, authGeneration: settings.auth_generation, authAt: Date.now() - 6 * 60 * 1000, cookie: {} };
    req.body = { name: "Must require step-up" };
    await assert.rejects(passkeys.registrationOptions(req));
    const recovery = crypto.randomBytes(32).toString("hex");
    await db.query("INSERT INTO mdpreview.settings(key,value) VALUES('auth_recovery',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [JSON.stringify({ hash: store.hash(recovery), expires: Date.now() - 1 })]);
    const recoveryReq = request();
    recoveryReq.body = { recoveryToken: recovery };
    await assert.rejects(passkeys.setup(recoveryReq));
    await db.query("UPDATE mdpreview.settings SET value=$1 WHERE key='auth_recovery'", [JSON.stringify({ hash: store.hash(recovery), expires: Date.now() + 60000 })]);
    await passkeys.setup(recoveryReq);
    recoveryReq.body = { name: "Recovery fixture" };
    const recoveryOptions = await passkeys.registrationOptions(recoveryReq);
    recoveryReq.body = { challengeId: recoveryOptions.challengeId, response: authenticator().registration(recoveryOptions.options.challenge) };
    await passkeys.verifyRegistration(recoveryReq);
    const replay = request();
    replay.body = { recoveryToken: recovery };
    await assert.rejects(passkeys.setup(replay));
    await db.query("DELETE FROM mdpreview.passkeys WHERE id=$1", [device.id]);
    await new Promise((resolve, reject) => store.normalizeSession(req, {}, (error) => error ? reject(error) : resolve()));
    assert.equal(req.session.authenticated, false);
    console.log("Software passkey registration/signature/origin/RP/UV/counter, bridge expiry/replay and recovery checks passed.");
  } finally {
    await db.pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
