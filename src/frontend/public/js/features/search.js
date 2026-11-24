export function createFeature({ state, actions }) {
  function openSearch() {
    actions.$("search-input").value = "";
    const folders = actions.$("search-folder");
    const previousFolder = folders.value;
    folders.innerHTML = '<option value="">Semua folder</option>' + state.pages
      .filter((page) => page.type === "folder" && page.path && page.path !== "/")
      .map((page) => `<option value="${actions.escape(page.path)}">${actions.escape(page.path)}</option>`).join("");
    if ([...folders.options].some((option) => option.value === previousFolder)) folders.value = previousFolder;
    renderSearch();
    actions.$("search-dialog").showModal();
    actions.$("search-input").focus();
  }

  function renderSearch() {
    renderFullSearch();
  }

  function highlightSearch(value, query) {
    const terms = [
      ...new Set([query.trim(), ...(query.match(/[\p{L}\p{N}]+/gu) || [])]),
    ]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    if (!terms.length) return actions.escape(value);
    const pattern = new RegExp(
      "(" +
        terms
          .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|") +
        ")",
      "giu",
    );
    return String(value)
      .split(pattern)
      .map((part, index) =>
        index % 2
          ? "<mark>" + actions.escape(part) + "</mark>"
          : actions.escape(part),
      )
      .join("");
  }

  async function renderFullSearch() {
    const text = actions.$("search-input").value.trim(),
      sequence = ++state.searchSequence;
    const params = new URLSearchParams({ q: text });
    for (const [name, id] of [["folder", "search-folder"], ["type", "search-type"], ["visibility", "search-visibility"], ["updatedFrom", "search-updated-from"], ["updatedTo", "search-updated-to"]]) {
      const value = actions.$(id).value;
      if (value) params.set(name, value);
    }
    if (params.get("updatedFrom") && params.get("updatedTo") && params.get("updatedFrom") > params.get("updatedTo")) {
      actions.$("search-results").innerHTML = '<p class="empty" role="alert">Tanggal mulai harus sebelum atau sama dengan tanggal akhir.</p>';
      return;
    }
    if (!text && params.size === 1) {
      actions.$("search-results").innerHTML =
        '<p class="empty">Cari judul, path, atau isi dokumen.</p>';
      return;
    }
    actions.$("search-results").innerHTML =
      '<p class="empty" role="status">Mencari…</p>';
    try {
      const data = await actions.api("search?" + params);
      if (sequence !== state.searchSequence) return;
      actions.$("search-results").innerHTML =
        data.items
          .map(
            (item) =>
              `<button class="search-result" data-action="searchNavigate" data-arg="${item.id}">${actions.icon(item.kind === "folder" ? "folder" : "doc")}<span>${highlightSearch(item.path.split("/").pop(), text)}<small>${highlightSearch("docs" + item.path, text)}</small><small class="search-snippet">${highlightSearch(item.snippet, text)}</small></span></button>`,
          )
          .join("") || '<p class="empty">Tidak ada hasil yang cocok.</p>';
    } catch (error) {
      if (sequence === state.searchSequence)
        actions.$("search-results").innerHTML =
          '<p class="empty" role="alert">' +
          actions.escape(error.message) +
          "</p>";
    }
  }

  function scheduleSearch() {
    clearTimeout(state.searchTimer);
    ++state.searchSequence;
    state.searchTimer = setTimeout(renderFullSearch, 250);
  }
  return {
    openSearch,
    renderSearch,
    highlightSearch,
    renderFullSearch,
    scheduleSearch,
  };
}
