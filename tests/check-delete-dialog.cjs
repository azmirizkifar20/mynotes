const assert = require("node:assert/strict");
const { loadFrontend } = require("./helpers/frontend.cjs");
let modules;
function setup() {
  const ids = [
    "delete-dialog",
    "delete-form",
    "delete-title",
    "delete-description",
    "delete-filename",
    "delete-path",
    "delete-draft",
    "delete-error",
    "confirm-delete",
    "cancel-delete",
    "manage-dialog",
    "main",
  ];
  const ui = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        textContent: "",
        disabled: false,
        open: false,
        focus() {},
        setAttribute() {},
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
        },
      },
    ]),
  );
  ui["delete-dialog"].querySelectorAll = () => [
    ui["confirm-delete"],
    ui["cancel-delete"],
  ];
  const calls = [];
  const context = {
    pages: [
      { id: "home", path: "/", parent: null },
      { id: "file", path: "/notes.md", parent: "home", type: "doc" },
      { id: "folder", path: "/project", parent: "home", type: "folder" },
    ],
    current: "home",
    manageId: "file",
    saving: false,
    editing: false,
    deletion: null,
    recent: ["file"],
    favorites: new Set(["file"]),
    $: (id) => ui[id],
    isDirty: () => false,
    notify() {},
    persistNavigation() {},
    confirm() {
      throw new Error("Native confirm must not be used");
    },
    canLeave() {
      throw new Error("Delete confirmation must handle its own draft warning");
    },
    setBusy(value) {
      context.saving = value;
    },
    async api(endpoint, body) {
      calls.push({ endpoint, ...body });
    },
    async refreshWorkspace() {
      context.pages = context.pages.filter((p) => p.id !== context.deletion.id);
    },
    async navigate(id) {
      context.current = id;
    },
  };
  Object.assign(
    context,
    modules.documents.createFeature({ state: context, actions: context }),
  );
  return {
    context,
    ui,
    calls,
    submit: () => context.confirmDelete({ preventDefault() {} }),
  };
}

async function main() {
  modules = await loadFrontend({ documents: "features/documents.js" });
  let check = setup();
  check.context.deleteItem("home");
  assert(!check.ui["delete-dialog"].open);
  check.context.isDirty = () => true;
  check.context.deleteItem();
  assert(check.ui["delete-dialog"].open);
  assert.equal(check.ui["delete-filename"].textContent, "notes.md");
  assert.equal(check.ui["delete-path"].textContent, "docs/notes.md");
  assert.equal(check.ui["delete-draft"].hidden, false);
  check.context.closeDeleteDialog();
  assert(!check.ui["delete-dialog"].open);
  assert.equal(check.calls.length, 0);
  check.context.saving = true;
  check.context.deleteItem();
  assert(!check.ui["delete-dialog"].open);

  check = setup();
  check.context.deleteItem();
  let finish;
  check.context.api = async (endpoint, body) => {
    check.calls.push({ endpoint, ...body });
    await new Promise((resolve) => (finish = resolve));
  };
  const pending = check.submit();
  assert(check.context.saving);
  assert(check.ui["confirm-delete"].disabled);
  await check.submit();
  assert.equal(check.calls.length, 1);
  check.context.closeDeleteDialog();
  assert(check.ui["delete-dialog"].open);
  finish();
  await pending;
  assert(!check.ui["delete-dialog"].open);
  assert(!check.context.saving);
  assert.equal(check.context.favorites.size, 0);
  assert.equal(check.context.recent.length, 0);
  assert.equal(check.context.current, "home");

  check = setup();
  check.context.current = "folder";
  check.context.deleteItem("folder");
  check.context.api = async (endpoint, body) => {
    check.calls.push({ endpoint, ...body });
    if (!body.force)
      throw Object.assign(new Error("Folder is not empty"), {
        requiresConfirm: true,
      });
  };
  await check.submit();
  assert(check.ui["delete-dialog"].open);
  assert(check.context.deletion.force);
  assert.equal(check.ui["confirm-delete"].textContent, "Hapus semua isi");
  await check.submit();
  assert(check.calls[1].force);
  assert(!check.ui["delete-dialog"].open);
  assert.equal(check.context.current, "home");

  check = setup();
  check.context.deleteItem();
  check.context.api = async () => {
    throw new Error("Connection failed");
  };
  await check.submit();
  assert(check.ui["delete-dialog"].open);
  assert.equal(check.ui["delete-error"].textContent, "Connection failed");
  assert(!check.context.saving);
  assert(!check.ui["cancel-delete"].disabled);

  check = setup();
  check.context.deleteItem();
  const refresh = check.context.refreshWorkspace;
  check.context.refreshWorkspace = async () => {
    throw new Error("Refresh failed");
  };
  await check.submit();
  assert(check.context.deletion.removed);
  assert.equal(check.ui["confirm-delete"].textContent, "Muat ulang daftar");
  check.context.refreshWorkspace = refresh;
  await check.submit();
  assert.equal(check.calls.length, 1);
  assert(!check.ui["delete-dialog"].open);
  console.log(
    "PASS: delete dialog, cancel, draft warning, busy guard, folder confirmation, error and refresh retry.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
