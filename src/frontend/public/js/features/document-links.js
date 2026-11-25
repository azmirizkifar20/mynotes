export function createFeature({ state, actions }) {
  let destinations = new WeakMap();
  let request = 0;
  const esc = actions.escape;
  const reference = /^\/share\/document\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;

  function decorateDocumentLinks() {
    destinations = new WeakMap();
    const root = actions.$("live-editor");
    if (!root) return;
    for (const link of root.querySelectorAll('.vditor-ir [data-type="a"]')) {
      if (link.closest('code,.vditor-ir__marker--pre,.vditor-ir__preview,[data-type="html-block"],[data-type="html-inline"]')) continue;
      const match = reference.exec(link.querySelector(".vditor-ir__marker--link")?.textContent.trim() || "");
      if (!match) continue;
      const id = match[1].toLowerCase();
      const page = state.pages.find((page) => page.id === id && ["doc", "pdf"].includes(page.type));
      link.classList.add("document-reference");
      link.classList.toggle("document-reference-missing", !page);
      link.setAttribute("contenteditable", "false");
      link.setAttribute("role", "link");
      link.tabIndex = 0;
      link.title = page ? `Buka docs${page.path} di tab baru` : "Dokumen tidak tersedia";
      link.setAttribute("aria-disabled", String(!page));
      const label = link.querySelector(".vditor-ir__link");
      if (label) label.dataset.documentLabel = page?.path.split("/").pop() || "Dokumen tidak tersedia";
      destinations.set(link, page ? actions.appUrl("/share/document/" + id) : "");
    }
  }

  async function refreshDocumentRelations(page = state.pages.find((page) => page.id === state.current)) {
    const element = actions.$("document-relations");
    if (!page || !element) return;
    const sequence = ++request;
    const list = (items, empty) => items.length
      ? `<ul class="document-link-list">${items.map((item) => `<li><a href="${esc(actions.appUrl("/share/document/" + item.id))}" target="_blank" rel="noopener noreferrer">${actions.icon(item.kind === "pdf" ? "doc" : "book")}<span>${esc(item.path.split("/").pop())}<small>docs${esc(item.path)}</small></span>${actions.icon("chevron")}</a></li>`).join("")}</ul>`
      : `<p class="edit-hint">${empty}</p>`;
    try {
      const result = await actions.api("document-links?document=" + encodeURIComponent(page.id));
      if (!element.isConnected || state.current !== page.id || sequence !== request) return;
      element.innerHTML = `<section><h2>Dirujuk oleh <span>${result.incoming.length}</span></h2>${list(result.incoming, "Belum ada dokumen yang menautkan dokumen ini.")}</section>${page.type === "doc" ? `<section><h2>Tautan dokumen <span>${result.outgoing.length}</span></h2>${list(result.outgoing, "Ketik [[ di editor untuk menautkan dokumen Markdown atau PDF.")}</section>` : ""}`;
    } catch (error) {
      if (element.isConnected && sequence === request) element.innerHTML = `<p class="edit-hint" role="alert">${esc(error.message)}</p><button class="small-button" data-action="refreshDocumentRelations">Coba lagi</button>`;
    }
  }

  function bindDocumentLinks() {
    for (const type of ["click", "keydown"]) document.addEventListener(type, (event) => {
      if (type === "keydown" && !["Enter", " "].includes(event.key)) return;
      const link = event.target.closest?.('#live-editor [data-type="a"]');
      if (!link || !destinations.has(link)) return;
      event.preventDefault();
      event.stopPropagation();
      const url = destinations.get(link);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    }, true);
  }
  return { decorateDocumentLinks, refreshDocumentRelations, bindDocumentLinks };
}
