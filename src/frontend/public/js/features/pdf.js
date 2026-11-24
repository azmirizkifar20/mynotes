export function pdfPreview(url, title, escape, downloadUrl = "") {
  return `<div class="pdf-preview"><iframe class="pdf-frame" src="${escape(url)}" title="Pratinjau PDF: ${escape(title)}" referrerpolicy="same-origin"></iframe><p class="edit-hint">Jika pratinjau tidak tampil, <a href="${escape(url)}" target="_blank" rel="noopener noreferrer">buka PDF di tab baru</a>.${downloadUrl ? ` <a href="${escape(downloadUrl)}">Unduh PDF</a>.` : ""}</p></div>`;
}
