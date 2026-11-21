const assert = require("node:assert/strict");
const { loadFrontend } = require("./helpers/frontend.cjs");

async function main() {
  const { editor, live } = await loadFrontend({
    editor: "features/editor/controller.js",
    live: "features/editor/live-editor.js",
  });
  const listeners = new Map();
  const frames = new Map();
  let frameId = 0;
  global.requestAnimationFrame = (callback) => {
    frames.set(++frameId, callback);
    return frameId;
  };
  global.cancelAnimationFrame = (id) => frames.delete(id);
  const flush = () => {
    for (const [id, callback] of [...frames]) {
      frames.delete(id);
      callback();
    }
  };
  global.window = {
    scrollY: 0, innerHeight: 600,
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) {
      if (listeners.get(type) === callback) listeners.delete(type);
    },
    scrollTo({ top }) { this.scrollY = Math.max(0, Math.min(top, 1900)); },
  };
  global.location = { pathname: "/mynotes/Note.md", search: "?view=doc" };
  global.history = { state: { id: "doc" }, replaceState(state, title, url) { this.url = url; } };
  global.document = {
    documentElement: { scrollHeight: 2500 },
    querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 57 }) }),
  };
  const outline = {
    scrollTop: 0,
    querySelectorAll: () => links,
    getBoundingClientRect: () => ({ top: 20, bottom: 120 }),
    addEventListener(type, callback) { this.click = callback; },
    removeEventListener(type, callback) { if (this.click === callback) this.click = null; },
  };
  const headings = [100, 900, 1600].map((top) => ({
    getBoundingClientRect: () => ({ top: top - window.scrollY }),
  }));
  let links = headings.map((heading, index) => ({
    attributes: {},
    getAttribute(name) { return name === "href" ? "#section-" + index : this.attributes[name]; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    closest() { return this; },
    getBoundingClientRect() { const top = 30 + index * 40 - outline.scrollTop; return { top, bottom: top + 40 }; },
  }));
  const actions = { $: (id) => id === "outline" ? outline : null };
  Object.assign(actions, editor.createFeature({ state: {}, actions }));
  assert.equal(typeof actions.trackOutline, "function", "Outline needs active-heading tracking");
  actions.trackOutline(headings);
  const active = () => links.findIndex((link) => link.getAttribute("aria-current") === "location");
  assert.equal(active(), 0);
  window.scrollY = 950;
  listeners.get("scroll")();
  listeners.get("scroll")();
  assert.equal(frames.size, 1, "Scroll work is coalesced into one animation frame");
  flush();
  assert.equal(active(), 1);
  assert.equal(links[0].getAttribute("aria-current"), undefined);
  window.scrollY = 400;
  listeners.get("scroll")();
  flush();
  assert.equal(active(), 0, "Scrolling up restores the earlier section");
  const event = { target: links[2], button: 0, preventDefault() { this.prevented = true; } };
  outline.click(event);
  assert.equal(event.prevented, true);
  assert.equal(window.scrollY, 1527, "Clicked heading clears the sticky header");
  assert.equal(active(), 2);
  assert.equal(history.url, "/mynotes/Note.md?view=doc#section-2");
  assert.ok(outline.scrollTop > 0, "The active item stays visible inside the outline");
  listeners.get("scroll")();
  flush();
  assert.equal(active(), 2);
  const modified = { ...event, ctrlKey: true, prevented: false };
  outline.click(modified);
  assert.equal(modified.prevented, false, "Modified link clicks keep browser behavior");
  window.scrollY = 1900;
  listeners.get("scroll")();
  flush();
  assert.equal(active(), 2, "The final section is active at the document bottom");
  window.scrollY = 400;
  listeners.get("resize")();
  flush();
  assert.equal(active(), 0, "Resizing recalculates the active heading");
  actions.trackOutline([headings[0]]);
  assert.equal(active(), 0, "Rebuilding the outline replaces the previous heading map");
  listeners.get("scroll")();
  actions.trackOutline([]);
  assert.equal(listeners.size, 0);
  assert.equal(frames.size, 0);
  assert.equal(outline.click, null);

  let tracked;
  const state = { liveEditorReady: true, liveEditorGeneration: 0, liveEditor: { destroy() {} } };
  const liveHeadings = [{ textContent: "First section" }, { textContent: "First section" }];
  document.createElement = () => ({});
  outline.append = () => {};
  const liveActions = {
    $: (id) => id === "outline" ? outline : { querySelectorAll: () => liveHeadings },
    trackOutline(items) { tracked = items; },
  };
  const feature = live.createFeature({ state, actions: liveActions });
  feature.refreshLiveOutline();
  assert.deepEqual(tracked, liveHeadings, "Live editor refreshes the same heading tracker");
  feature.destroyLiveEditor();
  assert.deepEqual(tracked, [], "Leaving the editor releases the tracker");
  console.log("Outline click/scroll, header offset, active visibility, refresh and cleanup checks passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
