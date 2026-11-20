const { randomBytes, randomUUID, createHash } = require("node:crypto");
const { query, transaction, fail } = require("../../database/connection");
const { rpID } = require("./config");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const validToken = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const validID = (value) =>
  typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);

async function settings(client = { query }) {
  for (const key of ["passkey_user_id", "auth_generation"])
    await client.query(
      "INSERT INTO mdpreview.settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING",
      [key, JSON.stringify(randomBytes(32).toString("base64url"))],
    );
  return Object.fromEntries(
    (
      await client.query(
        "SELECT key,value FROM mdpreview.settings WHERE key IN ('passkey_user_id','auth_generation','auth_recovery')",
      )
    ).rows.map((row) => [row.key, row.value]),
  );
}
async function keys(client = { query }) {
  return (
    await client.query(
      "SELECT * FROM mdpreview.passkeys WHERE rp_id=$1 ORDER BY created_at",
      [rpID],
    )
  ).rows;
}
async function challenge(req, purpose, options, metadata = {}) {
  const id = randomUUID();
  await query("DELETE FROM mdpreview.auth_challenges WHERE expires_at < now()");
  await query(
    "INSERT INTO mdpreview.auth_challenges(id,challenge,purpose,session_hash,app_url,metadata,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '5 minutes')",
    [
      id,
      options.challenge,
      purpose,
      hash(req.sessionID),
      require("./config").requestApp(req),
      JSON.stringify(metadata),
    ],
  );
  return { options, challengeId: id };
}
async function consumeChallenge(req, purpose) {
  if (!validID(req.body?.challengeId))
    throw fail(400, "Challenge tidak valid.");
  const row = (
    await query(
      "DELETE FROM mdpreview.auth_challenges WHERE id=$1 AND purpose=$2 AND session_hash=$3 AND app_url=$4 AND expires_at>now() RETURNING *",
      [
        req.body.challengeId,
        purpose,
        hash(req.sessionID),
        require("./config").requestApp(req),
      ],
    )
  ).rows[0];
  if (!row)
    throw fail(400, "Permintaan kedaluwarsa atau sudah digunakan. Coba lagi.");
  return row;
}
async function freshSession(req) {
  if (
    !req.session?.authenticated ||
    req.session.authMethod !== "passkey" ||
    !Number.isFinite(req.session.authAt) ||
    Date.now() - req.session.authAt > 5 * 60 * 1000
  )
    throw fail(403, "Verifikasi passkey lagi sebelum mengubah keamanan.");
}
async function normalizeSession(req, res, next) {
  try {
    if (req.session?.authenticated) {
      const row = (
        await query(
          "SELECT 1 FROM mdpreview.passkeys p JOIN mdpreview.settings s ON s.key='auth_generation' WHERE p.id=$1 AND p.rp_id=$2 AND s.value=$3::jsonb",
          [
            req.session.passkeyId || "",
            rpID,
            JSON.stringify(req.session.authGeneration || ""),
          ],
        )
      ).rows[0];
      if (req.session.authMethod !== "passkey" || !row)
        req.session.authenticated = false;
    }
    next();
  } catch (error) {
    next(error);
  }
}
module.exports = {
  hash,
  validToken,
  settings,
  keys,
  challenge,
  consumeChallenge,
  freshSession,
  normalizeSession,
  query,
  transaction,
  fail,
};
