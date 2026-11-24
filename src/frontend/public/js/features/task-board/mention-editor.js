import { descriptionHTML, mentionToken } from "./mention-text.js";

export function createFeature({ state, actions }, field = "description") {
  const { $, escape: esc } = actions;
  const fieldId = "board-task-" + field, menuPrefix = field === "description" ? "board" : "board-result";
  const error = () => $("board-" + field + "-error");
  let documents = [], items = [], active = 0, queryRange = null, timer, sequence = 0;
  let instance = null, ready = false, touched = false, locked = false, readonly = false;
  let destinations = new WeakMap();
  const editor = () => $(fieldId + "-editor");
  const editable = () => instance && ready ? editor().querySelector('.vditor-ir [contenteditable]') : editor();
  const menu = () => $(menuPrefix + "-mention-menu");
  function decorate() {
    destinations = new WeakMap();
    for (const preview of editor().querySelectorAll('.vditor-ir__preview')) preview.inert = true;
    for (const control of editor().querySelectorAll('input,button,select,textarea'))
      control.disabled = locked || readonly || Boolean(control.closest('.vditor-ir__preview'));
    for (const link of editor().querySelectorAll('.vditor-ir [data-type="a"]')) {
      if (link.closest('.vditor-ir__preview,[data-type="html-block"],[data-type="html-inline"],code')) continue;
      const url = link.querySelector('.vditor-ir__marker--link')?.textContent || "";
      const id = /^doc:([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.exec(url)?.[1].toLowerCase();
      const doc = documents.find((item) => item.id === id);
      link.setAttribute("contenteditable", "false");
      link.setAttribute("role", "link"); link.tabIndex = 0;
      link.classList.add(id ? "tb-mention" : "tb-description-link");
      link.classList.toggle("tb-mention-missing", Boolean(id && !doc));
      if (id) {
        const label = link.querySelector(".vditor-ir__link");
        let name = label.textContent;
        try { name = decodeURIComponent(name); } catch { /* Keep malformed legacy labels readable. */ }
        label.setAttribute("data-display-label", doc?.path.split("/").pop() || name);
      }
      let destination = doc ? actions.appUrl("/api/task-board/documents/" + doc.id + "/open") : "";
      try { if (!id && ["https:", "http:"].includes(new URL(url).protocol)) destination = url; } catch { /* Relative links require a document mention. */ }
      link.dataset.taskUrl = destination;
      destinations.set(link, destination);
      link.setAttribute("aria-disabled", String(!destination));
      link.title = destination ? "Buka di tab baru" : "Tautan atau dokumen tidak tersedia";
    }
  }
  function close() {
    clearTimeout(timer); sequence++; items = []; queryRange = null;
    menu().hidden = true; editable().setAttribute("aria-expanded", "false");
    editable().removeAttribute("aria-activedescendant");
  }
  function read(node = editor()) {
    if (node.nodeType === 3) return node.nodeValue.replace(/\u00a0/g, " ");
    if (node.dataset?.mentionToken) return node.dataset.mentionToken;
    if (node.nodeName === "BR") return "\n";
    if (/^(DIV|P)$/.test(node.nodeName) && node.childNodes.length === 1 && node.firstChild.nodeName === "BR") return "";
    let text = "";
    for (const child of node.childNodes) {
      const previous = child.previousSibling;
      if (previous && ((/^(DIV|P)$/.test(child.nodeName) && previous.nodeName !== "BR") || /^(DIV|P)$/.test(previous.nodeName))) text += "\n";
      text += read(child);
    }
    return text;
  }
  function sync() {
    const value = instance ? (ready && touched ? instance.getValue() : $(fieldId).value) : editor().innerHTML === "<br>" ? "" : read();
    $(fieldId).value = value;
    const invalid = value.length > 3000 || value.includes("\0");
    editor().setAttribute("aria-invalid", String(invalid));
    editable().setAttribute("aria-invalid", String(invalid));
    error().textContent = invalid ? "Teks terlalu panjang (maksimal 3.000 karakter, termasuk referensi dokumen)." : "";
    state.taskBoardDirty = true;
    $(fieldId).dispatchEvent(new Event("input", { bubbles: true }));
    return !invalid;
  }
  function load(text, currentDocuments = []) {
    close(); documents = [...currentDocuments]; touched = false;
    $(fieldId).value = text;
    editor().setAttribute("aria-invalid", "false"); error().textContent = "";
    if (instance) {
      if (ready) {
        instance.setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "classic");
        instance.setValue(text, true); decorate();
      }
      return;
    }
    if (typeof Vditor === "undefined") {
      editor().innerHTML = descriptionHTML(text, documents, actions, true);
      return;
    }
    editor().removeAttribute("contenteditable");
    editor().setAttribute("role", "group"); editor().setAttribute("aria-busy", "true");
    instance = new Vditor(editor(), {
      cdn: actions.appUrl("/static/editor/" + state.boot.editorVersion),
      lang: "en_US", mode: "ir", value: text,
      theme: document.documentElement.dataset.theme === "dark" ? "dark" : "classic",
      cache: { enable: false }, toolbar: ["bold", "italic", "headings", "list", "ordered-list", "link", "inline-code"],
      minHeight: 220, height: "auto", placeholder: editor().dataset.placeholder,
      preview: { markdown: { sanitize: true, autoSpace: false, fixTermTypo: false }, hljs: { enable: false }, render: { media: { enable: false } } },
      input: () => { if (ready && touched && !locked && !readonly) { sync(); decorate(); schedule(); } },
      after: () => queueMicrotask(() => {
        ready = true; instance.setValue($(fieldId).value, true);
        editable().setAttribute("role", "combobox");
        for (const name of ["aria-labelledby", "aria-autocomplete", "aria-haspopup", "aria-controls", "aria-describedby"])
          editable().setAttribute(name, editor().getAttribute(name));
        editor().setAttribute("aria-busy", "false");
        decorate(); busy(locked, readonly);
      }),
    });
  }
  function busy(value, readOnly = false) {
    close(); locked = value; readonly = readOnly;
    if (instance && ready) value || readOnly ? instance.disabled() : instance.enable();
    else if (!instance) editor().setAttribute("contenteditable", String(!value && !readOnly));
    editor().setAttribute("aria-disabled", String(value));
    editor().setAttribute("aria-readonly", String(readOnly));
    editable().setAttribute("aria-readonly", String(readOnly));
    if (instance && ready) decorate();
  }
  function caretQuery() {
    const selection = window.getSelection();
    if (!selection.rangeCount || !selection.isCollapsed) return null;
    const range = selection.getRangeAt(0), node = range.startContainer;
    if (node.nodeType !== 3 || !editor().contains(node) || node.parentElement.closest('[contenteditable="false"]')) return null;
    const before = node.nodeValue.slice(0, range.startOffset), match = /(?:^|\s)@([^@\n]{0,200})$/.exec(before);
    if (!match) return null;
    const tokenRange = range.cloneRange(); tokenRange.setStart(node, range.startOffset - match[1].length - 1);
    return { text: match[1], range: tokenRange };
  }
  function selectActive() {
    menu().querySelectorAll('[role="option"]').forEach((node, index) => {
      node.setAttribute("aria-selected", String(index === active));
      if (index === active) { editable().setAttribute("aria-activedescendant", node.id); node.scrollIntoView({ block: "nearest" }); }
    });
  }
  function schedule() {
    close();
    if (state.toolBusy || !editable().isContentEditable || !$("board-task-dialog").open) return;
    const query = caretQuery(); if (!query) return;
    queryRange = query.range; const request = sequence;
    menu().hidden = false; editable().setAttribute("aria-expanded", "true");
    menu().innerHTML = '<p role="status">Mencari dokumen…</p>';
    timer = setTimeout(async () => {
      try {
        const result = await actions.api("task-board/documents?q=" + encodeURIComponent(query.text.trim()));
        if (request !== sequence || state.toolBusy || !$("board-task-dialog").open || !editor().contains(document.activeElement)) return;
        items = result.items; active = 0;
        menu().innerHTML = items.map((doc, index) => `<button type="button" role="option" id="${menuPrefix}-mention-${index}" data-mention-option="${index}" tabindex="-1" aria-selected="${index === 0}"><span>${esc(doc.path.split("/").pop())}</span><small>${esc("docs" + doc.path)}</small></button>`).join("") || '<p role="status">Tidak ada dokumen yang cocok.</p>';
        selectActive();
      } catch (error) {
        if (request === sequence) menu().innerHTML = `<p role="status">${esc(error.message)} Ketik lagi untuk mencoba ulang.</p>`;
      }
    }, 200);
  }
  function insert(index) {
    if (state.toolBusy || !editable().isContentEditable || !items[index] || !queryRange || !editor().contains(queryRange.startContainer)) return;
    const doc = items[index], token = mentionToken(doc), value = $(fieldId).value;
    if (value.length - queryRange.toString().length + token.length + 1 > 3000) {
      error().textContent = "Tidak cukup ruang untuk mention ini. Ringkas teks terlebih dahulu."; close(); return;
    }
    documents = [...documents.filter((item) => item.id !== doc.id), doc];
    const range = queryRange.cloneRange(); editable().focus();
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    // Native insertion keeps typing and mention selection in the browser undo history.
    touched = true;
    if (instance) insertText(token + " ");
    else document.execCommand("insertHTML", false, descriptionHTML(token, documents, actions, true) + "&nbsp;");
    close(); sync();
  }
  function insertText(text) {
    if (instance) {
      const content = document.createElement("div");
      content.innerHTML = instance.vditor.lute.Md2VditorIRDOM(text);
      const singleParagraph = content.children.length === 1 && content.firstElementChild.tagName === "P";
      touched = true; instance.updateValue(singleParagraph ? content.firstElementChild.innerHTML : content.innerHTML);
      decorate(); return;
    }
    document.execCommand("insertHTML", false, descriptionHTML(text, documents, actions, true));
    const selection = window.getSelection(), link = selection.anchorNode?.parentElement?.closest(".tb-description-link");
    if (link) {
      const range = document.createRange(); range.setStartAfter(link); range.collapse(true);
      selection.removeAllRanges(); selection.addRange(range);
    }
  }
  function linkBeforeCaret() {
    const selection = window.getSelection();
    if (!editable().isContentEditable || !selection.rangeCount || !selection.isCollapsed) return;
    const range = selection.getRangeAt(0), node = range.startContainer;
    if (node.nodeType !== 3 || !editor().contains(node) || node.parentElement.closest('a, [contenteditable="false"]')) return;
    const match = /https?:\/\/\S+$/i.exec(node.nodeValue.slice(0, range.startOffset));
    if (!match) return;
    const html = descriptionHTML(match[0], documents, actions, true);
    if (!html.includes('class="tb-description-link"')) return;
    range.setStart(node, match.index);
    selection.removeAllRanges(); selection.addRange(range);
    insertText(match[0]);
    sync();
  }
  function bind() {
    const input = editor();
    input.tabIndex = -1;
    input.addEventListener("focus", () => { if (instance && ready) editable().focus(); });
    input.addEventListener("input", (event) => { if (locked || readonly || state.toolBusy || (instance && !ready)) return; touched = true; sync(); if (!event.isComposing) schedule(); });
    input.addEventListener("compositionstart", close);
    input.addEventListener("compositionend", schedule);
    input.addEventListener("keyup", (event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) schedule(); });
    input.addEventListener("click", (event) => { if (!event.target.closest("a")) schedule(); });
    input.addEventListener("blur", close);
    input.addEventListener("click", (event) => {
      const link = event.target.closest('[data-type="a"]');
      if (!link || !destinations.has(link)) return;
      event.preventDefault(); event.stopPropagation();
      if (destinations.get(link)) window.open(destinations.get(link), "_blank", "noopener,noreferrer");
    }, true);
    input.addEventListener("keydown", (event) => {
      if (!locked && !readonly && (event.key.length === 1 || ["Enter", "Backspace", "Delete", "Tab"].includes(event.key))) touched = true;
      const link = event.target.closest('[data-type="a"]');
      if (link && destinations.has(link) && ["Enter", " "].includes(event.key)) { event.preventDefault(); event.stopPropagation(); if (destinations.get(link)) window.open(destinations.get(link), "_blank", "noopener,noreferrer"); }
    }, true);
    input.addEventListener("keydown", (event) => {
      if (event.isComposing || state.toolBusy) return;
      if (!menu().hidden && ["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault(); event.stopPropagation(); if (items.length) { active = (active + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; selectActive(); } return;
      }
      if (!menu().hidden && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (!menu().hidden && items.length && (event.key === "Enter" || event.key === "Tab")) { event.preventDefault(); event.stopPropagation(); insert(active); return; }
      if (!instance && !event.ctrlKey && !event.metaKey && !event.altKey && (event.key === " " || event.key === "Enter")) linkBeforeCaret();
    }, true);
    input.addEventListener("paste", (event) => {
      event.preventDefault(); event.stopPropagation(); if (state.toolBusy || !editable().isContentEditable) return;
      const text = event.clipboardData.getData("text/plain").replace(/\0/g, "");
      if ($(fieldId).value.length - window.getSelection().toString().length + text.length > 3000) { error().textContent = "Teks yang ditempel melebihi batas 3.000 karakter."; return; }
      insertText(text); sync(); schedule();
    }, true);
    input.addEventListener("drop", (event) => { event.preventDefault(); event.stopPropagation(); close(); }, true);
    menu().addEventListener("pointerdown", (event) => event.preventDefault());
    menu().addEventListener("click", (event) => { const option = event.target.closest("[data-mention-option]"); if (option) insert(Number(option.dataset.mentionOption)); });
    $("board-task-dialog").addEventListener("close", close);
  }
  return { load, sync, busy, close, bind };
}
