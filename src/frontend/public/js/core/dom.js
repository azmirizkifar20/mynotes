export function createFeature({ state, actions }) {
  const $ = (id) => document.getElementById(id);

  const icon = (name, cls = "") =>
    `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  const appUrl = (path) => state.basePath + path;

  const urlFor = (page) =>
    appUrl(page.path.split("/").map(encodeURIComponent).join("/"));

  const dateLabel = (value) =>
    value
      ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
          new Date(value),
        )
      : "Workspace";

  function validName(value) {
    return (
      value &&
      !value.startsWith(".") &&
      !/[<>:"/\\|?*\x00-\x1f]/.test(value) &&
      !/[. ]$/.test(value)
    );
  }
  return { $, icon, escape, appUrl, urlFor, dateLabel, validName };
}
