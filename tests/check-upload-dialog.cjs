const assert = require("node:assert/strict");
const { loadFrontend } = require("./helpers/frontend.cjs");
let modules;
function setup() {
  const ui = Object.fromEntries(
    [
      "file-drop-zone",
      "file-drop-target",
      "upload-dialog",
      "upload-form",
      "upload-name",
      "upload-content",
      "upload-target",
      "upload-size",
      "upload-draft",
      "upload-error",
      "upload-status",
      "confirm-upload",
      "upload-input",
      "main",
      "cancel-upload",
    ].map((id) => [
      id,
      {
        value: "",
        textContent: "",
        disabled: false,
        hidden: true,
        open: false,
        focus() {},
        setAttribute() {},
        setCustomValidity(message) {
          this.validity = message;
        },
        reportValidity() {},
        addEventListener() {},
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
          context.pendingUpload = null;
        },
      },
    ]),
  );
  ui["upload-dialog"].querySelectorAll = () => [
    ui["upload-name"],
    ui["confirm-upload"],
    ui["cancel-upload"],
  ];
  const calls = [],
    events = {};
  const context = {
    boot: { mode: "workspace" },
    pendingUpload: null,
    fileDragDepth: 0,
    saving: false,
    dirty: false,
    pages: [{ id: "folder", type: "folder", path: "/project" }],
    folder: { path: "/project" },
    $: (id) => ui[id],
    activeFolder: () => context.folder,
    isDirty: () => context.dirty,
    notify(message) {
      context.message = message;
    },
    setBusy(value) {
      context.saving = value;
    },
    document: {
      getElementById: (id) => ui[id],
      querySelector: () =>
        ui["upload-dialog"].open ? ui["upload-dialog"] : null,
      addEventListener: (name, handler) => (events[name] = handler),
    },
    window: { addEventListener() {} },
    FormData: class {
      constructor() {
        this.fields = {};
      }
      append(key, value) {
        this.fields[key] = value;
      }
    },
    async api(endpoint, data) {
      calls.push({ endpoint, ...data.fields });
      return { path: "/project/note.md" };
    },
    async refreshWorkspace() {},
    async navigate(id) {
      context.destination = id;
    },
  };
  global.document = context.document;
  global.window = context.window;
  global.FormData = context.FormData;
  Object.assign(
    context,
    modules.dom.createFeature({ state: context, actions: context }),
    modules.upload.createFeature({ state: context, actions: context }),
  );
  context.bindUpload();
  return {
    context,
    ui,
    calls,
    events,
    submit: () => context.confirmUpload({ preventDefault() {} }),
  };
}
const file = (
  name = "note.md",
  content = "# Sample\n<script>not executed</script>",
) => ({ name, size: 42, text: async () => content });
const drop = (files) => ({
  preventDefault() {},
  dataTransfer: { types: ["Files"], files },
});

async function main() {
  modules = await loadFrontend({
    dom: "core/dom.js",
    upload: "features/upload.js",
  });
  let check = setup();
  await check.context.openUploadPreview(file("note.txt"));
  assert(!check.ui["upload-dialog"].open);
  await check.context.openUploadPreview({
    ...file(),
    size: 5 * 1024 * 1024 + 1,
  });
  assert(!check.ui["upload-dialog"].open);
  check.context.dirty = true;
  await check.context.openUploadPreview(file());
  assert.equal(check.calls.length, 0);
  assert.equal(check.ui["upload-content"].value, await file().text());
  assert.equal(check.ui["upload-target"].textContent, "docs/project");
  assert(!check.ui["upload-draft"].hidden);
  check.context.closeUploadDialog();
  assert.equal(check.calls.length, 0);

  check = setup();
  await check.context.openUploadPreview(file("note.markdown"));
  assert.equal(check.ui["upload-name"].value, "note.md");
  check.ui["upload-name"].value = "../note.md";
  await check.submit();
  assert.equal(check.calls.length, 0);
  check.ui["upload-name"].value = "renamed.md";
  check.context.folder = { path: "/different" };
  let finish;
  check.context.api = async (endpoint, data) => {
    check.calls.push({ endpoint, ...data.fields });
    await new Promise((resolve) => (finish = resolve));
    return { path: "/project/renamed.md" };
  };
  const pending = check.submit();
  assert(check.context.saving);
  assert(check.ui["confirm-upload"].disabled);
  check.context.closeUploadDialog();
  assert(check.ui["upload-dialog"].open);
  await check.submit();
  assert.equal(check.calls.length, 1);
  finish();
  await pending;
  assert.equal(check.calls[0].targetFolder, "/project");
  assert.equal(check.calls[0].filename, "renamed.md");
  assert.equal(check.context.destination, "folder");
  assert(!check.ui["upload-dialog"].open);

  check = setup();
  let read;
  const reading = check.context.openUploadPreview({
    ...file(),
    text: () => new Promise((resolve) => (read = resolve)),
  });
  assert(check.ui["confirm-upload"].disabled);
  check.context.closeUploadDialog();
  read("late content");
  await reading;
  assert.equal(check.context.pendingUpload, null);
  assert.equal(check.ui["upload-content"].value, "");

  check = setup();
  await check.context.openUploadPreview(file());
  check.context.api = async () => {
    throw new Error("Nama sama sudah ada");
  };
  await check.submit();
  assert.equal(check.ui["upload-error"].textContent, "Nama sama sudah ada");
  assert(check.ui["upload-dialog"].open);
  assert(!check.context.saving);
  assert(!check.ui["confirm-upload"].disabled);

  check = setup();
  await check.context.openUploadPreview(file());
  check.context.refreshWorkspace = async () => {
    throw new Error("Connection failed");
  };
  await check.submit();
  assert.equal(check.calls.length, 1);
  assert.equal(check.ui["confirm-upload"].textContent, "Muat ulang daftar");
  check.context.refreshWorkspace = async () => {};
  await check.submit();
  assert.equal(check.calls.length, 1);

  check = setup();
  check.events.dragenter(drop([file()]));
  assert(!check.ui["file-drop-zone"].hidden);
  check.events.dragleave();
  assert(check.ui["file-drop-zone"].hidden);
  check.events.drop(drop([file("wrong.txt")]));
  assert(!check.ui["upload-dialog"].open);
  check.events.drop(drop([file(), file()]));
  assert(!check.ui["upload-dialog"].open);
  check.events.drop({
    ...drop([file()]),
    dataTransfer: {
      ...drop([file()]).dataTransfer,
      items: [{ webkitGetAsEntry: () => ({ isDirectory: true }) }],
    },
  });
  assert(!check.ui["upload-dialog"].open);
  check.events.drop(drop([file()]));
  assert(check.ui["upload-dialog"].open);
  console.log("Upload review self-check passed.");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
