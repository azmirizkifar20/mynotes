const assert = require("node:assert/strict");
const config = require("../src/backend/modules/auth/config");
const store = require("../src/backend/modules/auth/store");
async function main() {
  assert.equal(
    config.appURL("https://itsazmi.com/mynotes/"),
    "https://itsazmi.com/mynotes",
  );
  for (const url of [
    "http://itsazmi.com",
    "https://user:password@itsazmi.com",
    "https://itsazmi.com?next=elsewhere",
    "https://itsazmi.com/#token",
  ])
    assert.throws(() => config.appURL(url));
  const request = {
    protocol: "https",
    method: "POST",
    baseUrl: "/mynotes",
    get: (name) => (name === "host" ? "itsazmi.com" : "https://itsazmi.com"),
  };
  assert.equal(config.requestApp(request), "https://itsazmi.com/mynotes");
  assert.throws(() =>
    config.requestApp({ ...request, get: () => "evil.example" }),
  );
  assert.throws(() =>
    config.requestApp({
      ...request,
      get: (name) => (name === "host" ? "itsazmi.com" : undefined),
    }),
  );
  assert.equal(store.validToken("a".repeat(64)), true);
  assert.equal(store.validToken("a".repeat(63)), false);
  assert.equal(store.validToken({ token: "a".repeat(64) }), false);
  const session = {
    authenticated: true,
    authMethod: "passkey",
    authAt: Date.now(),
  };
  await store.freshSession({ session });
  for (const invalid of [
    { ...session, authAt: undefined },
    { ...session, authAt: Date.now() - 6 * 60 * 1000 },
    { ...session, authMethod: "code" },
  ])
    await assert.rejects(store.freshSession({ session: invalid }));
  console.log(
    "Passkey configuration and authorization boundary checks passed.",
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => require("../src/backend/database").pool.end());
