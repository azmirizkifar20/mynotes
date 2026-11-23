import { descriptionHTML, mentionToken } from "./mention-text.js";

export function createFeature({ state, actions }) {
  const { $, escape: esc } = actions;
  let documents = [], items = [], active = 0, queryRange = null, timer, sequence = 0;
  const editor = () => $("board-task-description-editor");
  const menu = () => $("board-mention-menu");
  function close() {
    clearTimeout(timer); sequence++; items = []; queryRange = null;
    menu().hidden = true; editor().setAttribute("aria-expanded", "false");
    editor().removeAttribute("aria-activedescendant");
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
    const value = editor().innerHTML === "<br>" ? "" : read();
    $("board-task-description").value = value;
    const invalid = value.length > 3000 || value.includes("\0");
    editor().setAttribute("aria-invalid", String(invalid));
    $("board-description-error").textContent = invalid ? "Deskripsi terlalu panjang (maksimal 3.000 karakter, termasuk referensi dokumen)." : "";
    state.taskBoardDirty = true;
    return !invalid;
  }
  function load(text, currentDocuments = []) {
    close(); documents = [...currentDocuments];
    editor().innerHTML = descriptionHTML(text, documents, actions, true);
    $("board-task-description").value = text;
    editor().setAttribute("aria-invalid", "false"); $("board-description-error").textContent = "";
  }
  function busy(value) {
    close(); editor().setAttribute("contenteditable", String(!value));
    editor().setAttribute("aria-disabled", String(value));
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
      if (index === active) { editor().setAttribute("aria-activedescendant", node.id); node.scrollIntoView({ block: "nearest" }); }
    });
  }
  function schedule() {
    close();
    if (state.toolBusy || !editor().isContentEditable || !$("board-task-dialog").open) return;
    const query = caretQuery(); if (!query) return;
    queryRange = query.range; const request = sequence;
    menu().hidden = false; editor().setAttribute("aria-expanded", "true");
    menu().innerHTML = '<p role="status">Mencari dokumen…</p>';
    timer = setTimeout(async () => {
      try {
        const result = await actions.api("task-board/documents?q=" + encodeURIComponent(query.text.trim()));
        if (request !== sequence || state.toolBusy || !$("board-task-dialog").open || document.activeElement !== editor()) return;
        items = result.items; active = 0;
        menu().innerHTML = items.map((doc, index) => `<button type="button" role="option" id="board-mention-${index}" data-mention-option="${index}" tabindex="-1" aria-selected="${index === 0}"><span>${esc(doc.path.split("/").pop())}</span><small>${esc("docs" + doc.path)}</small></button>`).join("") || '<p role="status">Tidak ada dokumen yang cocok.</p>';
        selectActive();
      } catch (error) {
        if (request === sequence) menu().innerHTML = `<p role="status">${esc(error.message)} Ketik lagi untuk mencoba ulang.</p>`;
      }
    }, 200);
  }
  function insert(index) {
    if (state.toolBusy || !editor().isContentEditable || !items[index] || !queryRange || !editor().contains(queryRange.startContainer)) return;
    const doc = items[index], token = mentionToken(doc), value = $("board-task-description").value;
    if (value.length - queryRange.toString().length + token.length + 1 > 3000) {
      $("board-description-error").textContent = "Tidak cukup ruang untuk mention ini. Ringkas deskripsi terlebih dahulu."; close(); return;
    }
    documents = [...documents.filter((item) => item.id !== doc.id), doc];
    const range = queryRange.cloneRange(); editor().focus();
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    // Native insertion keeps typing and mention selection in the browser undo history.
    document.execCommand("insertHTML", false, descriptionHTML(token, documents, actions, true) + "&nbsp;");
    close(); sync();
  }
  function bind() {
    const input = editor();
    input.addEventListener("input", (event) => { sync(); if (!event.isComposing) schedule(); });
    input.addEventListener("compositionstart", close);
    input.addEventListener("compositionend", schedule);
    input.addEventListener("keyup", (event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) schedule(); });
    input.addEventListener("click", (event) => { if (!event.target.closest("a")) schedule(); });
    input.addEventListener("blur", close);
    input.addEventListener("keydown", (event) => {
      if (event.isComposing || state.toolBusy) return;
      if (!menu().hidden && ["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault(); if (items.length) { active = (active + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; selectActive(); } return;
      }
      if (!menu().hidden && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (!menu().hidden && items.length && (event.key === "Enter" || event.key === "Tab")) { event.preventDefault(); insert(active); }
    });
    input.addEventListener("paste", (event) => {
      event.preventDefault(); if (state.toolBusy || !input.isContentEditable) return;
      const text = event.clipboardData.getData("text/plain").replace(/\0/g, "");
      if (read().length - window.getSelection().toString().length + text.length > 3000) { $("board-description-error").textContent = "Teks yang ditempel melebihi batas deskripsi 3.000 karakter."; return; }
      document.execCommand("insertText", false, text); sync(); schedule();
    });
    input.addEventListener("drop", (event) => { event.preventDefault(); close(); });
    menu().addEventListener("pointerdown", (event) => event.preventDefault());
    menu().addEventListener("click", (event) => { const option = event.target.closest("[data-mention-option]"); if (option) insert(Number(option.dataset.mentionOption)); });
    $("board-task-dialog").addEventListener("close", close);
  }
  return { load, sync, busy, close, bind };
}
