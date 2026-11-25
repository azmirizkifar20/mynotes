const commands = [
  { key: "task", title: "Buat task", hint: "Task baru dengan referensi dokumen ini", icon: "board" },
  { key: "checkbox", title: "Checklist", hint: "Kotak centang untuk daftar tindakan", icon: "check", markdown: "- [ ] " },
  ...[1, 2, 3].map((level) => ({ key: "h" + level, title: "Heading " + level, hint: "Judul tingkat " + level, icon: "book", markdown: "#".repeat(level) + " " })),
  { key: "bullet", title: "List bullet", hint: "Daftar dengan titik", icon: "list", markdown: "- " },
  { key: "number", title: "List bernomor", hint: "Daftar berurutan", icon: "list", markdown: "1. " },
  { key: "quote", title: "Kutipan", hint: "Blok kutipan", icon: "book", markdown: "> " },
  { key: "code", title: "Blok kode", hint: "Tulis kode dalam blok tersendiri", icon: "code", markdown: "```\n\n```\n" },
  { key: "table", title: "Tabel", hint: "Mulai dengan dua kolom", icon: "grid", markdown: "| Kolom 1 | Kolom 2 |\n| --- | --- |\n|  |  |\n" },
  { key: "divider", title: "Garis pemisah", hint: "Pisahkan bagian dokumen", icon: "list", markdown: "---\n\n" },
  { key: "doc", title: "Tautkan dokumen", hint: "Cari dokumen Markdown atau PDF", icon: "doc" },
  { key: "image", title: "Gambar", hint: "Pilih dan upload gambar ke dokumen", icon: "upload" },
  { key: "date", title: "Tanggal hari ini", hint: "Sisipkan tanggal WIB sebagai teks", icon: "calendar" },
];

