export function createFeature({ state, actions }) {
  function openCreate(type) {
    state.createType = type;
    actions.$("create-title").textContent =
      type === "folder" ? "Folder baru" : "Halaman baru";
    actions.$("name-label").textContent =
      type === "folder" ? "Nama folder" : "Judul halaman";
    actions.$("create-dialog").querySelector(".edit-hint").textContent =
      type === "doc"
        ? "Halaman baru dimulai sebagai privat. Ubah akses melalui Bagikan saat siap dipublikasikan."
        : "Folder disimpan di dalam " + actions.activeFolder().title + ".";
    actions.$("new-name").value = "";
    actions.$("create-dialog").showModal();
    actions.$("template-field").hidden = type !== "doc";
    if (type === "doc") actions.prepareTemplatePicker();
  }

  function openManage(id) {
    const page = state.pages.find((p) => p.id === id);
    if (!page || id === "home") return;
    state.manageId = id;
    actions.$("manage-title").textContent =
      page.type === "folder" ? "Kelola folder" : "Kelola halaman";
    actions.$("rename-name").value = page.title;
    actions.$("manage-dialog").showModal();
  }

  function clearNameValidity(event) {
    event.target.setCustomValidity("");
  }

  function renameKeydown(event) {
    if (event.key === "Escape" && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      cancelDocumentRename();
    }
  }

  function editDocumentName() {
    const page = state.pages.find((p) => p.id === state.current);
    if (page?.type !== "doc" || state.saving || state.navigationPending || state.toolBusy)
      return;
    const input = actions.$("document-name");
    input.value = page.title;
    input.setCustomValidity("");
    input.addEventListener("input", clearNameValidity);
    actions.$("document-rename-form").addEventListener("keydown", renameKeydown);
    actions.$("document-title").hidden = true;
    actions.$("document-rename-form").hidden = false;
    input.focus();
    input.select();
  }

  function cancelDocumentRename() {
    if (state.saving) return;
    actions.$("document-rename-form").hidden = true;
    actions.$("document-title").hidden = false;
    actions.$("document-title-button").focus();
  }

  async function renameItem(event, id = state.manageId) {
    event.preventDefault();
    if (state.saving || state.navigationPending || state.toolBusy) return;
    const inline = event.target.id === "document-rename-form";
    const input = actions.$(inline ? "document-name" : "rename-name");
    const name = input.value.trim();
    if (!actions.validName(name)) {
      input.setCustomValidity("Nama tidak valid.");
      input.reportValidity();
      return;
    }
    if (!inline && !actions.canLeave()) return;
    const page = state.pages.find((p) => p.id === id),
      oldPages = state.pages;
    if (!page || (inline && (page.type !== "doc" || id !== state.current))) return;
    if (inline && name === page.title) return cancelDocumentRename();
    const controls = [...event.target.elements];
    controls.forEach((control) => { control.disabled = true; });
    actions.setBusy(true);
    try {
      if (inline) await actions.flushDraft();
      const result = await actions.api("rename", {
        path: page.path,
        newName: name,
      });
      state.editing = false;
      await actions.refreshWorkspace();
      const remap = (id) => {
        const oldPath = oldPages.find((p) => p.id === id)?.path;
        const nextPath =
          oldPath === page.path || oldPath?.startsWith(page.path + "/")
            ? result.path + oldPath.slice(page.path.length)
            : oldPath;
        return state.pages.find((p) => p.path === nextPath)?.id;
      };
      state.recent = state.recent.map(remap).filter(Boolean);
      const nextFavorites = [...state.favorites].map(remap).filter(Boolean);
      state.favorites.clear();
      nextFavorites.forEach((id) => state.favorites.add(id));
      actions.persistNavigation();
      actions.$("manage-dialog").close();
      await actions.navigate(
        state.pages.find((p) => p.path === result.path).id,
        "replace",
        true,
      );
      actions.notify(
        "Nama diperbarui. URL mengikuti nama baru; pengaturan akses tetap tersimpan.",
      );
      if (inline) actions.$("document-title-button")?.focus();
    } catch (error) {
      actions.notify(error.message);
    } finally {
      actions.setBusy(false);
      controls.forEach((control) => { control.disabled = false; });
    }
  }

  function deleteItem(id = state.manageId) {
    const page = state.pages.find((p) => p.id === id);
    if (!page || id === "home" || actions.$("delete-dialog").open) return;
    if (state.saving) return actions.notify("Tunggu hingga proses selesai.");
    state.deletion = { id, force: false, removed: false };
    actions.$("delete-title").textContent =
      page.type === "folder" ? "Hapus folder?" : "Hapus file?";
    actions.$("delete-description").textContent =
      "Item akan dipindahkan ke sampah dan bisa dipulihkan. Link publik tidak dapat dibuka selama item berada di sampah.";
    actions.$("delete-filename").textContent = page.path.split("/").pop();
    actions.$("delete-path").textContent = "docs" + page.path;
    actions.$("delete-draft").hidden = !actions.isDirty();
    actions.$("delete-error").textContent = "";
    actions.$("confirm-delete").textContent =
      page.type === "folder" ? "Hapus folder" : "Hapus file";
    actions.$("delete-dialog").showModal();
    actions.$("cancel-delete").focus();
  }

  function closeDeleteDialog() {
    if (!state.saving) actions.$("delete-dialog").close();
  }

  async function confirmDelete(event) {
    event.preventDefault();
    const target = state.deletion,
      page = state.pages.find((p) => p.id === target?.id);
    if (!page || page.id === "home" || state.saving) return;
    const dialog = actions.$("delete-dialog"),
      button = actions.$("confirm-delete");
    actions.setBusy(true);
    actions.$("delete-error").textContent = "";
    actions.$("delete-form").setAttribute("aria-busy", "true");
    dialog
      .querySelectorAll("button")
      .forEach((control) => (control.disabled = true));
    button.textContent = target.removed ? "Memuat ulang…" : "Menghapus…";
    try {
      if (!target.removed) {
        await actions.api("delete", { path: page.path, force: target.force });
        target.removed = true;
      }
      state.editing = false;
      await actions.refreshWorkspace();
      state.recent = state.recent.filter((id) =>
        state.pages.some((p) => p.id === id),
      );
      [...state.favorites]
        .filter((id) => !state.pages.some((p) => p.id === id))
        .forEach((id) => state.favorites.delete(id));
      actions.persistNavigation();
      const destination =
        state.current === "recent" ||
        state.pages.some((p) => p.id === state.current)
          ? state.current
          : state.pages.some((p) => p.id === page.parent)
            ? page.parent
            : "home";
      actions.$("manage-dialog").close();
      await actions.navigate(destination, "replace", true);
      dialog.close();
      actions.$("main").focus();
      actions.notify("Item dihapus.");
    } catch (error) {
      if (error.requiresConfirm) {
        target.force = true;
        actions.$("delete-title").textContent = "Hapus folder beserta isinya?";
        actions.$("delete-description").textContent =
          "Semua file dan subfolder akan dipindahkan ke sampah bersama folder ini. Konfirmasi sekali lagi untuk melanjutkan.";
      } else {
        actions.$("delete-error").textContent = error.message;
        if (target.removed)
          actions.$("delete-description").textContent =
            "Item sudah dihapus, tetapi daftar belum berhasil dimuat ulang. Coba muat ulang daftar.";
      }
    } finally {
      actions.setBusy(false);
      actions.$("delete-form").setAttribute("aria-busy", "false");
      dialog
        .querySelectorAll("button")
        .forEach((control) => (control.disabled = false));
      button.textContent = target.removed
        ? "Muat ulang daftar"
        : target.force
          ? "Hapus semua isi"
          : page.type === "folder"
            ? "Hapus folder"
            : "Hapus file";
      if (dialog.open && target.force) actions.$("cancel-delete").focus();
    }
  }

  function openMove() {
    const page = state.pages.find((page) => page.id === state.manageId);
    if (!page || !actions.canLeave()) return;
    actions.$("manage-dialog").close();
    const folders = state.pages.filter(
      (folder) =>
        folder.type === "folder" &&
        folder.id !== page.id &&
        folder.id !== page.parent &&
        !folder.path.startsWith(page.path + "/"),
    );
    actions.tool(
      "Pindahkan " + page.title,
      `<form data-submit="moveDocument"><label class="field-label" for="move-target">Folder tujuan</label><select id="move-target" class="text-input">${folders.map((folder) => `<option value="${actions.escape(folder.path)}" ${folder.id === page.parent ? "selected" : ""}>docs${actions.escape(folder.path)}</option>`).join("")}</select><p class="edit-hint">Favorit, riwayat, dan pengaturan akses tetap tersimpan. URL berbasis path berubah mengikuti lokasi baru.</p><button type="submit" class="small-button primary">Pindahkan</button></form>`,
    );
  }

  function moveDocument(event) {
    event.preventDefault();
    const page = state.pages.find((page) => page.id === state.manageId);
    const targetFolder = actions.$("move-target").value;
    actions.toolAction(
      () => actions.api("move", { path: page.path, targetFolder }),
      () => actions.updateAfterMutation("Item berhasil dipindahkan."),
    );
  }
  async function createDocument(event) {
    event.preventDefault();
    const name = actions.$("new-name").value.trim();
    if (!actions.validName(name)) {
      actions
        .$("new-name")
        .setCustomValidity(
          "Gunakan nama tanpa karakter path atau titik di awal/akhir.",
        );
      actions.$("new-name").reportValidity();
      return;
    }
    if (!actions.canLeave()) return;
    const type = state.createType,
      parent = actions.activeFolder();
    const filename =
      type === "doc" && !/\.md$/i.test(name) ? name + ".md" : name;
    const path = parent.path.replace(/\/$/, "") + "/" + filename;
    const submit = event.submitter;
    submit.disabled = true;
    actions.setBusy(true);
    try {
      await actions.api(
        type === "folder" ? "create-folder" : "save",
        type === "folder"
          ? { folderPath: path }
          : {
              filePath: path,
              content: actions.documentInitialContent(name),
              create: true,
            },
      );
      state.editing = false;
      await actions.refreshWorkspace();
      actions.$("create-dialog").close();
      const page = state.pages.find((p) => p.path === path);
      if (page) {
        await actions.navigate(page.id, "push", true);
        actions.setBusy(false);
        if (type === "doc") actions.setEditing(true);
      }
      actions.notify(
        type === "folder" ? "Folder dibuat." : "Halaman privat siap ditulis.",
      );
    } catch (error) {
      actions.notify(error.message);
    } finally {
      actions.setBusy(false);
      submit.disabled = false;
    }
  }
  return {
    createDocument,
    openCreate,
    openManage,
    editDocumentName,
    cancelDocumentRename,
    renameItem,
    deleteItem,
    closeDeleteDialog,
    confirmDelete,
    openMove,
    moveDocument,
  };
}
