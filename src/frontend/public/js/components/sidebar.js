export function createFeature({ state, actions }) {
  function renderTree() {
    function children(parent) {
      return state.pages
        .filter((p) => p.parent === parent && p.type === "folder")
        .map((p) => {
          const nested = state.pages.some(
            (child) => child.parent === p.id && child.type === "folder",
          );
          const button =
            '<button type="button" class="nav-item" data-nav="' +
            p.id +
            '" data-action="navigate" data-arg="' +
            p.id +
            '" data-stop="true">' +
            actions.icon("folder") +
            "<span>" +
            actions.escape(p.title) +
            "</span></button>";
          return nested
            ? '<details class="tree-group"><summary>' +
                actions.icon("chevron") +
                button +
                '</summary><div class="tree-children">' +
                children(p.id) +
                "</div></details>"
            : button;
        })
        .join("");
    }
    actions.$("folder-tree").innerHTML = children("home");
    expandCurrentFolder();
  }

  function expandCurrentFolder() {
    const active = document.querySelector('[data-nav="' + state.current + '"]');
    let parent = active?.parentElement;
    while (parent) {
      if (parent.tagName === "DETAILS") parent.open = true;
      parent = parent.parentElement;
    }
  }

  function syncSidebar() {
    const mobile = matchMedia("(max-width:760px)").matches;
    const expanded = mobile
      ? document.body.classList.contains("mobile-open")
      : !document.body.classList.contains("sidebar-hidden");
    document.querySelector(".sidebar").inert = !expanded;
    document.querySelector(".workspace").inert = mobile && expanded;
    document
      .querySelectorAll(".sidebar-toggle,.collapse")
      .forEach((button) => {
        button.setAttribute("aria-expanded", expanded);
        button.setAttribute("aria-label", mobile ? "Buka navigasi" : expanded ? "Sembunyikan sidebar" : "Tampilkan sidebar");
      });
  }

  function closeSidebar() {
    const returnFocus = document.querySelector(".sidebar").contains(document.activeElement);
    document.body.classList.remove("mobile-open");
    syncSidebar();
    if (returnFocus) document.querySelector(".sidebar-toggle").focus();
  }

  function toggleSidebar() {
    if (matchMedia("(max-width:760px)").matches)
      document.body.classList.toggle("mobile-open");
    else document.body.classList.toggle("sidebar-hidden");
    syncSidebar();
    if (document.body.classList.contains("mobile-open"))
      document.querySelector(".sidebar [data-action=closeSidebar]").focus();
  }

  function renderFavorites() {
    actions.$("favorites").innerHTML =
      [...state.favorites]
        .map((id) => state.pages.find((p) => p.id === id))
        .filter(Boolean)
        .map(
          (p) =>
            `<div class="favorite-item"><button type="button" class="nav-item ${state.current === p.id ? "active" : ""}" data-action="navigate" data-arg="${p.id}">${actions.icon(p.type === "folder" ? "folder" : "doc")}<span>${actions.escape(p.title)}</span></button><button type="button" class="icon-button favorite-remove" data-action="removeFavorite" data-arg="${p.id}" aria-label="Hapus ${actions.escape(p.title)} dari favorit" title="Hapus dari favorit">${actions.icon("close")}</button></div>`,
        )
        .join("") ||
      '<div class="subtle" style="padding:5px 10px">Belum ada halaman favorit.</div>';
  }
  return {
    renderTree,
    expandCurrentFolder,
    syncSidebar,
    closeSidebar,
    toggleSidebar,
    renderFavorites,
  };
}
