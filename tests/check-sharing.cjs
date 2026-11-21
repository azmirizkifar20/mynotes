const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { spawn, execFileSync } = require("node:child_process");
const { once } = require("node:events");
const { setTimeout: delay } = require("node:timers/promises");
const { Client } = require("pg");
const config = require("../src/backend/database/config");
const { loadFrontend } = require("./helpers/frontend.cjs");

// A generated database keeps this check away from the shared workspace.
const name = "mdpreview_check_" + randomUUID().replace(/-/g, "");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "mdpreview-check-"));
const root = path.resolve(__dirname, "..");
let db,
  server,
  admin,
  created = false;
async function main() {
  global.location = { pathname: "/", search: "" };
  global.localStorage = { getItem: () => null };
  const modules = await loadFrontend({
    state: "core/state.js",
    search: "features/search.js",
    management: "features/management/pages.js",
    navigation: "core/navigation.js",
    live: "features/editor/live-editor.js",
    events: "core/events.js",
  });
  const state = modules.state.createState({});
  const actions = {
    escape: (value) =>
      String(value).replace(
        /[&<>"']/g,
        (char) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[char],
      ),
  };
  Object.assign(
    actions,
    modules.search.createFeature({ state, actions }),
    modules.management.createFeature({ state, actions }),
    modules.navigation.createFeature({ state, actions }),
  );
  assert.equal(
    actions.highlightSearch("GIMMICK_REQUEST", "gimmick_request"),
    "<mark>GIMMICK_REQUEST</mark>",
  );
  assert.equal(
    actions.highlightSearch("gimmick and request", "gimmick_request"),
    "<mark>gimmick</mark> and <mark>request</mark>",
  );
  const highlighted = actions.highlightSearch('<img onerror="boom"> a+b', "a+b");
  assert.equal(
    highlighted.replace(/<\/?mark>/g, ""),
    "&lt;img onerror=&quot;boom&quot;&gt; a+b",
  );
  assert.ok(highlighted.includes("<mark>a+b</mark>"));
  const managementNodes = Object.fromEntries(
    [
      "main",
      "outline",
      "management-content",
      "management-error",
      "tool-dialog",
    ].map((id) => [id, { innerHTML: "", textContent: "", open: false }]),
  );
  Object.assign(actions, {
    $: (id) => managementNodes[id],
    icon: () => "",
    api: async () => ({ items: [] }),
  });
  for (const [view, title] of [
    ["trash", "Sampah"],
    ["templates", "Template"],
    ["activity", "Aktivitas"],
  ]) {
    state.current = view;
    location.search = "?view=" + view;
    assert.equal(actions.requestedView(), view);
    await actions.renderManagementPage(view);
    assert.ok(
      managementNodes.main.innerHTML.includes("<h1>" + title + "</h1>"),
    );
    assert.equal(managementNodes["tool-dialog"].open, false);
  }
  location.search = "?view=constructor";
  assert.equal(actions.requestedView(), null);
  actions.api = async () => {
    throw new Error("Offline");
  };
  await actions.renderManagementPage("activity");
  assert.equal(managementNodes["management-error"].textContent, "Offline");
  assert.match(managementNodes["management-content"].innerHTML, /Coba lagi/);
  const liveState = {
    current: "note",
    pages: [{ id: "note", body: "# Original" }],
    editing: false,
    saving: false,
    documentBuffer: { id: "note", content: "# Original" },
  };
  const liveActions = { $: () => null, scheduleDraft: () => {} };
  Object.assign(
    liveActions,
    modules.live.createFeature({ state: liveState, actions: liveActions }),
  );
  liveActions.changeDocumentContent("# Inline edit");
  assert.equal(liveActions.documentContent(), "# Inline edit");
  liveState.editing = true;
  liveActions.changeDocumentContent("# Markdown edit");
  assert.equal(liveActions.documentContent(), "# Markdown edit");
  Object.assign(liveState, {
    editing: false,
    liveEditor: { getValue: () => "# Latest keystroke" },
    liveEditorReady: true,
    liveEditorTouched: true,
  });
  assert.equal(liveActions.documentContent(), "# Latest keystroke");
  liveState.current = "other";
  liveActions.changeDocumentContent("# Wrong document");
  assert.equal(liveState.documentBuffer.content, "# Latest keystroke");
  const listeners = {},
    dispatched = [],
    submissions = [];
  global.document = {
    addEventListener: (type, listener) => {
      listeners[type] = listener;
    },
  };
  modules.events.bindActions({
    state: { current: "note" },
    actions: {
      navigate: (...args) => dispatched.push(args),
      authenticate: (event) => submissions.push(event),
      notify: (message) => {
        throw new Error(message);
      },
    },
  });
  const actionButton = {
    dataset: { action: "navigate", state: "current" },
    closest: () => null,
  };
  const click = {
    target: { closest: () => actionButton },
    preventDefault() {},
  };
  listeners.click(click);
  await Promise.resolve();
  assert.deepEqual(dispatched, [["note"]]);
  actionButton.closest = () => ({});
  listeners.click(click);
  await Promise.resolve();
  assert.equal(
    dispatched.length,
    1,
    "Document HTML must not dispatch app actions",
  );
  actionButton.closest = () => null;
  actionButton.disabled = true;
  listeners.click(click);
  await Promise.resolve();
  assert.equal(dispatched.length, 1, "Disabled controls must not dispatch");
  const form = { dataset: { submit: "authenticate" }, closest: () => null };
  const submit = { target: { closest: () => form }, preventDefault() {} };
  listeners.submit(submit);
  await Promise.resolve();
  assert.deepEqual(submissions, [submit]);
  admin = new Client(config("postgres"));
  await admin.connect();
  assert.match(name, /^mdpreview_check_[a-f0-9]{32}$/);
  assert.notEqual(name, process.env.DB_NAME);
  const { validPath } = require("../src/backend/modules/documents/paths");
  assert.equal(validPath("/CON.md"), false);
  assert.equal(validPath("/../secret.md"), false);
  await admin.query('CREATE DATABASE "' + name + '"');
  created = true;
  process.env.DB_NAME = name;
  db = require("../src/backend/database");
  const snapshot = path.join(temporary, "snapshot");
  fs.mkdirSync(path.join(snapshot, "docs", "Projects"), { recursive: true });
  fs.writeFileSync(
    path.join(snapshot, "docs", "Public.md"),
    "# Public\n\n![image](image.png)",
  );
  fs.writeFileSync(
    path.join(snapshot, "docs", "Private.md"),
    "# Private secret",
  );
  fs.writeFileSync(
    path.join(snapshot, "docs", "Search.md"),
    "# Search\n\n" +
      "Opening words. ".repeat(100) +
      "Use gimmick_request to create a new request.",
  );
  fs.writeFileSync(
    path.join(snapshot, "docs", "image.png"),
    Buffer.from("89504e470d0a1a0a", "hex"),
  );
  const share = "a".repeat(48);
  fs.writeFileSync(
    path.join(snapshot, "file-access.json"),
    JSON.stringify({ "/Private.md": { id: share, visibility: "private" } }),
  );
  execFileSync(
    process.execPath,
    [
      path.join(root, "scripts/import-server-docs.js"),
      "--server-snapshot",
      snapshot,
    ],
    { cwd: root, env: process.env, windowsHide: true, stdio: "pipe" },
  );
  assert.equal((await db.get("/Private.md")).visibility, "private");
  assert.equal((await db.get("/Private.md")).share_id, share);
  assert.equal((await db.get("/Public.md")).visibility, "public");
  await db.createFolder("/projects/Sub");
  assert.equal((await db.get("/projects/sub")).path, "/Projects/Sub");
  const row = await db.save("/projects/sub/Note.md", "# First", {
    create: true,
  });
  assert.equal(row.path, "/Projects/Sub/Note.md");
  assert.equal(row.visibility, "private");
  await assert.rejects(
    db.save(row.path, "# Stale", { revision: 0 }),
    (error) => error.status === 409,
  );
  const token = randomUUID();
  await db.query(
    "INSERT INTO mdpreview.drafts(entry_id,content,base_revision,token) VALUES($1,$2,1,$3)",
    [row.id, "# Draft", token],
  );
  await assert.rejects(
    db.save(row.path, "# Unsafe", { revision: 1 }),
    (error) => error.status === 409,
  );
  const saved = await db.save(row.path, "# Second", {
    revision: 1,
    draftToken: token,
  });
  assert.equal(saved.revision, 2);
  assert.equal(
    (
      await db.query("SELECT 1 FROM mdpreview.drafts WHERE entry_id=$1", [
        row.id,
      ])
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await db.query("SELECT 1 FROM mdpreview.versions WHERE entry_id=$1", [
        row.id,
      ])
    ).rowCount,
    2,
  );
  await db.move("/projects/sub", "/projects/Moved");
  assert.equal((await db.get("/Projects/Moved/Note.md")).id, row.id);
  await db.trash("/Projects/Moved", true);
  await assert.rejects(
    db.get("/Projects/Moved/Note.md"),
    (error) => error.status === 404,
  );
  const group = (
    await db.query("SELECT trash_id FROM mdpreview.entries WHERE id=$1", [
      row.id,
    ])
  ).rows[0].trash_id;
  await db.restoreTrash(group, false);
  assert.equal((await db.get("/Projects/Moved/Note.md")).revision, 2);
  await assert.rejects(
    db.save("/Projects/Invalid.md", "NUL\0", { create: true }),
    (error) => error.status === 400,
  );

  const appRoot = path.join(temporary, "app");
  fs.mkdirSync(appRoot);
  for (const file of ["server.js", "src"])
    fs.cpSync(path.join(root, file), path.join(appRoot, file), {
      recursive: true,
    });
  fs.mkdirSync(path.join(appRoot, "docs"));
  const port = 18000 + Math.floor(Math.random() * 10000),
    base = "http://localhost:" + port;
  const code = randomUUID(),
    hash = await require("bcrypt").hash(code, 4),
    sessionSecret = randomUUID();
  process.env.PASSKEY_AUTH_URL = base;
  process.env.PASSKEY_APP_URLS = base + "," + base + "/mynotes";
  const authStore = require("../src/backend/modules/auth/store");
  const authSettings = await authStore.settings();
  const passkeyId = randomUUID().replace(/-/g, "");
  await db.query(
    "INSERT INTO mdpreview.passkeys(id,rp_id,public_key,name,device_type,backed_up) VALUES($1,$2,$3,$4,$5,$6)",
    [
      passkeyId,
      "localhost",
      Buffer.from([1]),
      "Isolated API fixture",
      "singleDevice",
      false,
    ],
  );
  const request = {
    protocol: "http",
    method: "POST",
    baseUrl: "",
    sessionID: randomUUID(),
    session: { cookie: { path: "/" } },
    body: {},
    get: (name) => (name === "host" ? new URL(base).host : base),
  };
  const challenge = await authStore.challenge(request, "authentication", {
    challenge: randomUUID(),
  });
  request.body.challengeId = challenge.challengeId;
  await assert.rejects(
    authStore.consumeChallenge(
      { ...request, sessionID: randomUUID() },
      "authentication",
    ),
    (error) => error.status === 400,
  );
  await assert.rejects(authStore.consumeChallenge(request, "registration"));
  await assert.rejects(authStore.consumeChallenge({ ...request, baseUrl: "/mynotes" }, "authentication"));
  await authStore.consumeChallenge(request, "authentication");
  await assert.rejects(
    authStore.consumeChallenge(request, "authentication"),
    (error) => error.status === 400,
  );
  const expired = await authStore.challenge(request, "authentication", { challenge: randomUUID() });
  await db.query("UPDATE mdpreview.auth_challenges SET expires_at=now()-interval '1 second' WHERE id=$1", [expired.challengeId]);
  await assert.rejects(authStore.consumeChallenge({ ...request, body: { challengeId: expired.challengeId } }, "authentication"));
  const bridgeService = require("../src/backend/modules/auth/passkeys");
  request.baseUrl = "/mynotes";
  const bridge = await bridgeService.startBridge(request);
  request.body = { token: bridge.token };
  await assert.rejects(bridgeService.claimBridge(request));
  const completion = authStore.hash(randomUUID());
  request.body.completion = completion;
  await assert.rejects(bridgeService.claimBridge(request));
  await assert.rejects(
    bridgeService.claimBridge({ ...request, sessionID: randomUUID() }),
    (error) => error.status === 400,
  );
  await db.query(
    "UPDATE mdpreview.auth_bridges SET passkey_id=$2,completion_hash=$3 WHERE token_hash=$1",
    [authStore.hash(bridge.token), passkeyId, authStore.hash(completion)],
  );
  await assert.rejects(bridgeService.claimBridge({
    ...request, body: { token: bridge.token },
  }), "A relayed request token cannot claim approval without the completion secret");
  await assert.rejects(bridgeService.claimBridge({
    ...request, body: { token: bridge.token, completion: authStore.hash(randomUUID()) },
  }));
  await assert.rejects(bridgeService.claimBridge({ ...request, sessionID: randomUUID() }));
  await assert.rejects(bridgeService.claimBridge({ ...request, baseUrl: "" }));
  assert.equal(await bridgeService.claimBridge(request), passkeyId);
  await assert.rejects(
    bridgeService.claimBridge(request),
    (error) => error.status === 400,
  );
  server = spawn(process.execPath, ["server.js"], {
    cwd: appRoot,
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "development",
      NODE_PATH: path.join(root, "node_modules"),
      ACCESS_CODE_HASH: hash,
      SESSION_SECRET: sessionSecret,
    },
    stdio: "ignore",
  });
  let online = false;
  for (let i = 0; i < 200; i++) {
    if (server.exitCode !== null)
      throw new Error("Isolated app failed to start");
    try {
      if ((await fetch(base)).ok) {
        online = true;
        break;
      }
    } catch {}
    await delay(50);
  }
  assert.ok(online);
  for (const prefix of ["", "/mynotes"]) {
    const publicPage = await (await fetch(base + prefix + "/Public.md")).text();
    assert.match(publicPage, /"mode":"public"/);
    assert.ok(publicPage.includes(prefix + "/static/v/"));
    assert.ok(publicPage.includes("/css/main.css"));
    assert.ok(publicPage.includes("/js/main.js"));
    assert.match(publicPage, /media\?/);
    const privatePage = await (
      await fetch(base + prefix + "/Private.md")
    ).text();
    assert.match(privatePage, /"mode":"login"/);
    assert.doesNotMatch(privatePage, /Private secret/);
    assert.equal((await fetch(base + prefix + "/share/" + share)).status, 404);
    assert.equal((await fetch(base + prefix + "/api/workspace")).status, 401);
    for (const endpoint of ["search?q=secret", "trash", "templates", "activity", "passkeys"])
      assert.equal((await fetch(base + prefix + "/api/" + endpoint)).status, 401);
    for (const endpoint of ["raw", "document", "history", "history/preview", "draft/read", "share", "save", "delete"])
      assert.equal((await fetch(base + prefix + "/api/" + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: "/Private.md" }),
      })).status, 401);
    assert.equal((await fetch(base + prefix + "/media?document=%2FPrivate.md&file=%2Fimage.png")).status, 404);
    assert.equal((await fetch(base + prefix + "/media?document=%2FPublic.md&file=%2Fimage.png")).status, 200);
    const login = await fetch(base + prefix + "/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    assert.equal(login.status, 410);
    // The API regression fixture owns its isolated DB; passkey ceremonies are checked separately.
    const sid = randomUUID(),
      expires = new Date(Date.now() + 1800000);
    await db.query(
      "INSERT INTO mdpreview.sessions(sid,sess,expire) VALUES($1,$2,$3)",
      [
        sid,
        JSON.stringify({
          cookie: {
            path: prefix || "/",
            expires: expires.toISOString(),
            httpOnly: true,
            originalMaxAge: 1800000,
          },
          authenticated: true,
          authMethod: "passkey",
          authAt: Date.now(),
          passkeyId,
          authGeneration: authSettings.auth_generation,
        }),
        expires,
      ],
    );
    const cookie =
      "mdprev.sid=" +
      encodeURIComponent(
        "s:" + require("cookie-signature").sign(sid, sessionSecret),
      );
    const workspace = await (
      await fetch(base + prefix + "/api/workspace", {
        headers: { Cookie: cookie },
      })
    ).json();
    assert.ok(workspace.success);
    assert.ok(workspace.pages.some((page) => page.id === row.id));
    const editablePage = await (
      await fetch(base + prefix + "/Public.md", { headers: { Cookie: cookie } })
    ).text();
    const editorVersion = require("vditor/package.json").version;
    assert.ok(
      editablePage.includes(
        prefix + "/static/editor/" + editorVersion + "/dist/index.min.js",
      ),
    );
    assert.ok(editablePage.includes(prefix + "/static/v/"));
    assert.ok(!publicPage.includes("/dist/index.min.js"));
    for (const asset of [
      "index.min.js",
      "index.css",
      "js/lute/lute.min.js",
      "js/i18n/en_US.js",
    ])
      assert.equal(
        (
          await fetch(
            base +
              prefix +
              "/static/editor/" +
              editorVersion +
              "/dist/" +
              asset,
          )
        ).status,
        200,
      );
    const search = await (
      await fetch(base + prefix + "/api/search?q=gimmick_request", {
        headers: { Cookie: cookie },
      })
    ).json();
    assert.ok(search.success);
    assert.match(
      search.items.find((item) => item.path === "/Search.md").snippet,
      /gimmick_request/,
    );
    const publicEntry = await db.get("/Public.md");
    const publicLink = base + prefix + "/share/" + publicEntry.share_id;
    assert.equal((await fetch(publicLink)).status, 200);
    await db.query(
      "INSERT INTO mdpreview.drafts(entry_id,content,base_revision,token) VALUES($1,$2,$3,$4) ON CONFLICT(entry_id) DO UPDATE SET content=excluded.content,token=excluded.token",
      [publicEntry.id, "Unpublished draft secret", publicEntry.revision, randomUUID()],
    );
    assert.doesNotMatch(await (await fetch(base + prefix + "/Public.md")).text(), /Unpublished draft secret/);
    const setVisibility = async (visibility) => {
      const response = await fetch(base + prefix + "/api/share", {
        method: "POST",
        headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: "/Public.md", visibility }),
      });
      assert.equal(response.status, 200);
    };
    await setVisibility("private");
    assert.equal((await fetch(publicLink)).status, 404);
    assert.equal((await fetch(base + prefix + "/media?document=%2FPublic.md&file=%2Fimage.png")).status, 404);
    const hiddenPage = await (await fetch(base + prefix + "/Public.md")).text();
    assert.match(hiddenPage, /"mode":"login"/);
    assert.doesNotMatch(hiddenPage, /"content":"# Public/);
    await setVisibility("public");
    assert.equal((await fetch(publicLink)).status, 200);
    assert.equal((await fetch(base + prefix + "/api/passkeys/delete", {
      method: "POST",
      headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ id: passkeyId, confirm: true }),
    })).status, 409, "The final credential must not be removed");
    await db.query("UPDATE mdpreview.sessions SET sess=jsonb_set(sess::jsonb,'{authAt}',$2::jsonb) WHERE sid=$1", [sid, JSON.stringify(Date.now() - 6 * 60 * 1000)]);
    assert.equal((await fetch(base + prefix + "/api/passkeys/rename", {
      method: "POST",
      headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ id: passkeyId, name: "Must require verification" }),
    })).status, 403);
    if (prefix === "/mynotes") {
      await db.query(
        "INSERT INTO mdpreview.passkeys(id,rp_id,public_key,name,device_type,backed_up) VALUES($1,'localhost',$2,'Spare fixture','singleDevice',false)",
        [randomUUID().replace(/-/g, ""), Buffer.from([1])],
      );
      await db.query("UPDATE mdpreview.sessions SET sess=jsonb_set(sess::jsonb,'{authAt}',$2::jsonb) WHERE sid=$1", [sid, JSON.stringify(Date.now())]);
      assert.equal((await fetch(base + prefix + "/api/passkeys/delete", {
        method: "POST",
        headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify({ id: passkeyId, confirm: true }),
      })).status, 200);
      assert.equal((await fetch(base + prefix + "/api/workspace", { headers: { Cookie: cookie } })).status, 401);
    }
  }
  console.log("Isolated PostgreSQL workspace checks passed.");
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server && server.exitCode === null) {
      server.kill();
      await once(server, "exit");
    }
    if (db) await db.pool.end();
    if (created) {
      assert.match(name, /^mdpreview_check_[a-f0-9]{32}$/);
      await admin.query('DROP DATABASE "' + name + '" WITH (FORCE)');
    }
    if (admin) await admin.end();
    fs.rmSync(temporary, { recursive: true, force: true });
  });
