import { readPreference } from "./state.js";

export function createFeature({ state, actions }) {
  function canLeave() {
    if (state.stickyDirty || state.stickySaving) {
      actions.notify("Tunggu sampai catatan tersimpan. Jika gagal, coba simpan atau unduh salinan terlebih dahulu.");
      return false;
    }
    if (actions.taskBoardDialogOpen?.()) {
      actions.notify("Simpan atau tutup pengaturan task board terlebih dahulu.");
      return false;
    }
    if (actions.$("document-rename-form")?.hidden === false) {
      actions.notify("Simpan atau batalkan perubahan nama terlebih dahulu.");
      return false;
    }
    if (state.saving || state.draftRequest || state.toolBusy) {
      actions.notify("Tunggu hingga proses selesai.");
      return false;
    }
    return (
      !actions.isDirty() ||
      confirm(
        "Tinggalkan editor? Hanya draft yang berhasil tersimpan yang dapat dipulihkan.",
      )
    );
  }

  async function navigate(
    id,
    historyMode = "push",
    completingMutation = false,
  ) {
    if (!completingMutation && !canLeave()) return false;
    const pageChanged = id !== state.current || !actions.$("main").childElementCount;
    const previousDraft = actions.documentContent();
    const page = state.pages.find((p) => p.id === id);
    if (!page && id !== "recent" && !Object.hasOwn(state.managementPages, id))
      return false;
    state.navigationPending++;
    try {
      const sequence = ++state.navigationSequence;
      if (page?.type === "doc") {
        try {
          const data = await actions.api("document", { filePath: page.path });
          if (sequence !== state.navigationSequence) return false;
          if (
            actions.isDirty() &&
            actions.documentContent() !== previousDraft &&
            !canLeave()
          )
            return false;
          page.body = data.content;
          page.html = data.html;
          page.modified = data.modified;
          page.revision = data.revision;
        } catch (error) {
          actions.notify(error.message);
          return false;
        }
      }
      if ((state.stickyDirty || state.stickySaving) && !canLeave()) return false;
      actions.destroyStickyNotes();
      actions.destroyLiveEditor();
      state.documentBuffer = null;
      state.current = id;
      state.filter = "all";
      state.editing = false;
      state.draftState = null;
      actions.closeSidebar();
      actions.$("tool-dialog").close();
      if (["doc", "pdf"].includes(page?.type)) {
        state.recent = [id, ...state.recent.filter((p) => p !== id)].slice(
          0,
          50,
        );
        actions.savePreference({ action: "opened", id });
      }
      actions.renderBreadcrumbs();
      actions.$("width-button").hidden = !["doc", "pdf"].includes(page?.type);
      actions.$("manage-button").hidden = id === "home" || !page;
      actions.$("favorite-button").hidden = !page;
      document
        .querySelectorAll("[data-nav]")
        .forEach((el) => el.classList.toggle("active", el.dataset.nav === id));
      actions.renderFavorites();
      actions.syncFavorite();
      actions.expandCurrentFolder();
      const rendering = actions.render();
      actions.$("workspace-scroll").scrollTo({ top: 0 });
      document.title =
        (page?.title ||
          (id === "recent"
            ? "Terakhir dibuka"
            : state.managementPages[id].title)) + " · Ruangku";
      const url = !page ? actions.appUrl("/?view=" + id) : actions.urlFor(page);
      if (historyMode === "replace") history.replaceState({ id }, "", url);
      else if (
        historyMode === "push" &&
        location.pathname + location.search !== url
      )
        history.pushState({ id }, "", url);
      state.activeUrl = url;
      await rendering;
      if (sequence !== state.navigationSequence) return false;
      if (pageChanged) actions.animateContent(actions.$("main"));
      if (page?.type === "doc") {
        try {
          await actions.loadDraft(page);
        } catch (error) {
          actions.notify("Draft belum dapat dimuat: " + error.message);
        }
      }
      return true;
    } finally {
      state.navigationPending--;
    }
  }

  async function initializeWorkspace() {
    actions.applyPreferences(state.boot.preferences);
    actions.$("import-preferences").hidden =
      Boolean(state.boot.preferences?.preferences_imported) ||
      ![
        ...readPreference("md-previewer-favorites"),
        ...readPreference("md-previewer-recent"),
      ].length;
    const initialHash = location.hash;
    await navigate(requestedView() || state.boot.current || "home", "replace");
    if (initialHash) {
      history.replaceState(
        history.state,
        "",
        location.pathname + location.search + initialHash,
      );
      actions.scrollToHash();
    }
    setInterval(async () => {
      const blocked = () =>
        document.hidden ||
        state.saving ||
        state.editing ||
        actions.isDirty() ||
        actions.$("live-editor")?.contains(document.activeElement) ||
        state.navigationPending ||
        state.draftRequest ||
        state.toolBusy ||
        actions.$("document-rename-form")?.hidden === false ||
        document.querySelector("dialog[open]");
      if (blocked()) return;
      const sequence = state.navigationSequence,
        viewed = state.current;
      try {
        const data = await actions.api("workspace");
        if (
          blocked() ||
          sequence !== state.navigationSequence ||
          viewed !== state.current
        )
          return;
        const previous = state.pages.find((page) => page.id === state.current);
        const known = new Map(state.pages.map((page) => [page.id, page]));
        const next = data.pages.map((page) => ({
          ...(known.get(page.id) || {}),
          ...page,
        }));
        const page = next.find((page) => page.id === state.current);
        const changed =
          ["doc", "pdf"].includes(page?.type) &&
          (page.revision !== previous?.revision ||
            page.path !== previous?.path);
        if (changed && page.type === "doc") {
          const document = await actions.api("document", {
            filePath: page.path,
          });
          if (
            blocked() ||
            sequence !== state.navigationSequence ||
            viewed !== state.current
          )
            return;
          Object.assign(page, {
            body: document.content,
            html: document.html,
            revision: document.revision,
            modified: document.modified,
          });
        }
        state.pages = next;
        actions.applyPreferences(data.preferences);
        actions.renderTree();
        if (state.current === "tasks") {
          await actions.refreshTaskBoard();
          return;
        }
        if (state.current === "today") {
          await actions.refreshToday();
          return;
        }
        if (state.current === "sticky") {
          await actions.refreshStickyNotes();
          return;
        }
        if (Object.hasOwn(state.managementPages, state.current)) return;
        if (state.current === "recent") actions.render();
        else if (!page) await navigate("home", "replace");
        else if (changed) {
          state.draftState = null;
          state.documentBuffer = null;
          actions.renderBreadcrumbs();
          actions.render();
          history.replaceState({ id: state.current }, "", actions.urlFor(page));
          state.activeUrl = actions.urlFor(page);
          if (page.type === "doc") await actions.loadDraft(page);
        } else if (page.type === "folder") actions.render();
      } catch {
        /* Keep the current page available during a temporary disconnect. */
      }
    }, 15000);
  }

  function requestedView() {
    const view = new URLSearchParams(location.search).get("view");
    return view === "recent" || Object.hasOwn(state.managementPages, view)
      ? view
      : null;
  }
  function bindNavigation() {
    window.addEventListener("popstate", async () => {
      if (state.boot.mode !== "workspace") return;
      if (state.saving) {
        history.pushState({ id: state.current }, "", state.activeUrl);
        actions.notify("Tunggu hingga proses selesai.");
        return;
      }
      let key;
      try {
        key =
          decodeURIComponent(
            location.pathname.slice(state.basePath.length),
          ).replace(/\/$/, "") || "/";
      } catch {
        location.reload();
        return;
      }
      const id =
        actions.requestedView() || state.pages.find((p) => p.path === key)?.id;
      if (!id) {
        if (actions.canLeave()) location.reload();
        else history.pushState({ id: state.current }, "", state.activeUrl);
        return;
      }
      if (id !== state.current && !(await actions.navigate(id, "none")))
        history.pushState({ id: state.current }, "", state.activeUrl);
    });
  }
  return {
    bindNavigation,
    canLeave,
    navigate,
    initializeWorkspace,
    requestedView,
  };
}
