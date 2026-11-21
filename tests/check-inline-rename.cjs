const assert = require("node:assert/strict");
const { loadFrontend } = require("./helpers/frontend.cjs");

async function main() {
  const modules = await loadFrontend({
    documents: "features/documents.js", workspace: "features/workspace.js",
    navigation: "core/navigation.js", editor: "features/editor/controller.js", dom: "core/dom.js",
  });
  function fixture() {
    const page = { id: "file", type: "doc", title: "Old", path: "/Old.md", body: "notes" };
    const state = {
      pages: [page], current: page.id, manageId: page.id, recent: [page.id],
      favorites: new Set([page.id]), draftState: { resolved: true },
      documentBuffer: { id: page.id, content: "notes" }, saving: false,
    };
    const elements = new Map(), calls = [];
    const actions = {
      $(id) {
        if (!elements.has(id)) elements.set(id, {
          id, hidden: id === "document-rename-form", value: "", disabled: false, handlers: {},
          focus() {}, select() {}, close() {}, reportValidity() {},
          setCustomValidity(value) { this.validity = value; },
          addEventListener(type, callback) { this.handlers[type] = callback; },
        });
        return elements.get(id);
      },
      icon: () => "", dateLabel: () => "today", accessLabel: () => "Private",
      notify: (message) => calls.push(["notice", message]),
      canLeave: () => true, persistNavigation() {},
      setBusy(value) { state.saving = value; },
      async flushDraft() { calls.push(["flush"]); },
      async api(endpoint, body) { calls.push([endpoint, body]); return { path: "/New.md" }; },
      async refreshWorkspace() { state.pages = [{ ...page, title: "New", path: "/New.md" }]; },
      async navigate(...args) { calls.push(["navigate", ...args]); actions.$("document-rename-form").hidden = true; },
    };
    const dom = modules.dom.createFeature({ state, actions });
    actions.escape = dom.escape;
    actions.validName = dom.validName;
    Object.assign(actions, modules.documents.createFeature({ state, actions }));
    const form = actions.$("document-rename-form");
    form.elements = [actions.$("document-name"), actions.$("save-name"), actions.$("cancel-name")];
    return { state, page, actions, calls, form, submit: () => actions.renameItem({
      preventDefault() {}, target: form,
    }, page.id) };
  }

  let f = fixture();
  const header = modules.workspace.createFeature({ state: f.state, actions: f.actions }).header;
  assert.match(header(f.page), /<h1 id="document-title"><button/);
  assert.match(header(f.page), /data-submit="renameItem" data-arg="file" hidden/);
  assert.doesNotMatch(header({ ...f.page, type: "folder" }), /document-rename-form/);
  assert.match(header({ ...f.page, title: '<script>"' }), /&lt;script&gt;&quot;/);
  f.actions.editDocumentName();
  assert.equal(f.form.hidden, false);
  const input = f.actions.$("document-name");
  input.value = "New";
  input.handlers.input({ target: input });
  assert.equal(input.handlers.blur, undefined, "Blur must not save a filename");
  assert.equal(f.calls.length, 0, "Typing must not write a filename");
  assert.equal(f.page.title, "Old");
  f.form.handlers.keydown({ key: "Escape", preventDefault() {}, stopPropagation() {} });
  assert.equal(f.form.hidden, true);
  assert.equal(f.calls.length, 0);

  f.actions.editDocumentName();
  assert.equal(input.value, "Old", "Cancel must discard the pending name");
  const nav = modules.navigation.createFeature({ state: f.state, actions: f.actions });
  assert.equal(nav.canLeave(), false, "Navigation must not silently discard a name edit");
  const editor = modules.editor.createFeature({ state: f.state, actions: f.actions });
  await editor.setEditing(true);
  assert.notEqual(f.state.editing, true, "Mode switching must retain a pending filename");
  f.calls.length = 0;
  input.value = "New";
  await f.submit();
  assert.deepEqual(f.calls.slice(0, 2), [["flush"], ["rename", { path: "/Old.md", newName: "New" }]]);
  assert.deepEqual(f.calls.find((call) => call[0] === "navigate"), ["navigate", "file", "replace", true]);
  assert.equal(f.state.pages[0].path, "/New.md");
  assert.deepEqual(f.state.recent, ["file"]);
  assert.deepEqual([...f.state.favorites], ["file"]);
  assert.equal(f.state.documentBuffer.content, "notes");
  assert.equal(f.state.saving, false);
  assert(f.form.elements.every((control) => !control.disabled));

  f = fixture();
  f.actions.editDocumentName();
  f.actions.$("document-name").value = "../escape";
  await f.submit();
  assert.equal(f.calls.length, 0);
  assert.equal(f.actions.$("document-name").validity, "Nama tidak valid.");

  f = fixture();
  f.actions.editDocumentName();
  f.actions.$("document-name").value = "New";
  f.actions.flushDraft = async () => { throw new Error("Content conflict"); };
  await f.submit();
  assert.equal(f.calls.some((call) => call[0] === "rename"), false);
  assert.equal(f.form.hidden, false);
  assert.equal(f.state.documentBuffer.content, "notes");
  assert.equal(f.state.saving, false);

  f = fixture();
  f.actions.editDocumentName();
  f.actions.$("document-name").value = "New";
  f.actions.api = async () => { throw new Error("Name already exists"); };
  await f.submit();
  assert.equal(f.form.hidden, false);
  assert.equal(f.actions.$("document-name").value, "New");
  assert(f.form.elements.every((control) => !control.disabled));

  f = fixture();
  f.actions.$("rename-name").value = "New";
  await f.actions.renameItem({ preventDefault() {}, target: { elements: [] } });
  assert.equal(f.calls[0][0], "rename", "Existing modal must keep the same shared rename handler");
  console.log("Inline rename checks passed: explicit save, cancel, validation, content flush, navigation, errors, existing modal");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
