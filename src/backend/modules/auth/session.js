const store = require("./store");
const { nextMidnight, boundCookie } = require("./expiry");
async function login(req, passkeyId) {
  const settings = await store.settings();
  await new Promise((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
  const now = Date.now();
  Object.assign(req.session, {
    authenticated: true,
    authMethod: "passkey",
    authAt: now,
    authIssuedAt: now,
    authExpiresAt: nextMidnight(now),
    passkeyId,
    authGeneration: settings.auth_generation,
  });
  req.session.cookie.path = req.baseUrl || "/";
  boundCookie(req.session, req.session.authExpiresAt);
  await new Promise((resolve, reject) =>
    req.session.save((error) => (error ? reject(error) : resolve())),
  );
}
module.exports = { login };
