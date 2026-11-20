const store = require("./store");
async function login(req, passkeyId) {
  const settings = await store.settings();
  await new Promise((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
  Object.assign(req.session, {
    authenticated: true,
    authMethod: "passkey",
    authAt: Date.now(),
    passkeyId,
    authGeneration: settings.auth_generation,
  });
  req.session.cookie.path = req.baseUrl || "/";
  await new Promise((resolve, reject) =>
    req.session.save((error) => (error ? reject(error) : resolve())),
  );
}
module.exports = { login };
