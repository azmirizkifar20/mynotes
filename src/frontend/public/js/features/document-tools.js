export function createFeature({ state, actions }) {
  let selectedRange = null;
  let selectedText = "";
  let selectionPage = null;
  let bound = false;

  function openDocumentProperties() {
    const page = state.pages.find(page => page.id === state.current);
    if (!page || !["doc", "pdf"].includes(page.type)) return;
    actions.tool("Properti dokumen", `<div class="document-property-list"><section><h3>Path dokumen</h3><p>docs${actions.escape(page.path)}</p></section><section><h3>Akses</h3><p>${page.visibility === "public" ? "Publik" : "Privat"}</p></section><section><h3>Jenis</h3><p>${page.type === "pdf" ? "Dokumen PDF" : "Markdown"} · Diperbarui ${actions.escape(actions.dateLabel(page.modified))}</p></section>${page.description ? `<section><h3>Deskripsi</h3><p>${actions.escape(page.description)}</p></section>` : ""}</div><div class="tool-actions"><button class="small-button" data-action="closeDialog" data-arg="tool-dialog">Tutup</button></div>`);
  }

  function hideDocumentSelection() {
    actions.$("document-selection-tools")?.setAttribute("hidden", "");
    selectedRange = null;
    selectedText = "";
    selectionPage = null;
  }

  function editable() {
    return state.liveEditorReady && !state.editing && !state.saving &&
      !state.imageUploading && state.draftState?.id === state.current &&
      state.draftState.resolved && !state.draftState.conflict;
  }

  function updateSelection() {
    const toolbar = actions.$("document-selection-tools");
    if (!toolbar) return;
    if (toolbar.contains(document.activeElement)) return;
    const selection = document.getSelection();
    const editor = actions.$("live-editor")?.querySelector('.vditor-ir [contenteditable="true"]');
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!editable() || !editor || !range || range.collapsed ||
      !editor.contains(range.startContainer) || !editor.contains(range.endContainer) ||
      !selection.toString().trim() || document.querySelector("dialog[open]")) {
      hideDocumentSelection();
      return;
    }
    selectedRange = range.cloneRange();
    selectedText = selection.toString();
    selectionPage = state.current;
    const rect = range.getBoundingClientRect();
    toolbar.hidden = false;
    const width = toolbar.offsetWidth;
    toolbar.style.left = Math.max(8, Math.min(rect.left, innerWidth - width - 8)) + "px";
    toolbar.style.top = Math.max(8, Math.min(
      rect.top > toolbar.offsetHeight + 80 ? rect.top - toolbar.offsetHeight - 8 : rect.bottom + 8,
      innerHeight - toolbar.offsetHeight - 8,
    )) + "px";
  }

  function formatSelection(command) {
    if (!editable() || !selectedRange || selectionPage !== state.current ||
      !selectedRange.startContainer.isConnected || !selectedRange.endContainer.isConnected) return;
    const root = actions.$("live-editor");
    root.querySelector('.vditor-ir [contenteditable="true"]').focus();
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(selectedRange);
    const control = root.querySelector(command === "heading"
      ? '.vditor-toolbar button[data-tag="h2"]'
      : `.vditor-toolbar button[data-type="${command}"]`);
    const parentControl = command === "heading" ? root.querySelector('.vditor-toolbar button[data-type="headings"]') : control;
    if (!parentControl || parentControl.disabled || parentControl.classList.contains("vditor-menu--disabled")) return;
    if (!control || control.disabled || control.classList.contains("vditor-menu--disabled")) return;
    state.liveEditorTouched = true;
    control.dispatchEvent(new Event(navigator.userAgent.includes("iPhone") ? "touchstart" : "click", { bubbles: true, cancelable: true }));
    hideDocumentSelection();
    queueMicrotask(() => {
      if (state.liveEditorReady) actions.changeDocumentContent(state.liveEditor.getValue());
      actions.refreshLiveOutline();
    });
  }

  async function saveBeforeTaskNavigation() {
    if (actions.isDirty() || state.draftRequest) await actions.flushDraft();
    if (actions.isDirty()) throw new Error("Dokumen masih berubah. Simpan dokumen sebelum membuka task.");
    return actions.canLeave();
  }

  async function createTaskFromSelection() {
    const page = state.pages.find((page) => page.id === selectionPage);
    if (!page || page.id !== state.current || !selectedText.trim()) return;
    const text = selectedText.trim();
    const mention = `@[${encodeURIComponent(page.path.split("/").pop())}](doc:${page.id})`;
    const source = `\n\nSumber: ${mention}`;
    if (text.length + source.length > 3000)
      throw new Error("Teks pilihan dan sumber melebihi 3.000 karakter. Pilih teks yang lebih pendek.");
    const title = text.replace(/\s+/g, " ").slice(0, 120);
    if (!await saveBeforeTaskNavigation() || state.current !== page.id) return;
    hideDocumentSelection();
    await actions.openBoardTaskFromDocument({ title, description: text + source });
  }

  async function openDocumentTask(id, archived) {
    const page = state.current;
    if (!await saveBeforeTaskNavigation() || state.current !== page) return;
    await actions.openRelatedTask(id, archived);
  }

  async function loadDocumentTasks(page, element) {
    element.innerHTML = '<p class="edit-hint" role="status">Memuat task terkait…</p>';
    try {
      const data = await actions.api("task-board/related?document=" + encodeURIComponent(page.id));
      if (!element.isConnected || state.current !== page.id) return;
      element.innerHTML = data.items.length
        ? `<ul class="related-task-list">${data.items.map((task) => `<li><button type="button" data-document-tool="open-task" data-task="${actions.escape(task.id)}" data-archived="${Boolean(task.archivedAt)}"><span><small>#${task.number}</small> ${actions.escape(task.title)}</span><span class="related-task-status">${actions.escape(task.statusName)}${task.archivedAt ? " · Arsip" : ""}</span></button></li>`).join("")}</ul>`
        : '<p class="edit-hint">Belum ada task yang menyebut dokumen ini. Gunakan @ di deskripsi task untuk menautkannya.</p>';
    } catch (error) {
      if (element.isConnected) element.innerHTML = `<p class="edit-hint" role="alert">${actions.escape(error.message)}</p><button type="button" class="small-button" data-document-tool="reload-related">Coba lagi</button>`;
    }
  }

  function mountDocumentTools(page) {
    hideDocumentSelection();
    const main = actions.$("main");
    if (page.type === "doc" && !state.editing) {
      main.insertAdjacentHTML("beforeend", `<div class="document-selection-tools" id="document-selection-tools" role="toolbar" aria-label="Format teks pilihan" hidden><button type="button" data-document-tool="bold" title="Tebal (Ctrl+B)" aria-label="Tebal"><strong>B</strong></button><button type="button" data-document-tool="italic" title="Miring (Ctrl+I)" aria-label="Miring"><em>I</em></button><button type="button" data-document-tool="heading" title="Jadikan heading 2" aria-label="Jadikan heading 2">H2</button><button type="button" data-document-tool="link" title="Tautan" aria-label="Tautan">Tautan</button><button type="button" data-document-tool="inline-code" title="Kode" aria-label="Kode">${actions.icon("code")}</button><button type="button" class="selection-task" data-document-tool="create-task">${actions.icon("plus")}Buat task</button></div>`);
      const hint = main.querySelector(":scope > .edit-hint");
      if (hint) {
        const note = document.createElement("span");
        note.textContent = " Pilih teks lalu tekan Alt+Shift+F untuk membuka alat format dan membuat task.";
        hint.append(note);
      }
    }
    main.insertAdjacentHTML("beforeend", '<details class="document-related"><summary>Dokumen terkait dan aksi lainnya</summary><section aria-labelledby="related-task-heading"><h2 id="related-task-heading">Task terkait</h2><div id="document-related-tasks"></div><div class="tool-actions"><button class="small-button" data-action="openMove" data-state="current">Pindahkan</button><button class="small-button danger" data-action="deleteItem" data-state="current">Hapus dokumen</button></div></section></details>');
    loadDocumentTasks(page, actions.$("document-related-tasks"));
  }

  function bindDocumentTools() {
    if (bound) return;
    bound = true;
    document.addEventListener("selectionchange", updateSelection);
    document.addEventListener("scroll", () => {
      if (selectedRange) updateSelection();
    }, { passive: true, capture: true });
    window.addEventListener("resize", updateSelection);
    document.addEventListener("keydown", (event) => {
      if (event.altKey && event.shiftKey && event.code === "KeyF" && selectedRange && editable()) {
        event.preventDefault();
        actions.$("document-selection-tools")?.querySelector("button")?.focus();
      }
      if (event.key === "Escape" && actions.$("document-selection-tools")?.contains(event.target)) {
        actions.$("live-editor")?.querySelector('[contenteditable="true"]')?.focus();
        hideDocumentSelection();
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (event.target.closest("#document-selection-tools")) event.preventDefault();
    });
    document.addEventListener("change", (event) => {
      if (event.target.closest(".search-filters")) actions.scheduleSearch();
    });
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-document-tool]");
      if (!button || button.disabled || button.closest("#live-editor,.prose,.tb-description-editor")) return;
      event.preventDefault();
      Promise.resolve().then(() => {
        const command = button.dataset.documentTool;
        if (command === "reset-search") {
          actions.$("search-dialog").querySelectorAll(".search-filters input,.search-filters select").forEach((control) => { control.value = ""; });
          return actions.renderFullSearch();
        }
        if (command === "create-task") return createTaskFromSelection();
        if (command === "open-task") return openDocumentTask(button.dataset.task, button.dataset.archived === "true");
        if (command === "reload-related") return loadDocumentTasks(state.pages.find((page) => page.id === state.current), actions.$("document-related-tasks"));
        formatSelection(command);
      }).catch((error) => actions.notify(error.message));
    });
  }

  return { bindDocumentTools, mountDocumentTools, hideDocumentSelection, openDocumentProperties };
}
