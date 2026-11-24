import { createState } from "./core/state.js";
import { bindActions } from "./core/events.js";
import { createFeature as createApi } from "./core/api.js";
import { createFeature as createNavigation } from "./core/navigation.js";
import { createFeature as createDom } from "./core/dom.js";
import { createFeature as createSidebar } from "./components/sidebar.js";
import { createFeature as createBreadcrumbs } from "./components/breadcrumbs.js";
import { createFeature as createDialogs } from "./components/dialogs.js";
import { createFeature as createToast } from "./components/toast.js";
import { createFeature as createAuth } from "./features/auth.js";
import { createFeature as createTheme } from "./features/theme.js";
import { createFeature as createPreferences } from "./features/preferences.js";
import { createFeature as createWorkspace } from "./features/workspace.js";
import { createFeature as createDocuments } from "./features/documents.js";
import { createFeature as createSharing } from "./features/sharing.js";
import { createFeature as createUpload } from "./features/upload.js";
import { createFeature as createSearch } from "./features/search.js";
import { createFeature as createEditor } from "./features/editor/controller.js";
import { createFeature as createLiveEditor } from "./features/editor/live-editor.js";
import { createFeature as createImages } from "./features/editor/images.js";
import { createFeature as createDrafts } from "./features/editor/drafts.js";
import { createFeature as createManagementPages } from "./features/management/pages.js";
import { createFeature as createTrash } from "./features/management/trash.js";
import { createFeature as createTemplates } from "./features/management/templates.js";
import { createFeature as createHistory } from "./features/management/history.js";
import { createFeature as createPasskeys } from "./features/management/passkeys.js";
import { createFeature as createTaskBoard } from "./features/task-board/controller.js";
import { createFeature as createDocumentTools } from "./features/document-tools.js";

const state = createState(
  JSON.parse(document.getElementById("bootstrap").textContent),
);
const actions = {};
const context = { state, actions };
Object.assign(actions, createApi(context));
Object.assign(actions, createNavigation(context));
Object.assign(actions, createDom(context));
Object.assign(actions, createSidebar(context));
Object.assign(actions, createBreadcrumbs(context));
Object.assign(actions, createDialogs(context));
Object.assign(actions, createToast(context));
Object.assign(actions, createAuth(context));
Object.assign(actions, createTheme(context));
Object.assign(actions, createPreferences(context));
Object.assign(actions, createWorkspace(context));
Object.assign(actions, createDocuments(context));
Object.assign(actions, createSharing(context));
Object.assign(actions, createUpload(context));
Object.assign(actions, createSearch(context));
Object.assign(actions, createEditor(context));
Object.assign(actions, createLiveEditor(context));
Object.assign(actions, createImages(context));
Object.assign(actions, createDrafts(context));
Object.assign(actions, createManagementPages(context));
Object.assign(actions, createTrash(context));
Object.assign(actions, createTemplates(context));
Object.assign(actions, createHistory(context));
Object.assign(actions, createPasskeys(context));
Object.assign(actions, createTaskBoard(context));
Object.assign(actions, createDocumentTools(context));
bindActions(context);
actions.bindUpload();
actions.bindDocumentImages();
actions.bindNavigation();
actions.bindTaskBoard();
actions.bindDocumentTools();
matchMedia("(prefers-color-scheme: dark)").addEventListener(
  "change",
  actions.applyTheme,
);
actions
  .$("new-name")
  .addEventListener("input", () => actions.$("new-name").setCustomValidity(""));
actions
  .$("rename-name")
  .addEventListener("input", () =>
    actions.$("rename-name").setCustomValidity(""),
  );
actions.$("search-input").addEventListener("input", actions.scheduleSearch);
actions
  .$("upload-name")
  .addEventListener("input", () =>
    actions.$("upload-name").setCustomValidity(""),
  );
actions.$("upload-input").addEventListener("change", (event) => {
  actions.openUploadPreview(event.target.files[0]);
  event.target.value = "";
});
document.addEventListener("keydown", (event) => {
  if (state.boot.mode !== "workspace") return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (!document.querySelector("dialog[open]")) actions.openSearch();
  }
  if (event.key === "Escape") {
    actions.resetFileDrag();
    actions.closeSidebar();
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "s" &&
    state.pages.find((page) => page.id === state.current)?.type === "doc"
  ) {
    event.preventDefault();
    if (!document.querySelector("dialog[open]")) actions.saveDoc();
  }
});
window.addEventListener("beforeunload", (event) => {
  if (actions.isDirty() || state.saving || state.taskBoardDirty || state.toolBusy) {
    event.preventDefault();
    event.returnValue = "";
  }
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
actions.$("theme-select").value = state.themePreference;
matchMedia("(max-width:760px)").addEventListener("change", actions.syncSidebar);
if (state.boot.mode === "workspace") {
  actions.$("auth-fields").innerHTML = state.loginFields.replaceAll(
    "access-code",
    "session-code",
  );
  actions.$("workspace-app").hidden = false;
  actions.renderTree();
  actions.initializeWorkspace().catch((error) => actions.notify(error.message));
} else {
  actions.renderAccessPage();
  const outline = actions.$("public-outline");
  if (outline) {
    const count = actions.decorateHeadings(
      document.querySelector(".public-document .prose"), true, outline,
    );
    outline.hidden = count === 0;
    outline.parentElement.classList.toggle("has-outline", count > 0);
  }
  actions.scrollToHash();
}
if (state.boot.mode === "workspace" || state.boot.mode === "login")
  actions.initializeAuth();