export function createFeature({ state, actions }) {
  let menu, editor, root, abort, timer, query, items = [], active = 0, composing = false;
  const esc = actions.escape;
  const enabled = () => editor?.isConnected && state.liveEditorReady && !state.editing &&
    !state.saving && !state.imageUploading && !state.toolBusy && !state.navigationPending &&
    state.draftState?.id === state.current && state.draftState.resolved && !state.draftState.conflict &&
    !document.querySelector("dialog[open]");

  function close() {
    clearTimeout(timer);
    query = null;
    items = [];
    if (menu) menu.hidden = true;
    editor?.setAttribute("aria-expanded", "false");
    editor?.removeAttribute("aria-activedescendant");
  }

  function caretQuery() {
    if (!enabled() || composing || !editor.contains(document.activeElement)) return null;
    const selection = document.getSelection();
    if (!selection?.rangeCount || !selection.isCollapsed) return null;
    const caret = selection.getRangeAt(0);
    if (!editor.contains(caret.startContainer)) return null;
    const element = caret.startContainer.nodeType === 1 ? caret.startContainer : caret.startContainer.parentElement;
    if (element.closest('code,[contenteditable="false"],[data-type="a"],[data-type="html-block"],[data-type="html-inline"],.vditor-ir__marker--pre,.vditor-ir__preview')) return null;
    const block = element.closest("p,h1,h2,h3,h4,h5,h6,li,td,th");
    if (!block || !editor.contains(block)) return null;
    const prefix = caret.cloneRange();
    prefix.selectNodeContents(block);
    prefix.setEnd(caret.startContainer, caret.startOffset);
    const before = prefix.toString();
    const wiki = /\[\[([^\[\]\n]{0,200})$/.exec(before);
    const slash = /^[\s\u200b]*\/([a-z0-9-]*)$/i.exec(before);
    if (!wiki && !slash) return null;
    const text = (wiki || slash)[1];
    let offset = before.length - text.length - (wiki ? 2 : 1);
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (offset <= node.textContent.length) break;
      offset -= node.textContent.length;
    }
    if (!node) return null;
    const range = caret.cloneRange();
    range.setStart(node, offset);
    return { type: wiki ? "document" : "command", text, range, page: state.current,
      generation: state.liveEditorGeneration, value: range.toString() };
  }

  function selectActive() {
    if (!menu || menu.hidden) return;
    const options = [...menu.querySelectorAll('[role="option"]')];
    options.forEach((option, index) => option.setAttribute("aria-selected", String(index === active)));
    editor.setAttribute("aria-activedescendant", options[active]?.id || "");
    options[active]?.scrollIntoView({ block: "nearest" });
  }

  function position() {
    if (!menu || menu.hidden || !query?.range.startContainer.isConnected) return;
    const rect = query.range.getBoundingClientRect();
    const below = innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const maxHeight = Math.min(340, Math.max(below, above, 120));
    menu.style.maxHeight = maxHeight + "px";
    menu.style.left = Math.max(8, Math.min(rect.left, innerWidth - menu.offsetWidth - 8)) + "px";
    const top = below >= Math.min(menu.scrollHeight, 240) || below >= above
      ? rect.bottom + 6 : rect.top - menu.offsetHeight - 6;
    menu.style.top = Math.max(8, Math.min(top, innerHeight - menu.offsetHeight - 8)) + "px";
  }

  function show() {
    const next = caretQuery();
    if (!next) return close();
    const same = query?.type === next.type && query.text === next.text;
    query = next;
    const text = query.text.trim().toLocaleLowerCase();
    items = query.type === "document"
      ? state.pages.filter((page) => ["doc", "pdf"].includes(page.type) && page.id !== state.current && page.path.toLocaleLowerCase().includes(text))
        .sort((a, b) => Number(b.path.split("/").pop().toLocaleLowerCase().startsWith(text)) - Number(a.path.split("/").pop().toLocaleLowerCase().startsWith(text)) || a.path.localeCompare(b.path)).slice(0, 10)
      : commands.filter((item) => `${item.key} ${item.title} ${item.hint}`.toLocaleLowerCase().includes(text));
    if (!same) active = 0;
    active = Math.min(active, Math.max(0, items.length - 1));
    menu.innerHTML = `<div class="document-insert-heading">${query.type === "document" ? "Tautkan dokumen" : "Sisipkan atau jalankan"}</div><div role="listbox" id="document-insert-options" aria-label="${query.type === "document" ? "Dokumen" : "Command editor"}">${items.map((item, index) => `<button type="button" role="option" tabindex="-1" id="document-insert-option-${index}" data-insert-index="${index}" aria-selected="${index === active}">${actions.icon(query.type === "document" ? item.type === "pdf" ? "doc" : "book" : item.icon)}<span><strong>${esc(query.type === "document" ? item.path.split("/").pop() : item.title)}</strong><small>${esc(query.type === "document" ? "docs" + item.path : item.hint)}</small></span>${query.type === "command" ? `<kbd>/${esc(item.key)}</kbd>` : ""}</button>`).join("") || '<p class="document-insert-empty" role="status">Tidak ada hasil yang cocok.</p>'}</div><div class="document-insert-footer">↑ ↓ pilih · Enter terapkan · Esc tutup</div>`;
    menu.hidden = false;
    editor.setAttribute("aria-expanded", "true");
    position();
    selectActive();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(show, 80);
  }

  function restore(target) {
    if (!enabled() || target.page !== state.current || target.generation !== state.liveEditorGeneration ||
      !target.range.startContainer.isConnected || !editor.contains(target.range.startContainer) ||
      !editor.contains(target.range.endContainer) || target.range.toString() !== target.value) return false;
    editor.focus();
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(target.range);
    return true;
  }

  function insert(markdown, inline = false) {
    state.liveEditorTouched = true;
    if (inline) {
      const container = document.createElement("div");
      container.innerHTML = state.liveEditor.vditor.lute.Md2VditorIRDOM(markdown);
      const single = container.children.length === 1 && container.firstElementChild.tagName === "P";
      state.liveEditor.updateValue(single ? container.firstElementChild.innerHTML : container.innerHTML);
    } else state.liveEditor.insertMD(markdown);
    actions.changeDocumentContent(state.liveEditor.getValue());
    queueMicrotask(actions.refreshLiveOutline);
  }

  async function choose(index) {
    const item = items[index], target = query;
    if (!item || !target || !restore(target)) return close();
    close();
    if (target.type === "document") {
      if (!state.pages.some((page) => page.id === item.id)) return;
      const label = item.path.split("/").pop().replace(/([\\\[\]])/g, "\\$1");
      insert(`[${label}](/share/document/${item.id}) `, true);
      return;
    }
    if (item.key === "image") {
      const picker = document.createElement("input");
      picker.type = "file";
      picker.accept = ".png,.jpg,.jpeg,.gif,.webp";
      picker.addEventListener("change", async () => {
        const file = picker.files[0];
        if (!file || !restore(target)) return;
        if (!/\.(png|jpe?g|gif|webp)$/i.test(file.name) || file.size > 5 * 1024 * 1024)
          return actions.notify("Gunakan PNG, JPEG, GIF, atau WebP, maksimal 5 MB.");
        insert("", true);
        await actions.uploadDocumentImage(file, { type: "command" });
      });
      const selection = document.getSelection();
      selection.collapseToEnd();
      picker.click();
      return;
    }
    if (item.key === "task") {
      insert("", true);
      return actions.createTaskFromDocument();
    }
    if (item.key === "doc") {
      insert("[[", true);
      schedule();
      return;
    }
    if (item.key === "date") {
      insert(new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric" }).format(new Date()), true);
      return;
    }
    insert(item.markdown);
  }

  function handleDocumentMenuKey(event) {
    if (!menu || menu.hidden || event.isComposing || composing) return false;
    if (!enabled()) { close(); return false; }
    if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) return false;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") close();
    else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      if (items.length) active = (active + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      selectActive();
    } else if (items.length) Promise.resolve(choose(active)).catch((error) => actions.notify(error.message));
    else close();
    return true;
  }

  function destroyDocumentMenu() {
    close();
    abort?.abort();
    menu?.remove();
    menu = editor = root = null;
    composing = false;
  }

  function mountDocumentMenu() {
    destroyDocumentMenu();
    root = actions.$("live-editor");
    editor = root?.querySelector('.vditor-ir [contenteditable="true"]');
    if (!editor) return;
    abort = new AbortController();
    const options = { signal: abort.signal };
    menu = document.createElement("div");
    menu.className = "document-insert-menu";
    menu.id = "document-insert-menu";
    menu.hidden = true;
    document.body.append(menu);
    editor.setAttribute("aria-autocomplete", "list");
    editor.setAttribute("aria-controls", "document-insert-options");
    editor.setAttribute("aria-haspopup", "listbox");
    editor.setAttribute("aria-expanded", "false");
    root.addEventListener("input", schedule, options);
    root.addEventListener("keyup", (event) => {
      if (!["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].includes(event.key)) schedule();
    }, options);
    root.addEventListener("compositionstart", () => { composing = true; close(); }, options);
    root.addEventListener("compositionend", () => { composing = false; schedule(); }, options);
    root.addEventListener("pointerup", schedule, options);
    root.addEventListener("focusout", () => { setTimeout(() => { if (!editor?.contains(document.activeElement)) close(); }, 0); }, options);
    menu.addEventListener("pointerdown", (event) => event.preventDefault(), options);
    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-insert-index]");
      if (option) Promise.resolve(choose(Number(option.dataset.insertIndex))).catch((error) => actions.notify(error.message));
    }, options);
    document.addEventListener("pointerdown", (event) => { if (!menu.contains(event.target) && !root.contains(event.target)) close(); }, options);
    document.addEventListener("scroll", position, { ...options, capture: true, passive: true });
    window.addEventListener("resize", position, options);
    actions.decorateDocumentLinks();
  }
  return { mountDocumentMenu, destroyDocumentMenu, handleDocumentMenuKey, closeDocumentMenu: close };
}
