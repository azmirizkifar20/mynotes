const assert = require("node:assert/strict");
const { loadFrontend } = require("./helpers/frontend.cjs");

async function main() {
  const { auth, editor, dom } = await loadFrontend({
    auth: "features/auth.js", editor: "features/editor/controller.js", dom: "core/dom.js",
  });
  const ui = { "access-page": {}, "visitor-theme": {}, outline: {} };
  const state = {
    boot: { mode: "public", document: { title: '<Public "note">', html: "<h2 id=section>Section</h2>" } },
    basePath: "/mynotes", themePreference: "dark",
  };
  const actions = { $: (id) => ui[id], icon: () => "", dateLabel: () => "today" };
  const helpers = dom.createFeature({ state, actions });
  Object.assign(actions, { escape: helpers.escape, appUrl: helpers.appUrl });
  let headerBottom = 50;
  const listeners = new Map(), frames = new Map();
  let frame = 0;
  global.requestAnimationFrame = (callback) => { frames.set(++frame, callback); return frame; };
  global.cancelAnimationFrame = (id) => frames.delete(id);
  global.window = {
    scrollY: 0, innerHeight: 600,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    scrollTo({ top }) { this.scrollY = top; },
  };
  global.location = { pathname: "/mynotes/Public.md", search: "?view=guest" };
  global.history = { state: null, replaceState(state, title, url) { this.url = url; } };
  global.document = {
    documentElement: { scrollHeight: 3000 },
    querySelector() { return { getBoundingClientRect: () => ({ bottom: headerBottom }) }; },
    createElement(tag) { return { tag, setAttribute() {}, addEventListener() {} }; },
  };
  auth.createFeature({ state, actions }).renderAccessPage();
  assert.match(ui["access-page"].innerHTML, /class="public-layout"/);
  assert.match(ui["access-page"].innerHTML, /id="public-outline" aria-label="Daftar isi dokumen"/);
  assert.match(ui["access-page"].innerHTML, /&lt;Public &quot;note&quot;&gt;/);
  assert.doesNotMatch(ui["access-page"].innerHTML, /document-name|renameItem|workspace-pages/);

  const links = [];
  const outline = {
    scrollTop: 0, append(link) { links.push(link); }, querySelectorAll: () => links,
    getBoundingClientRect: () => ({ top: 24, bottom: 500 }),
    addEventListener(type, fn) { this[type] = fn; }, removeEventListener(type) { delete this[type]; },
  };
  document.createElement = (tag) => ({
    tag, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; }, getAttribute(name) { return name === "href" ? this.href : this.attributes[name]; },
    closest() { return this; }, addEventListener() {},
    getBoundingClientRect: () => ({ top: 40, bottom: 70 }),
  });
  const headings = [200, 1000].map((top, index) => ({
    id: "section-" + index, textContent: "Heading " + index,
    getBoundingClientRect: () => ({ top: top - window.scrollY }), append() {},
  }));
  const controller = editor.createFeature({ state, actions });
  const count = controller.decorateHeadings({ querySelectorAll: () => headings }, true, outline);
  assert.equal(count, 2);
  assert.deepEqual(links.map((link) => [link.href, link.textContent]), [["#section-0", "Heading 0"], ["#section-1", "Heading 1"]]);
  assert.equal(links[0].attributes["aria-current"], "location");
  assert.equal(ui.outline.click, undefined, "Public tracking must target the visible public outline");
  outline.click({ button: 0, target: links[1], preventDefault() {} });
  assert.equal(window.scrollY, 934, "Click must clear the visible public header by16px");
  assert.equal(links[1].attributes["aria-current"], "location");
  assert.equal(history.url, "/mynotes/Public.md?view=guest#section-1");
  headerBottom = -100;
  outline.click({ button: 0, target: links[0], preventDefault() {} });
  assert.equal(window.scrollY, 184, "A scrolled-away public header must not produce a negative offset");
  window.scrollY = 1200;
  listeners.get("scroll")();
  for (const callback of frames.values()) callback();
  assert.equal(links[1].attributes["aria-current"], "location");
  controller.trackOutline([], outline);
  assert.equal(listeners.size, 0);
  assert.equal(controller.decorateHeadings({ querySelectorAll: () => [] }, true, outline), 0);
  console.log("Public outline checks passed: guest markup, target isolation, heading links, click/scroll, offsets, empty headings");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
