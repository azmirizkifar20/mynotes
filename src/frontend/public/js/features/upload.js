export function createFeature({ state, actions }) {
  function resetFileDrag() {
    state.fileDragDepth = 0;
    actions.$("file-drop-zone").hidden = true;
  }

  async function openUploadPreview(file) {
    if (state.boot.mode !== "workspace" || !file) return;
    if (state.saving || document.querySelector("dialog[open]"))
      return actions.notify(
        "Selesaikan dialog atau proses yang sedang berjalan terlebih dahulu.",
      );
    if (!/\.(md|markdown)$/i.test(file.name))
      return actions.notify("Pilih file Markdown dengan ekstensi .md.");
    if (file.size > 5 * 1024 * 1024)
      return actions.notify("Ukuran file maksimal 5 MB.");
    const folder = actions.activeFolder();
    const upload = (state.pendingUpload = {
      file,
      folderPath: folder.path,
      ready: false,
      uploadedPath: null,
    });
    actions.$("upload-name").value = file.name.replace(/\.markdown$/i, ".md");
    actions.$("upload-name").disabled = false;
    actions.$("upload-name").setCustomValidity("");
    actions.$("upload-target").textContent = "docs" + folder.path;
    actions.$("upload-size").textContent =
      new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(
        file.size / 1024,
      ) + " KB";
    actions.$("upload-content").value = "";
    actions.$("upload-draft").hidden = !actions.isDirty();
    actions.$("upload-error").textContent = "";
    actions.$("upload-status").textContent = "Membaca file dari perangkat…";
    actions.$("confirm-upload").textContent = "Upload";
    actions.$("confirm-upload").disabled = true;
    actions.$("upload-form").setAttribute("aria-busy", "true");
    actions.$("upload-dialog").showModal();
    actions.$("upload-name").focus();
    try {
      const content = await file.text();
      if (state.pendingUpload !== upload) return;
      actions.$("upload-content").value = content;
      upload.ready = true;
      actions.$("confirm-upload").disabled = false;
      actions.$("upload-status").textContent =
        "Isi Markdown asli · belum diupload";
    } catch {
      if (state.pendingUpload === upload) {
        actions.$("upload-error").textContent =
          "File tidak dapat dibaca. Tutup dialog dan pilih file kembali.";
        actions.$("upload-status").textContent = "Gagal membaca file";
      }
    } finally {
      if (state.pendingUpload === upload)
        actions.$("upload-form").setAttribute("aria-busy", "false");
    }
  }

  function closeUploadDialog() {
    if (!state.saving) actions.$("upload-dialog").close();
  }

  async function confirmUpload(event) {
    event.preventDefault();
    const upload = state.pendingUpload;
    if (!upload?.ready || state.saving) return;
    const name = actions.$("upload-name").value.trim();
    if (!actions.validName(name) || !/\.md$/i.test(name)) {
      actions
        .$("upload-name")
        .setCustomValidity(
          "Gunakan nama file .md tanpa karakter path atau titik di awal/akhir.",
        );
      actions.$("upload-name").reportValidity();
      return;
    }
    const dialog = actions.$("upload-dialog");
    actions.setBusy(true);
    actions.$("upload-error").textContent = "";
    actions.$("upload-form").setAttribute("aria-busy", "true");
    dialog
      .querySelectorAll("button,input")
      .forEach((control) => (control.disabled = true));
    actions.$("confirm-upload").textContent = upload.uploadedPath
      ? "Memuat ulang…"
      : "Mengupload…";
    try {
      if (!upload.uploadedPath) {
        const data = new FormData();
        data.append("targetFolder", upload.folderPath);
        data.append("filename", name);
        data.append("file", upload.file);
        const result = await actions.api("upload", data);
        upload.uploadedPath = result.path;
      }
      await actions.refreshWorkspace();
      const folder = state.pages.find(
        (page) => page.type === "folder" && page.path === upload.folderPath,
      );
      await actions.navigate(folder?.id || "home", "push", true);
      dialog.close();
      actions.$("main").focus();
      actions.notify("File diupload sebagai privat.");
    } catch (error) {
      actions.$("upload-error").textContent = upload.uploadedPath
        ? "File sudah diupload, tetapi daftar belum berhasil dimuat. Klik Muat ulang daftar untuk melanjutkan."
        : error.message;
    } finally {
      actions.setBusy(false);
      actions.$("upload-form").setAttribute("aria-busy", "false");
      dialog
        .querySelectorAll("button,input")
        .forEach((control) => (control.disabled = false));
      actions.$("upload-name").disabled = Boolean(upload.uploadedPath);
      actions.$("confirm-upload").textContent = upload.uploadedPath
        ? "Muat ulang daftar"
        : "Upload";
    }
  }
  function bindUpload() {
    if (state.boot.mode === "workspace") {
      const isFileDrag = (event) =>
        Array.from(event.dataTransfer?.types || []).includes("Files");
      const canDrop = () =>
        !state.saving && !document.querySelector("dialog[open]");
      document.addEventListener("dragenter", (event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        state.fileDragDepth++;
        if (canDrop()) {
          actions.$("file-drop-target").textContent =
            "Folder tujuan: docs" + actions.activeFolder().path;
          actions.$("file-drop-zone").hidden = false;
        }
      });
      document.addEventListener("dragover", (event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = canDrop() ? "copy" : "none";
      });
      document.addEventListener("dragleave", () => {
        if (state.fileDragDepth > 0 && --state.fileDragDepth === 0)
          actions.resetFileDrag();
      });
      document.addEventListener("drop", (event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        actions.resetFileDrag();
        if (!canDrop())
          return actions.notify(
            "Selesaikan dialog atau proses yang sedang berjalan terlebih dahulu.",
          );
        if (
          Array.from(event.dataTransfer.items || []).some(
            (item) => item.webkitGetAsEntry?.()?.isDirectory,
          )
        )
          return actions.notify("Pilih file .md, bukan folder.");
        const files = event.dataTransfer.files;
        if (files.length !== 1)
          return actions.notify("Lepaskan satu file .md setiap kali upload.");
        if (!/\.md$/i.test(files[0].name))
          return actions.notify("Drag and drop hanya menerima file .md.");
        actions.openUploadPreview(files[0]);
      });
      window.addEventListener("dragend", actions.resetFileDrag);
      window.addEventListener("blur", actions.resetFileDrag);
    }
  }
  return {
    bindUpload,
    resetFileDrag,
    openUploadPreview,
    closeUploadDialog,
    confirmUpload,
  };
}
