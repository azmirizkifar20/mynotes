const { randomBytes } = require("node:crypto");
const webauthn = require("@simplewebauthn/server");
const bcrypt = require("bcrypt");
const { accessCodeHash } = require("../../config/env");
const store = require("./store");
const config = require("./config");

async function bridgeInfo(token, client = store) {
  if (!store.validToken(token))
    throw store.fail(400, "Permintaan login tidak valid.");
  const row = (
    await client.query(
      "SELECT * FROM mdpreview.auth_bridges WHERE token_hash=$1 AND expires_at>now() AND passkey_id IS NULL",
      [store.hash(token)],
    )
  ).rows[0];
  if (!row || !config.allowedApps.has(row.app_url))
    throw store.fail(
      400,
      "Permintaan login kedaluwarsa. Mulai lagi dari halaman asal.",
    );
  return row;
}
async function status(req) {
  const app = config.requestApp(req);
  const registered = (await store.keys()).length > 0;
  const bridge = req.body.bridgeToken
    ? await bridgeInfo(req.body.bridgeToken)
    : null;
  return {
    registered,
    canonical: app === config.authURL,
    authURL: config.authURL,
    destination: bridge?.app_url || null,
  };
}
async function setup(req) {
  config.requireCanonical(req);
  const { recoveryToken, code } = req.body;
  let grant;
  if (recoveryToken) {
    if (!store.validToken(recoveryToken))
      throw store.fail(403, "Token pemulihan tidak valid atau kedaluwarsa.");
    const settings = await store.settings();
    const recovery = settings.auth_recovery;
    if (
      !recovery ||
      recovery.hash !== store.hash(recoveryToken) ||
      recovery.expires <= Date.now()
    )
      throw store.fail(403, "Token pemulihan tidak valid atau kedaluwarsa.");
    grant = { kind: "recovery", hash: recovery.hash, until: recovery.expires };
  } else {
    if ((await store.keys()).length)
      throw store.fail(
        403,
        "Passkey sudah aktif. Kode akses tidak bisa digunakan untuk login.",
      );
    if (
      typeof code !== "string" ||
      code.length > 256 ||
      !accessCodeHash ||
      !(await bcrypt.compare(code, accessCodeHash))
    )
      throw store.fail(403, "Kode akses salah.");
    grant = { kind: "bootstrap", until: Date.now() + 5 * 60 * 1000 };
  }
  await new Promise((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
  req.session.cookie.path = req.baseUrl || "/";
  req.session.passkeySetup = grant;
}
async function registrationGrant(req, client, consume = false) {
  const keys = await store.keys(client);
  const settings = await store.settings(client);
  const grant = req.session.passkeySetup;
  if (
    grant?.until > Date.now() &&
    grant.kind === "recovery" &&
    grant.hash === settings.auth_recovery?.hash &&
    settings.auth_recovery.expires > Date.now()
  ) {
    if (consume)
      await client.query(
        "DELETE FROM mdpreview.settings WHERE key='auth_recovery'",
      );
    return;
  }
  if (
    req.session.authenticated &&
    req.session.authMethod === "passkey" &&
    req.session.authGeneration === settings.auth_generation &&
    keys.some((key) => key.id === req.session.passkeyId)
  ) {
    await store.freshSession(req);
    return;
  }
  if (grant?.until > Date.now() && grant.kind === "bootstrap" && !keys.length)
    return;
  throw store.fail(403, "Izin pendaftaran kedaluwarsa atau sudah digunakan.");
}
async function registrationOptions(req) {
  config.requireCanonical(req);
  await registrationGrant(req, store);
  const { name } = req.body;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 80 ||
    /[\x00-\x1f]/.test(name)
  )
    throw store.fail(400, "Nama passkey wajib diisi, maksimal 80 karakter.");
  const settings = await store.settings();
  const keys = await store.keys();
  if (keys.length >= 20)
    throw store.fail(
      400,
      "Maksimal 20 passkey. Hapus passkey yang tidak dipakai terlebih dahulu.",
    );
  const bridge = req.body.bridgeToken
    ? await bridgeInfo(req.body.bridgeToken)
    : null;
  const options = await webauthn.generateRegistrationOptions({
    rpName: "Ruangku",
    rpID: config.rpID,
    userID: new Uint8Array(Buffer.from(settings.passkey_user_id, "base64url")),
    userName: "Personal workspace",
    userDisplayName: "Ruangku",
    attestationType: "none",
    supportedAlgorithmIDs: [-7, -257],
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    excludeCredentials: keys.map((key) => ({
      id: key.id,
      transports: key.transports,
    })),
  });
  req.session.authPending = true;
  req.session.cookie.path = req.baseUrl || "/";
  return store.challenge(req, "registration", options, {
    name: name.trim(),
    bridgeHash: bridge?.token_hash || null,
  });
}
async function approveBridge(client, tokenHash, passkeyId) {
  if (!tokenHash) return null;
  const completion = randomBytes(32).toString("hex");
  const result = await client.query(
    "UPDATE mdpreview.auth_bridges SET passkey_id=$2,completion_hash=$3 WHERE token_hash=$1 AND expires_at>now() AND passkey_id IS NULL",
    [tokenHash, passkeyId, store.hash(completion)],
  );
  if (!result.rowCount)
    throw store.fail(
      400,
      "Permintaan login sudah berakhir. Mulai lagi dari halaman asal.",
    );
  return completion;
}
async function verifyRegistration(req) {
  config.requireCanonical(req);
  const challenge = await store.consumeChallenge(req, "registration");
  let result;
  try {
    result = await webauthn.verifyRegistrationResponse({
      response: req.body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
      supportedAlgorithmIDs: [-7, -257],
    });
  } catch {
    throw store.fail(
      400,
      "Pendaftaran passkey tidak dapat diverifikasi. Coba lagi.",
    );
  }
  if (!result.verified)
    throw store.fail(400, "Passkey tidak dapat diverifikasi.");
  const info = result.registrationInfo,
    credential = info.credential;
  const completion = await store.transaction(async (client) => {
    await registrationGrant(req, client, true);
    if ((await store.keys(client)).length >= 20)
      throw store.fail(400, "Maksimal 20 passkey.");
    await client.query(
      "INSERT INTO mdpreview.passkeys(id,rp_id,public_key,counter,name,transports,device_type,backed_up) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        credential.id,
        config.rpID,
        Buffer.from(credential.publicKey),
        credential.counter,
        challenge.metadata.name,
        credential.transports || [],
        info.credentialDeviceType,
        info.credentialBackedUp,
      ],
    );
    return approveBridge(client, challenge.metadata.bridgeHash, credential.id);
  });
  delete req.session.passkeySetup;
  return { id: credential.id, completion };
}
async function authenticationOptions(req) {
  config.requireCanonical(req);
  if (!(await store.keys()).length)
    throw store.fail(400, "Daftarkan passkey pertama terlebih dahulu.");
  const bridge = req.body.bridgeToken
    ? await bridgeInfo(req.body.bridgeToken)
    : null;
  const options = await webauthn.generateAuthenticationOptions({
    rpID: config.rpID,
    userVerification: "required",
  });
  req.session.authPending = true;
  req.session.cookie.path = req.baseUrl || "/";
  return store.challenge(req, "authentication", options, {
    bridgeHash: bridge?.token_hash || null,
  });
}
async function verifyAuthentication(req) {
  config.requireCanonical(req);
  const challenge = await store.consumeChallenge(req, "authentication");
  const response = req.body.response;
  if (typeof response?.id !== "string" || response.id.length > 4096)
    throw store.fail(400, "Respons passkey tidak valid.");
  return store.transaction(async (client) => {
    const key = (
      await client.query(
        "SELECT * FROM mdpreview.passkeys WHERE id=$1 AND rp_id=$2 FOR UPDATE",
        [response.id, config.rpID],
      )
    ).rows[0];
    if (!key)
      throw store.fail(403, "Passkey tidak dikenal atau sudah dicabut.");
    const settings = await store.settings(client);
    if (
      response.response?.userHandle &&
      response.response.userHandle !== settings.passkey_user_id
    )
      throw store.fail(403, "Pemilik passkey tidak cocok.");
    let result;
    try {
      result = await webauthn.verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: config.origin,
        expectedRPID: config.rpID,
        requireUserVerification: true,
        credential: {
          id: key.id,
          publicKey: new Uint8Array(key.public_key),
          counter: Number(key.counter),
          transports: key.transports,
        },
      });
    } catch {
      throw store.fail(403, "Passkey tidak dapat diverifikasi. Coba lagi.");
    }
    if (!result.verified)
      throw store.fail(403, "Passkey tidak dapat diverifikasi.");
    await client.query(
      "UPDATE mdpreview.passkeys SET counter=$2,last_used_at=now(),backed_up=$3,device_type=$4 WHERE id=$1",
      [
        key.id,
        result.authenticationInfo.newCounter,
        result.authenticationInfo.credentialBackedUp,
        result.authenticationInfo.credentialDeviceType,
      ],
    );
    const completion = await approveBridge(client, challenge.metadata.bridgeHash, key.id);
    return { id: key.id, completion };
  });
}
async function startBridge(req) {
  const app = config.requestApp(req);
  if (app === config.authURL)
    throw store.fail(400, "Gunakan passkey langsung pada pusat login.");
  const token = randomBytes(32).toString("hex");
  await store.query(
    "DELETE FROM mdpreview.auth_bridges WHERE expires_at<now()",
  );
  await store.query(
    "INSERT INTO mdpreview.auth_bridges(token_hash,session_hash,app_url,expires_at) VALUES($1,$2,$3,now()+interval '5 minutes')",
    [store.hash(token), store.hash(req.sessionID), app],
  );
  req.session.authPending = true;
  req.session.cookie.path = req.baseUrl || "/";
  return { token, url: config.authURL + "/?auth=1#bridge=" + token };
}
async function claimBridge(req) {
  const app = config.requestApp(req);
  if (!store.validToken(req.body.token) || !store.validToken(req.body.completion))
    throw store.fail(400, "Permintaan login tidak valid.");
  return store.transaction(async (client) => {
    const bridge = (
      await client.query(
        "SELECT * FROM mdpreview.auth_bridges WHERE token_hash=$1 AND session_hash=$2 AND app_url=$3 AND completion_hash=$4 AND passkey_id IS NOT NULL AND expires_at>now() FOR UPDATE",
        [store.hash(req.body.token), store.hash(req.sessionID), app, store.hash(req.body.completion)],
      )
    ).rows[0];
    if (!bridge)
      throw store.fail(
        400,
        "Permintaan login kedaluwarsa atau sudah digunakan.",
      );
    await client.query(
      "DELETE FROM mdpreview.auth_bridges WHERE token_hash=$1",
      [bridge.token_hash],
    );
    return bridge.passkey_id;
  });
}
module.exports = {
  status,
  setup,
  registrationOptions,
  verifyRegistration,
  authenticationOptions,
  verifyAuthentication,
  startBridge,
  claimBridge,
};
