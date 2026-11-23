const pattern = () => /@\[([^\]\r\n]+)\]\(doc:([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\)/gi;
export function mentionToken(document) {
  return `@[${encodeURIComponent(document.path.split("/").pop())}](doc:${document.id.toLowerCase()})`;
}
export function descriptionParts(text) {
  const parts = []; let start = 0;
  for (const match of text.matchAll(pattern())) {
    if (match.index > start) parts.push({ text: text.slice(start, match.index) });
    let label; try { label = decodeURIComponent(match[1]); } catch { label = match[1]; }
    parts.push({ id: match[2].toLowerCase(), label, token: match[0] }); start = match.index + match[0].length;
  }
  if (start < text.length) parts.push({ text: text.slice(start) });
  return parts;
}
export function descriptionText(text, documents = []) {
  const known = new Map(documents.map((doc) => [doc.id, doc]));
  return descriptionParts(text).map((part) => part.id ? "@" + (known.get(part.id)?.path.split("/").pop() || part.label) : part.text).join("");
}
function linkHTML(text, esc, editing) {
  let html = "", start = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'`\u0000-\u001f]+/gi)) {
    let url = match[0];
    const unmatchedEnd = () => [["(", ")"], ["[", "]"], ["{", "}"]].some(([open, close]) => url.endsWith(close) && url.split(close).length > url.split(open).length);
    while (/[.,;:!?]$/.test(url) || unmatchedEnd()) url = url.slice(0, -1);
    try { if (!new URL(url).hostname) continue; } catch { continue; }
    html += esc(text.slice(start, match.index)) + `<a class="tb-description-link"${editing ? ' contenteditable="false"' : ""} href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`;
    start = match.index + url.length;
  }
  return (html + esc(text.slice(start))).replace(/\n/g, "<br>");
}
export function descriptionHTML(text, documents = [], { escape: esc, appUrl }, editing = false) {
  const known = new Map(documents.map((doc) => [doc.id, doc]));
  return descriptionParts(text).map((part) => {
    if (!part.id) return linkHTML(part.text, esc, editing);
    const doc = known.get(part.id), label = doc?.path.split("/").pop() || part.label;
    const attributes = editing ? ` contenteditable="false" data-mention-token="${esc(part.token)}"` : "";
    return doc
      ? `<a class="tb-mention"${attributes} href="${esc(appUrl("/api/task-board/documents/" + doc.id + "/open"))}" target="_blank" rel="noopener" title="${esc("docs" + doc.path + " · Buka di tab baru")}">@${esc(label)}</a>`
      : `<span class="tb-mention tb-mention-missing"${attributes} title="Dokumen tidak tersedia">@${esc(label)} <small>(tidak tersedia)</small></span>`;
  }).join("");
}
