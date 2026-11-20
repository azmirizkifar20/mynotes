export function bindActions({ state, actions }) {
  const handlers = Object.fromEntries(
    [
      "navigate",
      "removeFavorite",
      "setTheme",
      "authenticate",
      "openShare",
      "setFilter",
      "openSearch",
      "openCreate",
      "deleteItem",
      "moveDocument",
      "setEditing",
      "openHistory",
      "downloadDoc",
      "saveDoc",
      "copyDraft",
      "downloadDraft",
      "discardDraft",
      "recoverDraft",
      "restoreTrashed",
      "confirmPurge",
      "editTemplate",
      "useTemplate",
      "confirmTemplateDelete",
      "openTrash",
      "purgeTrashed",
      "saveTemplate",
      "openTemplates",
      "deleteTemplate",
      "previewVersion",
      "restoreVersion",
      "closeSidebar",
      "toggleSidebar",
      "importBrowserPreferences",
      "openActivity",
      "logout",
      "toggleFavorite",
      "openManage",
      "toggleWidth",
      "setAccess",
      "previewPublicAccess",
      "copyShareLink",
      "renameItem",
      "openMove",
      "confirmDelete",
      "closeDeleteDialog",
      "confirmUpload",
      "closeUploadDialog",
      "createDocument",
    ].map((name) => [name, actions[name]]),
  );
  handlers.closeDialog = (id) => {
    if (id !== "tool-dialog" || !state.toolBusy) actions.$(id).close();
  };
  handlers.searchNavigate = (id) => {
    actions.$("search-dialog").close();
    return actions.navigate(id);
  };
  handlers.shareFromPreview = () => {
    actions.$("visitor-dialog").close();
    return actions.openShare(state.sharingId);
  };
  handlers.selectText = (_unused, element) => element.select();
  for (const type of ["click", "submit", "change"])
    document.addEventListener(type, (event) => {
      const key = type === "click" ? "action" : type;
      const element = event.target.closest("[data-" + key + "]");
      if (!element || element.closest(".prose,#live-editor")) return;
      const handler = handlers[element.dataset[key]];
      if (!handler || element.disabled) return;
      if (type !== "change") event.preventDefault();
      if (element.dataset.stop) event.stopPropagation();
      let args = [];
      if (element.dataset.state) args.push(state[element.dataset.state]);
      else if (element.dataset.inputValue) args.push(element.value);
      else if ("arg" in element.dataset) {
        const value = element.dataset.arg;
        args.push(
          element.dataset.valueType === "boolean"
            ? value === "true"
            : element.dataset.valueType === "number"
              ? Number(value)
              : value,
        );
        if ("arg1" in element.dataset) args.push(element.dataset.arg1);
      }
      if (type === "submit") args.unshift(event);
      if (element.dataset[key] === "selectText") args = [null, element];
      Promise.resolve()
        .then(() => handler(...args))
        .catch((error) => actions.notify(error.message));
    });
  document.addEventListener(
    "cancel",
    (event) => {
      if (event.target.dataset.busy && state[event.target.dataset.busy])
        event.preventDefault();
    },
    true,
  );
  document.addEventListener(
    "close",
    (event) => {
      const key = event.target.dataset.reset;
      if (key === "deletion" || key === "pendingUpload") state[key] = null;
    },
    true,
  );
}
