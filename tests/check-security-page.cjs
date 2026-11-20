const assert = require("node:assert/strict");
const { loadFrontend } = require("./helpers/frontend.cjs");
async function main() {
  const { security } = await loadFrontend({ security: "features/management/passkeys.js" });
  const nodes = Object.fromEntries(["outline", "main", "passkey-content", "security-error"].map(id => [id, { innerHTML: "", textContent: "", setAttribute() {} }]));
  const state = { current: "passkeys", basePath: "/mynotes", navigationSequence: 1 };
  global.location = { origin: "https://itsazmi.com" };
  const data = { authURL: "https://itsazmi.com/mynotes", items: [{ id: "key", name: '<phone>', created_at: "2026-11-20", current: true }] };
  const actions = { $: id => nodes[id], icon: () => "", dateLabel: value => value, escape: value => String(value).replaceAll("<", "&lt;").replaceAll(">", "&gt;"), api: async () => data };
  const page = security.createFeature({ state, actions });
  await page.renderPasskeys();
  const html = nodes["passkey-content"].innerHTML;
  for (const content of ['data-action="reauthenticate"', 'data-submit="addPasskey"', 'data-submit="renamePasskey"', 'data-action="confirmRevokePasskey"', 'aria-labelledby="registered-passkeys-title"', '&lt;phone&gt;', 'Sesi ini']) assert.ok(html.includes(content), content);
  state.basePath = "";
  global.location.origin = "https://mdpreview.azmirf.my.id";
  await page.renderPasskeys();
  assert.ok(!nodes["passkey-content"].innerHTML.includes('data-submit="addPasskey"'));
  assert.ok(nodes["passkey-content"].innerHTML.includes('rel="noopener"'));
  actions.api = async () => { throw new Error("Offline"); };
  await page.renderPasskeys();
  assert.equal(nodes["security-error"].textContent, "Offline");
  assert.ok(nodes["passkey-content"].innerHTML.includes("Coba lagi"));
  console.log("Security page rendering checks passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
