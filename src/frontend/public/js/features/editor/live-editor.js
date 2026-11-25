import { decorateUnderline, underlineSelection } from "./underline.js";

export function createFeature({ state, actions }) {
  function documentContent() {
    if (
      state.documentBuffer?.id === state.current &&
      state.liveEditorReady &&
      state.liveEditorTouched &&
      !state.editing
    )
      state.documentBuffer.content = state.liveEditor.getValue();
    return state.documentBuffer?.id === state.current
      ? state.documentBuffer.content
      : state.pages.find((page) => page.id === state.current)?.body || "";
  }

  function changeDocumentContent(content) {
    if (state.documentBuffer?.id !== state.current || state.saving) return;
    state.documentBuffer.content = content;
    actions.scheduleDraft();
    syncDocumentSave();
  }

  function syncDocumentSave() {
    const button = actions.$("save-document");
    if (button)
      button.disabled =
        state.saving ||
        state.imageUploading ||
        Boolean(state.draftRequest) ||
        !actions.isDirty() ||
        !state.draftState?.resolved ||
        state.draftState.conflict;
  }

  function syncEditorLock() {
    const enabled =
      !state.saving &&
      !state.imageUploading &&
      state.draftState?.id === state.current &&
      state.draftState.resolved &&
      !state.draftState.conflict;
    if (state.liveEditorReady)
      enabled ? state.liveEditor.enable() : state.liveEditor.disabled();
    if (!enabled) actions.closeDocumentMenu?.();
    if (actions.$("markdown-editor"))
      actions.$("markdown-editor").readOnly = !enabled;
    syncDocumentSave();
  }

  function destroyLiveEditor() {
    actions.destroyDocumentMenu?.();
    actions.hideDocumentSelection?.();
    globalThis.CSS?.highlights?.delete("markdown-underline");
    actions.trackOutline([]);
    state.liveEditorGeneration++;
    if (state.liveEditorReady) state.liveEditor.destroy();
    state.liveEditor = null;
    state.liveEditorReady = false;
    state.liveEditorTouched = false;
  }

  function mountLiveEditor(page) {
    const element = actions.$("live-editor");
    if (!element) return;
    if (typeof Vditor === "undefined") {
      element.setAttribute("aria-busy", "false");
      actions.notify(
        "Editor langsung belum dapat dimuat. Gunakan tab Markdown.",
      );
      return;
    }
    const generation = state.liveEditorGeneration;
    let instance;
    try {
      instance = new Vditor(element, {
        cdn: actions.appUrl("/static/editor/" + state.boot.editorVersion),
        lang: "en_US",
        mode: "ir",
        value: documentContent(),
        theme:
          document.documentElement.dataset.theme === "dark"
            ? "dark"
            : "classic",
        cache: { enable: false },
        toolbar: ["bold", "italic", "headings", "link", "inline-code", "outdent", "indent"],
        toolbarConfig: { hide: true },
        minHeight: 250,
        height: "auto",
        placeholder: "Tulis catatan di sini…",
        preview: {
          markdown: { sanitize: true, autoSpace: false, fixTermTypo: false },
          hljs: { enable: false },
          render: { media: { enable: false } },
          maxWidth: 100000,
        },
        input: (content) => {
          if (
            generation !== state.liveEditorGeneration ||
            !state.liveEditorReady ||
            !state.liveEditorTouched ||
            !state.draftState?.resolved ||
            state.draftState.conflict
          )
            return;
          changeDocumentContent(content);
          queueMicrotask(refreshLiveOutline);
        },
        after: () =>
          queueMicrotask(() => {
            if (
              generation !== state.liveEditorGeneration ||
              state.current !== page.id ||
              state.editing
            ) {
              instance.destroy();
              return;
            }
            state.liveEditorReady = true;
            element.setAttribute("aria-busy", "false");
            syncEditorLock();
            refreshLiveOutline();
            actions.scrollToHash();
            actions.mountDocumentMenu?.();
          }),
      });
      state.liveEditor = instance;
      element.addEventListener("keydown", (event) => {
        if (actions.handleDocumentMenuKey?.(event)) return;
        if (
          generation !== state.liveEditorGeneration ||
          !state.liveEditorReady ||
          state.saving ||
          state.imageUploading ||
          state.draftState?.id !== state.current ||
          !state.draftState.resolved ||
          state.draftState.conflict
        )
          return;
        if (
          (event.ctrlKey || event.metaKey) &&
          !event.altKey && !event.shiftKey && !event.isComposing &&
          ["b", "i", "u", "z", "y"].includes(event.key.toLowerCase())
        )
          state.liveEditorTouched = true;
        if (
          (event.ctrlKey || event.metaKey) && !event.altKey &&
          !event.shiftKey && !event.isComposing && event.key.toLowerCase() === "u"
        ) {
          const editor = element.querySelector('.vditor-ir [contenteditable="true"]');
          const selection = document.getSelection();
          if (!editor?.contains(event.target) || !event.target.isContentEditable || !selection?.rangeCount)
            return;
          const range = selection.getRangeAt(0);
          if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return;
          event.preventDefault();
          event.stopPropagation();
          const start = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
          if (start?.closest("code, .vditor-ir__marker--pre")) return;
          underlineSelection(instance, range);
          return;
        }
        if (
          event.key !== "Tab" ||
          event.ctrlKey || event.metaKey || event.altKey || event.isComposing
        )
          return;
        const selection = document.getSelection();
        if (!selection?.rangeCount) return;
        const range = selection.getRangeAt(0);
        const start = range.startContainer.nodeType === Node.ELEMENT_NODE
          ? range.startContainer
          : range.startContainer.parentElement;
        const editor = element.querySelector('.vditor-ir [contenteditable="true"]');
        const item = start?.closest("li");
        if (
          !editor || !item || !editor.contains(item) ||
          !editor.contains(event.target) || !event.target.isContentEditable ||
          !editor.contains(range.endContainer) ||
          start.closest("table, .vditor-ir__marker--pre")
        )
          return;
        const command = element.querySelector(
          `button[data-type="${event.shiftKey ? "outdent" : "indent"}"]`,
        );
        if (!command || command.disabled || command.classList.contains("vditor-menu--disabled"))
          return;
        event.preventDefault();
        event.stopPropagation();
        state.liveEditorTouched = true;
        command.dispatchEvent(new Event(
          navigator.userAgent.includes("iPhone") ? "touchstart" : "click",
          { bubbles: true, cancelable: true },
        ));
      }, true);
      for (const event of ["input", "change"])
        element.addEventListener(event, () => {
          if (
            generation !== state.liveEditorGeneration ||
            !state.liveEditorReady ||
            state.saving ||
            !state.draftState?.resolved ||
            state.draftState.conflict
          )
            return;
          state.liveEditorTouched = true;
          changeDocumentContent(instance.getValue());
        });
    } catch {
      element.innerHTML =
        '<article class="prose">' + (page.html || "") + "</article>";
      element.setAttribute("aria-busy", "false");
      actions.notify(
        "Editor langsung belum dapat dimuat. Gunakan tab Markdown.",
      );
    }
  }

  function refreshLiveOutline() {
    if (!state.liveEditorReady || !actions.$("live-editor")) return;
    actions.decorateEditorImages?.();
    actions.decorateDocumentLinks?.();
    decorateUnderline(actions.$("live-editor"));
    actions.$("outline").innerHTML =
      '<div class="outline-title">DI HALAMAN INI</div>';
    const slugs = new Set();
    const headings = actions
      .$("live-editor")
      .querySelectorAll("h1,h2,h3,h4,h5,h6");
    headings.forEach((heading) => {
      const text = heading.textContent.replace(/^#+\s*/, "");
      const base =
        text
          .normalize("NFKD")
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-|-$/g, "") || "section";
      let slug = base,
        count = 1;
      while (slugs.has(slug)) slug = base + "-" + count++;
      slugs.add(slug);
      const link = document.createElement("a");
      link.href = "#" + slug;
      link.textContent = text;
      actions.$("outline").append(link);
    });
    actions.trackOutline(headings);
  }
  return {
    documentContent,
    changeDocumentContent,
    syncDocumentSave,
    syncEditorLock,
    destroyLiveEditor,
    mountLiveEditor,
    refreshLiveOutline,
  };
}
