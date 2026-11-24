import { pdfPreview } from "./pdf.js";

export function createFeature({ state, actions }) {
  let previewUrl = null;
  function clearUploadPreview() {
    actions.$("upload-pdf-preview").innerHTML = "";
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
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
    if (!/\.(md|markdown|pdf)$/i.test(file.name))
      return actions.notify("Pilih file Markdown (.md) atau PDF (.pdf).");
    if (file.size > 5 * 1024 * 1024)
      return actions.notify("Ukuran file maksimal 5 MB.");
    const folder = actions.activeFolder();
    const pdf = /\.pdf$/i.test(file.name);
    clearUploadPreview();
    const upload = (state.pendingUpload = {
      file,
      pdf,
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
    actions.$("upload-content").hidden = pdf;
    actions.$("upload-content-label").hidden = pdf;
    actions.$("upload-pdf-preview").hidden = !pdf;
    actions.$("upload-dialog").classList.toggle("pdf-upload", pdf);
    actions.$("upload-name-hint").textContent = `Gunakan ekstensi ${pdf ? ".pdf" : ".md"}. File dengan nama yang sama tidak akan ditimpa.`;
    actions.$("upload-draft").hidden = !actions.isDirty();
    actions.$("upload-error").textContent = "";
    actions.$("upload-status").textContent = "Membaca file dari perangkat…";
    actions.$("confirm-upload").textContent = "Upload";
    actions.$("confirm-upload").disabled = true;
    actions.$("upload-form").setAttribute("aria-busy", "true");
    actions.$("upload-dialog").showModal();
    actions.$("upload-name").focus();
    try {
      const content = await (pdf ? file.slice(0, 8).text() : file.text());
      if (state.pendingUpload !== upload) return;
      if (pdf) {
        if (!/^%PDF-[12]\.\d/.test(content)) throw new Error("PDF tidak valid");
        previewUrl = URL.createObjectURL(new Blob([file], { type: "application/pdf" }));
        actions.$("upload-pdf-preview").innerHTML = pdfPreview(previewUrl, file.name, actions.escape);
      } else actions.$("upload-content").value = content;
      upload.ready = true;
      actions.$("confirm-upload").disabled = false;
      actions.$("upload-status").textContent =
        pdf ? "Pratinjau PDF dari perangkat · belum diupload" : "Isi Markdown asli · belum diupload";
    } catch {
      if (state.pendingUpload === upload) {
        actions.$("upload-error").textContent =
          "File tidak dapat dibaca atau format tidak valid. Tutup dialog dan pilih file kembali.";
        actions.$("upload-status").textContent = "Gagal membaca file";
      }
    } finally {
      if (state.pendingUpload === upload)
        actions.$("upload-form").setAttribute("aria-busy", "false");
    }
  }

  function closeUploadDialog() {
    if (!state.saving) { clearUploadPreview(); actions.$("upload-dialog").close(); }
  }

  async function confirmUpload(event) {
    event.preventDefault();
    const upload = state.pendingUpload;
    if (!upload?.ready || state.saving) return;
    const name = actions.$("upload-name").value.trim();
    const extension = upload.pdf ? ".pdf" : ".md";
    if (!actions.validName(name) || !(upload.pdf ? /\.pdf$/i : /\.md$/i).test(name)) {
      actions
        .$("upload-name")
        .setCustomValidity(
          `Gunakan nama file ${extension} tanpa karakter path atau titik di awal/akhir.`,
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
    actions.$("upload-dialog").addEventListener("close", clearUploadPreview);
    if (state.boot.mode === "workspace") {
      const isFileDrag = (event) =>
        Array.from(event.dataTransfer?.types || []).includes("Files");
      const canDrop = () =>
        !state.saving && !state.toolBusy && !document.querySelector("dialog[open]");
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
        if (event.target?.closest?.("#board-attachments")) return;
        event.preventDefault();
        event.stopPropagation();
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
          return actions.notify("Pilih file .md atau .pdf, bukan folder.");
        const files = event.dataTransfer.files;
        if (files.length !== 1)
          return actions.notify("Lepaskan satu file setiap kali upload.");
        if (/\.(png|jpe?g|gif|webp)$/i.test(files[0].name))
          return actions.uploadDocumentImage(files[0], event);
        if (!/\.(md|pdf)$/i.test(files[0].name))
          return actions.notify("Pilih file .md, .pdf, atau gambar PNG/JPEG/GIF/WebP pada halaman Markdown.");
        actions.openUploadPreview(files[0]);
      }, true);
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
