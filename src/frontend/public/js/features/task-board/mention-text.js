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
export function descriptionHTML(text, documents = [], { escape: esc, appUrl }, editing = false) {
  const known = new Map(documents.map((doc) => [doc.id, doc]));
  return descriptionParts(text).map((part) => {
    if (!part.id) return esc(part.text).replace(/\n/g, "<br>");
    const doc = known.get(part.id), label = doc?.path.split("/").pop() || part.label;
    const attributes = editing ? ` contenteditable="false" data-mention-token="${esc(part.token)}"` : "";
    return doc
      ? `<a class="tb-mention"${attributes} href="${esc(appUrl("/api/task-board/documents/" + doc.id + "/open"))}" target="_blank" rel="noopener" title="${esc("docs" + doc.path + " · Buka di tab baru")}">@${esc(label)}</a>`
      : `<span class="tb-mention tb-mention-missing"${attributes} title="Dokumen tidak tersedia">@${esc(label)} <small>(tidak tersedia)</small></span>`;
  }).join("");
}
