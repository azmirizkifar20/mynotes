const extensions = /\.(pdf|zip|rar|xls|xlsx|csv|ppt|pptx|md|markdown|png|jpe?g|gif|webp|avif|bmp|mp4|m4v|mov|webm|mkv|avi)$/i;
export function createFeature({ state, actions, getBoard, setBoard, getTaskId, invalidate, controls, paint, ask }) {
  const { $, escape: esc } = actions;
  const task = () => getBoard()?.tasks.find((item) => item.id === getTaskId());
  const size = (bytes) => bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  let pending = null, dragDepth = 0;
  const canDrop = () => $("board-task-dialog").open && !$("board-confirm-dialog").open && !state.toolBusy && task() && !task().archivedAt && (task().attachments?.length || 0) < 10;
  function render() {
    const current = task(), items = current?.attachments || [], readonly = !current || Boolean(current.archivedAt);
    $("board-attachment-count").textContent = `${items.length}/10`;
    $("board-attachment-input").disabled = state.toolBusy || readonly || items.length >= 10;
    $("board-attachment-drop").setAttribute("aria-disabled", String(state.toolBusy || readonly || items.length >= 10));
    $("board-confirm-submit").disabled = state.toolBusy;
    $("board-attachment-hint").textContent = !current ? "Simpan task dahulu untuk menambahkan lampiran." : current.archivedAt ? "Lampiran tetap tersimpan. Pulihkan task untuk menambah atau menghapus." : "Maksimal 10 file, 50 MB per file. Penambahan dan penghapusan lampiran langsung disimpan.";
    $("board-attachment-list").innerHTML = items.map((item) => `<li><div class="tb-attachment-info"><a href="${esc(actions.appUrl(`/api/task-board/attachments/${item.id}/view`))}" target="_blank" rel="noopener noreferrer">${esc(item.filename)}</a><small>${size(item.size)}</small></div>${!readonly ? `<button type="button" class="icon-button" data-action="removeBoardAttachment" data-arg="${esc(item.id)}" aria-label="Hapus lampiran ${esc(item.filename)}" ${state.toolBusy ? "disabled" : ""}>${actions.icon("trash")}</button>` : ""}</li>`).join("");
    $("board-attachment-empty").hidden = items.length > 0;
  }
  async function mutate(work, message, confirmation = false) {
    if (state.toolBusy || !task() || task().archivedAt) return;
    state.toolBusy = true; invalidate(); controls(); paint(); render();
    $("board-attachments").setAttribute("aria-busy", "true");
    if (confirmation) $("board-confirm-dialog").setAttribute("aria-busy", "true");
    $("board-attachment-error").textContent = "";
    try {
      await work();
      if (confirmation) $("board-confirm-dialog").close();
      actions.notify(message);
    } catch (error) {
      const scope = confirmation ? "board-confirm-error" : "board-attachment-error";
      $(scope).textContent = error.message;
      if (error.status === 409) $(confirmation ? "board-confirm-reload" : "board-task-reload").hidden = false;
    } finally {
      state.toolBusy = false; controls(); paint(); render();
      $("board-attachments").setAttribute("aria-busy", "false");
      if (confirmation) $("board-confirm-dialog").setAttribute("aria-busy", "false");
      $("board-attachment-progress").textContent = "";
      $("board-confirm-progress").textContent = "";
    }
  }
  function removeBoardAttachment(id) {
    if (state.toolBusy || !task() || task().archivedAt) return;
    const item = task().attachments?.find((item) => item.id === id); if (!item) return;
    ask("Hapus lampiran?", `Lampiran “${item.filename}” akan langsung dihapus. Tindakan ini tidak bisa dibatalkan.`, "Hapus lampiran", () => mutate(async () => {
      const result = await actions.api("task-board/attachments/delete", { id, taskId: getTaskId(), confirm: true, revision: getBoard().revision });
      setBoard(result.board);
    }, "Lampiran dihapus.", true));
  }
  function validation(files) {
    return files.length + (task()?.attachments?.length || 0) > 10 ? "Maksimal 10 lampiran per task." : files.some((file) => !file.size || file.size > 50 * 1024 * 1024) ? "Pilih file berisi data, maksimal 50 MB per file." : files.some((file) => !extensions.test(file.name)) ? "Ada format file yang tidak didukung. Periksa daftar format lampiran." : "";
  }
  function pendingList() {
    $("board-confirm-files").innerHTML = (pending?.files || []).map((file) => `<li><span>${esc(file.name)}</span><small>${size(file.size)}</small></li>`).join("");
    $("board-confirm-files").hidden = !pending?.files.length;
    if (pending?.files.length) $("board-confirm-copy").textContent = `${pending.files.length} file akan ditambahkan ke task ini setelah kamu klik Upload.`;
  }
  function uploadPending() {
    if (!pending || !$("board-confirm-dialog").open || pending.taskId !== getTaskId() || !pending.files.length || state.toolBusy || !task() || task().archivedAt) return;
    const error = validation(pending.files);
    if (error) { $("board-confirm-error").textContent = error; return; }
    const count = pending.files.length;
    return mutate(async () => {
      let uploaded = 0;
      while (pending.files.length) {
        const file = pending.files[0];
        $("board-confirm-progress").textContent = `Mengupload ${uploaded + 1}/${count}: ${file.name}`;
        const form = new FormData();
        form.append("taskId", pending.taskId); form.append("revision", getBoard().revision); form.append("filename", file.name); form.append("file", file);
        try {
          setBoard((await actions.api("task-board/attachments/upload", form)).board);
          pending.files.shift(); uploaded++; pendingList();
        } catch (error) { error.message = `${file.name}: ${error.message} ${uploaded ? `${uploaded} lampiran sebelumnya sudah tersimpan. ` : ""}Daftar hanya memuat file yang belum berhasil diupload.`; throw error; }
      }
    }, `${count} lampiran ditambahkan.`, true);
  }
  function stage(files) {
    if (!files.length || !$("board-task-dialog").open || state.toolBusy || !task() || task().archivedAt || $("board-confirm-dialog").open) return;
    const error = validation(files);
    $("board-attachment-error").textContent = error; if (error) return;
    pending = { taskId: getTaskId(), files };
    ask("Upload lampiran?", `${files.length} file akan ditambahkan ke task ini setelah kamu klik Upload.`, "Upload", uploadPending);
    pendingList();
  }
  function resetDrag() {
    dragDepth = 0; $("board-attachments").classList.remove("is-dragging");
  }
  function bind() {
    $("board-attachment-input").addEventListener("change", (event) => {
      const files = [...event.target.files]; event.target.value = ""; stage(files);
    });
    const isFileDrag = (event) => Array.from(event.dataTransfer?.types || []).includes("Files");
    const region = $("board-attachments");
    region.addEventListener("dragenter", (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault(); event.stopPropagation(); dragDepth++;
      region.classList.toggle("is-dragging", Boolean(canDrop()));
    });
    region.addEventListener("dragover", (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = canDrop() ? "copy" : "none";
    });
    region.addEventListener("dragleave", (event) => {
      if (!isFileDrag(event)) return;
      event.stopPropagation(); if (--dragDepth <= 0) resetDrag();
    });
    region.addEventListener("drop", (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault(); event.stopPropagation(); resetDrag(); actions.resetFileDrag();
      if (Array.from(event.dataTransfer.items || []).some((item) => item.webkitGetAsEntry?.()?.isDirectory)) {
        $("board-attachment-error").textContent = "Pilih file lampiran, bukan folder."; return;
      }
      stage([...event.dataTransfer.files]);
    });
    for (const id of ["board-task-dialog", "board-confirm-dialog"]) $(id).addEventListener("close", () => {
      if ($(id).open) return;
      pending = null; pendingList(); resetDrag();
    });
  }
  return { render, bind, removeBoardAttachment };
}
