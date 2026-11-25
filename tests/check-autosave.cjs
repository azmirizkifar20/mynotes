const assert = require("node:assert/strict");
const { loadFrontend } = require("./helpers/frontend.cjs");

async function main() {
  const { drafts, editor } = await loadFrontend({
    drafts: "features/editor/drafts.js",
    editor: "features/editor/controller.js",
  });
  const timers = new Map();
  let timerId = 0;
  global.setTimeout = (callback, delay) => {
    timers.set(++timerId, { callback, delay });
    return timerId;
  };
  global.clearTimeout = (id) => timers.delete(id);
  const runTimer = () => {
    assert.equal(timers.size, 1);
    const [id, timer] = [...timers][0];
    timers.delete(id);
    return timer.callback();
  };
  function fixture(onSave) {
    timers.clear();
    const page = { id: "doc", path: "/Note.md", title: "Note", body: "old", revision: 1 };
    const state = {
      current: page.id, pages: [page], documentBuffer: { id: page.id, content: "new" },
      draftState: { id: page.id, content: page.body, token: null, resolved: true, conflict: false },
      draftRequest: null, navigationSequence: 0, saving: false,
    };
    const elements = new Map();
    const calls = [], notices = [];
    let mounts = 0;
    const actions = {
      $(id) {
        if (!elements.has(id)) elements.set(id, { textContent: "", close() {} });
        return elements.get(id);
      },
      documentContent: () => state.documentBuffer.content,
      syncDocumentSave() {}, syncEditorLock() {}, animateStatus(node, message) { node.textContent = message; }, dateLabel: (value) => value,
      notify: (message) => notices.push(message), renderDoc() { mounts++; },
      async api(endpoint, body) {
        calls.push({ endpoint, ...body });
        if (endpoint === "draft") return { token: "draft-token" };
        assert.equal(endpoint, "save");
        await onSave?.(body);
        return { html: body.content, modified: "today", revision: page.revision + 1 };
      },
    };
    const controller = editor.createFeature({ state, actions });
    actions.isDirty = controller.isDirty;
    Object.assign(actions, drafts.createFeature({ state, actions }));
    return { state, page, actions, controller, calls, notices, elements, mounts: () => mounts };
  }

  let f = fixture();
  f.actions.scheduleDraft();
  assert.equal([...timers.values()][0].delay, 1000);
  await runTimer();
  assert.deepEqual(f.calls.map((call) => call.endpoint), ["draft", "save"]);
  assert.equal(f.calls[1].draftToken, "draft-token");
  assert.equal(f.page.body, "new");
  assert.equal(f.page.revision, 2);
  assert.equal(f.state.draftState.token, null);
  assert.equal(f.actions.isDirty(), false);
  assert.equal(f.mounts(), 0, "Background saves must preserve the editor and caret");
  assert.equal(f.elements.get("document-save-state").textContent, "Semua perubahan tersimpan");
  assert.equal(f.elements.get("document-revision").textContent, "Note.md · Versi 2");
  await f.actions.flushDraft();
  assert.equal(f.calls.length, 2, "Unchanged content must not create another version");

  let release, started;
  const waiting = new Promise((resolve) => { release = resolve; });
  const saving = new Promise((resolve) => { started = resolve; });
  f = fixture(async (body) => { if (body.content === "new") { started(); await waiting; } });
  const first = f.actions.flushDraft();
  await saving;
  f.state.documentBuffer.content = "newest";
  f.actions.scheduleDraft();
  const second = runTimer();
  release();
  await Promise.all([first, second]);
  assert.deepEqual(f.calls.filter((call) => call.endpoint === "save").map((call) => [call.content, call.revision]), [["new", 1], ["newest", 2]]);
  assert.equal(f.page.body, "newest");
  assert.equal(f.state.documentBuffer.content, "newest");
  assert.equal(f.state.saving, false);
  assert.equal(f.mounts(), 0);

  let attempts = 0;
  f = fixture(() => { if (!attempts++) throw new TypeError("Network unavailable"); });
  await assert.rejects(f.actions.flushDraft(), /Network unavailable/);
  assert.equal(f.page.body, "old");
  assert.equal(f.state.draftState.token, "draft-token");
  assert.equal([...timers.values()][0].delay, 5000);
  await runTimer();
  assert.deepEqual(f.calls.map((call) => call.endpoint), ["draft", "save", "save"]);
  assert.equal(f.page.body, "new");

  f = fixture(() => { throw Object.assign(new Error("Conflict"), { status: 409 }); });
  await assert.rejects(f.actions.flushDraft(), /Conflict/);
  assert.equal(f.state.draftState.conflict, true);
  assert.equal(f.state.documentBuffer.content, "new");
  assert.equal(timers.size, 0);
  await assert.rejects(f.actions.flushDraft(), /Periksa draft/);
  assert.equal(f.calls.length, 2);

  f = fixture(() => { throw Object.assign(new Error("Login required"), { status: 401 }); });
  await assert.rejects(f.actions.flushDraft(), /Login required/);
  assert.equal(f.state.draftState.token, "draft-token");
  assert.equal(f.state.documentBuffer.content, "new");
  assert.equal(timers.size, 0, "Authentication failures must wait for login");

  f = fixture();
  f.state.draftState.content = "recovered";
  f.state.draftState.token = "recovery-token";
  f.state.draftState.resolved = false;
  f.actions.recoverDraft();
  await runTimer();
  assert.deepEqual(f.calls.map((call) => call.endpoint), ["save"]);
  assert.equal(f.page.body, "recovered");

  f = fixture();
  await f.controller.saveDoc();
  assert.deepEqual(f.calls.map((call) => call.endpoint), ["draft", "save"]);
  assert.equal(f.state.saving, false);
  assert.equal(f.mounts(), 0);
  console.log("Autosave checks passed: debounce, publish, serialization, retry, conflicts, recovery, manual save");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
