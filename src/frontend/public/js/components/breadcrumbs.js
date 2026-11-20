export function createFeature({ state, actions }) {
  function breadcrumbTrail(id) {
    const trail = [];
    for (
      let page = state.pages.find((p) => p.id === id);
      page;
      page = state.pages.find((p) => p.id === page.parent)
    )
      trail.unshift(page);
    return id === "recent" || Object.hasOwn(state.managementPages, id)
      ? [
          state.pages.find((p) => p.id === "home"),
          {
            id,
            title:
              id === "recent"
                ? "Terakhir dibuka"
                : state.managementPages[id].title,
          },
        ]
      : trail;
  }

  function renderBreadcrumbs() {
    const trail = breadcrumbTrail(state.current),
      container = actions.$("breadcrumb-path");
    container.innerHTML = trail
      .map((page, index) => {
        const label = actions.escape(
          page.id === "home"
            ? "docs"
            : page.id === "recent" ||
                Object.hasOwn(state.managementPages, page.id)
              ? page.title
              : page.path.split("/").pop(),
        );
        const item =
          index === trail.length - 1
            ? `<span aria-current="page">${label}</span>`
            : `<a href="${actions.escape(actions.urlFor(page))}" data-breadcrumb="${actions.escape(page.id)}">${label}</a>`;
        return `<li>${index ? '<span class="slash" aria-hidden="true">/</span>' : ""}${item}</li>`;
      })
      .join("");
    container.querySelectorAll("a").forEach((link) =>
      link.addEventListener("click", (event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        actions.navigate(link.dataset.breadcrumb);
      }),
    );
    container.scrollLeft = container.scrollWidth;
  }
  return { breadcrumbTrail, renderBreadcrumbs };
}
