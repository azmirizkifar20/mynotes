import { pdfPreview } from "./pdf.js";

export function createFeature({ state, actions }) {
  async function refreshWorkspace() {
    const data = await actions.api("workspace");
    state.pages = data.pages;
    actions.applyPreferences(data.preferences);
    actions.renderTree();
  }

  function header(page) {
    const file = ["doc", "pdf"].includes(page.type);
    const title = file
      ? `<h1 id="document-title"><button type="button" class="document-title-button" id="document-title-button" data-action="editDocumentName" title="Ganti nama file" aria-label="Ganti nama file: ${actions.escape(page.title)}">${actions.escape(page.title)}</button></h1><form id="document-rename-form" data-submit="renameItem" data-arg="${page.id}" hidden><label class="field-label" for="document-name">Nama file</label><input class="text-input" id="document-name" required maxlength="100" autocomplete="off" aria-describedby="document-name-hint"><p class="edit-hint" id="document-name-hint">Nama hanya berubah setelah disimpan. URL file mengikuti nama baru.</p><div class="tool-actions"><button type="submit" class="small-button primary">Simpan nama</button><button type="button" class="small-button" data-action="cancelDocumentRename">Batal</button></div></form>`
      : `<h1>${actions.escape(page.title)}</h1>`;
    if (file)
      return `<header class="document-header"><p class="page-kicker">${actions.icon("doc")}${actions.escape(state.pages.find((p) => p.id === page.parent)?.title || "Workspace")}</p>${title}<div class="document-meta"><button class="access-meta ${page.visibility === "public" ? "public-access" : ""}" id="file-access" data-action="openShare" data-arg="${page.id}" aria-label="Atur akses file">${actions.accessLabel(page)}</button><span>${page.type === "pdf" ? "Dokumen PDF" : "Markdown"}</span><span>Diperbarui ${actions.escape(actions.dateLabel(page.modified))}</span><button class="document-properties" data-action="openDocumentProperties">Properti</button></div></header>`;
    return `<header class="workspace-heading"><div>${title}<p class="lead">${actions.escape(page.description || "Dokumentasi dan catatan dalam folder ini.")}</p></div><div class="heading-actions"><button class="small-button" data-action="chooseDocumentUpload">${actions.icon("upload")}Upload</button><button class="small-button primary" data-action="openCreate" data-arg="doc">${actions.icon("plus")}Halaman baru</button></div></header>`;
  }

  function render() {
    actions.$("main").parentElement.classList.toggle("task-board-layout", state.current === "tasks");
    actions.$("outline").hidden = state.pages.find((p) => p.id === state.current)?.type !== "doc";
    const page = state.pages.find((p) => p.id === state.current);
    actions.$("detail-share").hidden = !["doc", "pdf"].includes(page?.type);
    if (Object.hasOwn(state.managementPages, state.current))
      return actions.renderManagementPage(state.current);
    if (page?.type === "doc") return actions.renderDoc(page);
    if (page?.type === "pdf") {
      actions.trackOutline([]);
      const url = actions.appUrl("/media?document=" + encodeURIComponent(page.path));
      actions.$("main").innerHTML = `<div class="pdf-document">${header(page)}${pdfPreview(url, page.title, actions.escape, url + "&download=1")}</div>`;
      actions.mountDocumentTools(page);
      return;
    }
    const isRecent = state.current === "recent";
    const view = page || {
      title: "Terakhir dibuka",
      description: "Kembali ke dokumen yang baru saja kamu baca.",
      type: "folder",
    };
    const continuePages = (
      state.recent.length
        ? state.recent.map((id) => state.pages.find((p) => p.id === id))
        : state.pages
            .filter((p) => ["doc", "pdf"].includes(p.type))
            .sort((a, b) => b.modified.localeCompare(a.modified))
    )
      .filter(Boolean)
      .slice(0, 3);
    const recentCards =
      state.current === "home"
        ? `<section id="recent-section"><div class="section-heading"><h2>${state.recent.length ? "Lanjutkan dari sini" : "Dokumen terbaru"}</h2><button class="subtle" data-action="navigate" data-arg="recent">Lihat semua</button></div><div class="recent-grid">${continuePages.map((p) => `<button class="recent-card" data-action="navigate" data-arg="${p.id}"><span class="doc-symbol">${actions.icon("doc")}</span><strong>${actions.escape(p.title)}</strong><small>${actions.escape(state.pages.find((f) => f.id === p.parent)?.title || "Workspace")}</small></button>`).join("") || '<p class="subtle">Belum ada dokumen. Buat halaman pertamamu di bawah.</p>'}</div></section>`
        : "";
    actions.$("main").innerHTML =
      header(view) +
      recentCards +
      `<section class="library" id="documents-section">
      <div class="section-heading library-title"><h2>${isRecent ? "Riwayat bacaan" : "Di dalam workspace"}</h2><span class="subtle" id="item-count"></span></div>
      <div class="library-toolbar"><div class="tabs" role="tablist" aria-label="Filter dokumen">
        <button class="tab ${state.filter === "all" ? "selected" : ""}" role="tab" aria-selected="${state.filter === "all"}" data-action="setFilter" data-arg="all">${actions.icon("list")}Semua</button>
        <button class="tab ${state.filter === "folder" ? "selected" : ""}" role="tab" aria-selected="${state.filter === "folder"}" data-action="setFilter" data-arg="folder">Folder</button>
        <button class="tab ${state.filter === "doc" ? "selected" : ""}" role="tab" aria-selected="${state.filter === "doc"}" data-action="setFilter" data-arg="doc">Markdown</button>
        <button class="tab ${state.filter === "pdf" ? "selected" : ""}" role="tab" aria-selected="${state.filter === "pdf"}" data-action="setFilter" data-arg="pdf">PDF</button>
      </div><div class="library-actions"><button class="small-button" data-action="openSearch">${actions.icon("search")}Cari</button><button class="small-button" data-action="openCreate" data-arg="folder">${actions.icon("folder")}Folder</button></div></div>
      <div class="table-wrap"><table><thead><tr><th>Nama</th><th class="access-column">Akses</th><th class="date-column">Diperbarui</th><th class="action-column"><span class="sr-only">Aksi file</span></th></tr></thead><tbody id="entries"></tbody></table></div>
    </section><aside class="workspace-upload">${actions.icon("upload")}<div><strong>Tambahkan dokumen ke workspace</strong>Seret file .md atau PDF ke halaman ini.</div><button class="small-button" data-action="chooseDocumentUpload">Pilih file</button></aside><p class="workspace-note">Dokumen baru bersifat privat. Atur akses melalui Bagikan.</p>`;
    renderEntries();
    actions.$("outline").innerHTML = "";
    actions.trackOutline([]);
  }

  function setFilter(value) {
    state.filter = value;
    render();
  }

  function renderEntries() {
    const items = (
      state.current === "recent"
        ? state.recent.map((id) => state.pages.find((p) => p.id === id))
        : state.pages.filter((p) => p.parent === state.current)
    ).filter((p) => state.filter === "all" || p.type === state.filter);
    actions.$("item-count").textContent = `${items.length} item`;
    actions.$("entries").innerHTML = items.length
      ? items
          .map(
            (p) => `<tr>
      <td><button class="entry" data-action="navigate" data-arg="${p.id}">${actions.icon(p.type === "folder" ? "folder" : "doc", p.type === "folder" ? "folder-icon" : "")}<span>${actions.escape(p.title)}<small>${p.type === "folder" ? "Koleksi dokumen" : p.type === "pdf" ? "Dokumen PDF" : "Markdown"}</small></span></button></td>
      <td class="access-column">${p.type !== "folder" ? `<span class="file-access ${p.visibility === "public" ? "public-access" : ""}">${actions.accessLabel(p)}</span>` : '<span class="subtle">Folder</span>'}</td>
      <td class="date-column">${actions.escape(actions.dateLabel(p.modified))}</td>
      <td class="action-column">${p.type !== "folder" ? `<div class="row-actions"><button class="small-button row-share" data-action="openShare" data-arg="${p.id}" aria-label="Bagikan ${actions.escape(p.title)}" title="Bagikan file">${actions.icon("share")}<span>Bagikan</span></button><button class="small-button row-delete" data-action="deleteItem" data-arg="${p.id}" aria-label="Hapus ${actions.escape(p.title)}" title="Hapus file">${actions.icon("trash")}<span>Hapus</span></button></div>` : ""}</td>
    </tr>`,
          )
          .join("")
      : '<tr><td colspan="4"><div class="empty">Belum ada item di sini.<br>Buat halaman atau folder untuk mulai menulis.</div></td></tr>';
  }

  function activeFolder() {
    const page = state.pages.find((p) => p.id === state.current);
    return page?.type === "folder"
      ? page
      : state.pages.find((p) => p.id === page?.parent) || state.pages[0];
  }
  return {
    refreshWorkspace,
    header,
    render,
    setFilter,
    renderEntries,
    activeFolder,
  };
}
