import { pdfPreview } from "./pdf.js";

const supported = /\.(md|markdown|pdf|png|jpe?g|gif|webp)$/i;
const imageFile = /\.(png|jpe?g|gif|webp)$/i;
const extension = name => name.match(/\.[^.]+$/)?.[0].toLowerCase().replace(".markdown", ".md").replace(".jpeg", ".jpg");

export function createFeature({ state, actions }) {
  let previewUrl = null;
  function chooseDocumentUpload() { actions.$("upload-input").click(); }
  function clearUploadPreview() {
    actions.$("upload-pdf-preview").innerHTML = "";
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  function resetFileDrag() {
    state.fileDragDepth = 0;
    actions.$("file-drop-zone").hidden = true;
  }
  function renderUploadFiles() {
    const upload = state.pendingUpload;
    if (!upload) return;
    actions.$("upload-files").innerHTML = upload.files.map((item, index) =>
      `<div class="upload-file-row"><button type="button" class="upload-file-choice" data-action="selectUploadFile" data-arg="${index}" aria-pressed="${index === upload.selected}" ${state.saving ? "disabled" : ""}><span>${actions.escape(item.name)}</span><small>${item.uploadedPath ? "Terupload" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(item.file.size / 1024) + " KB"}</small></button>${item.uploadedPath ? "" : `<button type="button" class="icon-button" data-action="removeUploadFile" data-arg="${index}" aria-label="Keluarkan ${actions.escape(item.name)} dari pilihan" ${state.saving ? "disabled" : ""}>${actions.icon("close")}</button>`}</div>`,
    ).join("");
    actions.$("upload-size").textContent = `${upload.files.length} file · maksimal 5 MB per file`;
  }
  function updateUploadName() {
    const upload = state.pendingUpload;
    actions.$("upload-name").setCustomValidity("");
    if (!upload || state.saving) return;
    const item = upload.files[upload.selected];
    if (!item.uploadedPath) item.name = actions.$("upload-name").value;
    renderUploadFiles();
  }
  async function selectUploadFile(value) {
    const upload = state.pendingUpload;
    const index = Number(value);
    if (!upload || state.saving || !Number.isInteger(index) || !upload.files[index]) return;
    upload.selected = index;
    upload.ready = false;
    const sequence = ++upload.previewSequence;
    const item = upload.files[index];
    const pdf = /\.pdf$/i.test(item.file.name);
    const image = imageFile.test(item.file.name);
    clearUploadPreview();
    renderUploadFiles();
    actions.$("upload-name").value = item.name;
    actions.$("upload-name").disabled = Boolean(item.uploadedPath);
    actions.$("upload-name").setCustomValidity("");
    actions.$("upload-content").value = "";
    actions.$("upload-content").hidden = pdf || image;
    actions.$("upload-content-label").hidden = pdf || image;
    actions.$("upload-pdf-preview").hidden = !pdf && !image;
    actions.$("upload-dialog").classList.toggle("pdf-upload", pdf);
    actions.$("upload-name-hint").textContent = `Pertahankan ekstensi ${extension(item.file.name)}. File dengan nama yang sama tidak akan ditimpa.`;
    actions.$("upload-error").textContent = "";
    actions.$("upload-status").textContent = "Membaca file dari perangkat…";
    actions.$("confirm-upload").disabled = true;
    actions.$("upload-form").setAttribute("aria-busy", "true");
    actions.$("upload-name").focus();
    const current = () => state.pendingUpload === upload && upload.previewSequence === sequence;
    try {
      if (pdf) {
        if (!/^%PDF-[12]\.\d/.test(await item.file.slice(0, 8).text())) throw new Error("PDF tidak valid");
        if (!current()) return;
        previewUrl = URL.createObjectURL(new Blob([item.file], { type: "application/pdf" }));
        actions.$("upload-pdf-preview").innerHTML = pdfPreview(previewUrl, item.file.name, actions.escape);
      } else if (image) {
        previewUrl = URL.createObjectURL(item.file);
        const preview = new Image();
        preview.className = "upload-image-preview";
        preview.alt = item.file.name;
        preview.src = previewUrl;
        await preview.decode();
        if (!current()) return;
        actions.$("upload-pdf-preview").replaceChildren(preview);
      } else {
        const content = await item.file.text();
        if (!current()) return;
        actions.$("upload-content").value = content;
      }
      if (!current()) return;
      upload.ready = true;
      actions.$("confirm-upload").disabled = false;
      actions.$("confirm-upload").textContent = upload.files.every(file => file.uploadedPath) ? "Muat ulang daftar" : upload.files.some(file => file.uploadedPath) ? "Upload file tersisa" : upload.files.length > 1 ? "Upload semua" : "Upload";
      actions.$("upload-status").textContent = item.uploadedPath ? "File sudah terupload." : "Pratinjau dari perangkat · belum diupload";
    } catch {
      if (current()) {
        actions.$("upload-error").textContent = "File tidak dapat dibaca atau format tidak valid. Keluarkan file ini dari pilihan atau pilih file kembali.";
        actions.$("upload-status").textContent = "Gagal membaca file";
      }
    } finally {
      if (current()) actions.$("upload-form").setAttribute("aria-busy", "false");
    }
  }
  async function openUploadPreview(selection) {
    if (state.boot.mode !== "workspace") return;
    const files = selection?.name ? [selection] : Array.from(selection || []);
    if (!files.length) return;
    if (state.saving || state.toolBusy || document.querySelector("dialog[open]"))
      return actions.notify("Selesaikan dialog atau proses yang sedang berjalan terlebih dahulu.");
    const invalid = files.find(file => !supported.test(file.name) || file.size > 5 * 1024 * 1024);
    if (invalid) return actions.notify(`${invalid.name}: pilih Markdown, PDF, atau gambar PNG/JPEG/GIF/WebP, maksimal 5 MB per file.`);
    const folder = actions.activeFolder();
    state.pendingUpload = {
      files: files.map(file => ({ file, name: file.name.replace(/\.markdown$/i, ".md"), uploadedPath: null })),
      selected: 0,
      previewSequence: 0,
      folderPath: folder.path,
      ready: false,
    };
    actions.$("upload-target").textContent = "docs" + folder.path;
    actions.$("upload-draft").hidden = !actions.isDirty();
    actions.$("confirm-upload").textContent = files.length > 1 ? "Upload semua" : "Upload";
    actions.$("upload-dialog").showModal();
    await selectUploadFile(0);
    if (state.pendingUpload) actions.$("upload-name").focus();
  }
  function closeUploadDialog() {
    if (!state.saving) { clearUploadPreview(); actions.$("upload-dialog").close(); }
  }
  async function removeUploadFile(value) {
    const upload = state.pendingUpload;
    const index = Number(value);
    if (!upload || state.saving || !Number.isInteger(index) || !upload.files[index] || upload.files[index].uploadedPath) return;
    upload.files.splice(index, 1);
    if (!upload.files.length) return closeUploadDialog();
    await selectUploadFile(Math.min(upload.selected, upload.files.length - 1));
  }
  async function confirmUpload(event) {
    event.preventDefault();
    const upload = state.pendingUpload;
    if (!upload?.ready || state.saving) return;
    updateUploadName();
    const names = new Set();
    for (let index = 0; index < upload.files.length; index++) {
      const item = upload.files[index];
      item.name = item.name.trim();
      const duplicate = names.has(item.name.toLowerCase());
      if (!actions.validName(item.name) || extension(item.name) !== extension(item.file.name) || duplicate) {
        await selectUploadFile(index);
        actions.$("upload-name").setCustomValidity(duplicate ? "Nama file dalam pilihan harus berbeda." : "Gunakan nama file yang valid dan pertahankan ekstensi aslinya.");
        actions.$("upload-name").reportValidity();
        return;
      }
      names.add(item.name.toLowerCase());
    }
    const dialog = actions.$("upload-dialog");
    actions.setBusy(true);
    actions.$("upload-error").textContent = "";
    actions.$("upload-form").setAttribute("aria-busy", "true");
    dialog.querySelectorAll("button,input").forEach(control => { control.disabled = true; });
    let failed = null;
    try {
      for (let index = 0; index < upload.files.length; index++) {
        const item = upload.files[index];
        if (item.uploadedPath) continue;
        failed = index;
        actions.$("confirm-upload").textContent = `Mengupload ${index + 1}/${upload.files.length}…`;
        actions.$("upload-status").textContent = item.name;
        const data = new FormData();
        data.append("targetFolder", upload.folderPath);
        data.append("filename", item.name);
        data.append("file", item.file);
        const result = await actions.api("upload", data);
        item.uploadedPath = result.path;
        renderUploadFiles();
      }
      failed = null;
      actions.$("confirm-upload").textContent = "Memuat ulang…";
      await actions.refreshWorkspace();
      const folder = state.pages.find(page => page.type === "folder" && page.path === upload.folderPath);
      await actions.navigate(folder?.id || "home", "push", true);
      dialog.close();
      actions.$("main").focus();
      actions.notify(`${upload.files.length} file diupload sebagai privat.`);
    } catch (error) {
      const completed = upload.files.filter(item => item.uploadedPath).length;
      actions.$("upload-error").textContent = failed === null
        ? "Semua file sudah terupload, tetapi daftar belum berhasil dimuat. Klik Muat ulang daftar."
        : `${completed}/${upload.files.length} file sudah terupload. ${upload.files[failed].name}: ${error.message} File yang berhasil tidak akan dikirim ulang saat retry.`;
      if (completed && actions.$("entries")) {
        try {
          await actions.refreshWorkspace();
          if (actions.$("entries")) actions.renderEntries();
        } catch { /* Keep completed paths for retry when workspace refresh fails. */ }
      }
    } finally {
      actions.setBusy(false);
      actions.$("upload-form").setAttribute("aria-busy", "false");
      dialog.querySelectorAll("button,input").forEach(control => { control.disabled = false; });
      actions.$("upload-name").disabled = Boolean(upload.files[upload.selected]?.uploadedPath);
      actions.$("confirm-upload").textContent = upload.files.every(item => item.uploadedPath) ? "Muat ulang daftar" : "Upload file tersisa";
    }
  }
  function bindUpload() {
    actions.$("upload-dialog").addEventListener("close", clearUploadPreview);
    if (state.boot.mode !== "workspace") return;
    const isFileDrag = event => Array.from(event.dataTransfer?.types || []).includes("Files");
    const canDrop = () => !state.saving && !state.toolBusy && !document.querySelector("dialog[open]");
    document.addEventListener("dragenter", event => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      state.fileDragDepth++;
      if (canDrop()) {
        actions.$("file-drop-target").textContent = "Folder tujuan: docs" + actions.activeFolder().path;
        actions.$("file-drop-zone").hidden = false;
      }
    });
    document.addEventListener("dragover", event => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = canDrop() ? "copy" : "none";
    });
    document.addEventListener("dragleave", () => {
      if (state.fileDragDepth > 0 && --state.fileDragDepth === 0) actions.resetFileDrag();
    });
    document.addEventListener("drop", event => {
      if (!isFileDrag(event) || event.target?.closest?.("#board-attachments")) return;
      event.preventDefault();
      event.stopPropagation();
      actions.resetFileDrag();
      if (!canDrop()) return actions.notify("Selesaikan dialog atau proses yang sedang berjalan terlebih dahulu.");
      if (Array.from(event.dataTransfer.items || []).some(item => item.webkitGetAsEntry?.()?.isDirectory))
        return actions.notify("Pilih file Markdown, PDF, atau gambar, bukan folder.");
      const files = Array.from(event.dataTransfer.files);
      const page = state.pages.find(page => page.id === state.current);
      if (files.length === 1 && imageFile.test(files[0].name) && page?.type === "doc")
        return actions.uploadDocumentImage(files[0], event);
      actions.openUploadPreview(files);
    }, true);
    window.addEventListener("dragend", actions.resetFileDrag);
    window.addEventListener("blur", actions.resetFileDrag);
  }
  return { chooseDocumentUpload, bindUpload, resetFileDrag, openUploadPreview, closeUploadDialog, confirmUpload, selectUploadFile, removeUploadFile, updateUploadName };
}
