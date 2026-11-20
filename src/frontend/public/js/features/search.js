export function createFeature({ state, actions }) {
  function openSearch() {
    actions.$("search-input").value = "";
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
    if (!text) {
      actions.$("search-results").innerHTML =
        '<p class="empty">Cari judul, path, atau isi dokumen.</p>';
      return;
    }
    actions.$("search-results").innerHTML =
      '<p class="empty" role="status">Mencari…</p>';
    try {
      const data = await actions.api("search?q=" + encodeURIComponent(text));
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
