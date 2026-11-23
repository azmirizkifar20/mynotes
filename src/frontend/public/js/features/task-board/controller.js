import { createFeature as createView, taskCode } from "./view.js";
import { createFeature as createMentions } from "./mention-editor.js";

export function createFeature({ state, actions }) {
  const view = createView({ actions });
  const mentions = createMentions({ state, actions });
  const { $ , escape: esc, icon } = actions;
  const dialogIds = ["board-task-dialog", "board-status-dialog", "board-confirm-dialog"];
  let board = null, editingId = null, draft = null, moves = {}, confirmation = null;
  let loadSequence = 0, draggingId = null, conflicted = false, archivedView = false;
  const taskBoardDialogOpen = () => dialogIds.some((id) => $(id)?.open);

  function paint() {
    if (state.current !== "tasks" || !$("board-columns") || !board) return;
    const query = $("board-search").value.trim().toLocaleLowerCase();
    const result = view.boardColumns(board, query, archivedView);
    const archivedCount = board.tasks.filter((task) => task.archivedAt).length;
    const total = archivedView ? archivedCount : board.tasks.length - archivedCount;
    $("board-columns").innerHTML = result.html;
    $("board-columns").classList.toggle("tb-archive", archivedView);
    $("board-summary").textContent = `${board.statuses.length} status · ${board.tasks.length - archivedCount} aktif · ${archivedCount} arsip`;
    $("board-count").textContent = query ? `${result.count} dari ${total} task` : `${total} task`;
    for (const [id, selected] of [["board-active-tab", !archivedView], ["board-archive-tab", archivedView]]) $(id).setAttribute("aria-pressed", String(selected));
    $("board-new-task").hidden = archivedView;
    $("board-view-hint").textContent = archivedView ? "Task arsip tetap menyimpan detail dan mention. Buka task untuk memulihkannya ke papan." : "Seret kartu untuk mengubah status, atau klik kartu untuk mengedit.";
    $("board-empty-search").hidden = !query || result.count > 0;
    $("board-controls").querySelectorAll("button,input").forEach((control) => { control.disabled = state.toolBusy; });
  }
  async function fetchBoard() {
    const sequence = ++loadSequence, navigation = state.navigationSequence;
    const result = await actions.api("task-board");
    if (sequence !== loadSequence || state.current !== "tasks" || navigation !== state.navigationSequence) return false;
    board = result.board; conflicted = false; paint();
    $("board-error").textContent = ""; $("board-retry").hidden = true;
    return true;
  }
  async function renderTaskBoard() {
    const navigation = state.navigationSequence;
    actions.trackOutline([]);
    board = null;
    $("main").innerHTML = `<section class="task-board"><div class="page-icon">${icon("board")}</div><p class="page-kicker">Personal workspace</p><h1>Task board</h1><p class="lead">Dari catatan jadi tindakan. Satu papan untuk pekerjaanmu.</p><div class="page-meta"><span>${icon("lock")}Workspace pribadi</span><span id="board-summary" role="status">Memuat papan…</span></div><div class="tb-toolbar" id="board-controls"><div class="tb-views" role="group" aria-label="Tampilan task board"><button class="tb-view" id="board-active-tab" data-action="setBoardView" data-arg="active" aria-pressed="true" disabled>${icon("board")}Papan</button><button class="tb-view" id="board-archive-tab" data-action="setBoardView" data-arg="archive" aria-pressed="false" disabled>Arsip</button></div><span class="tb-count" id="board-count"></span><label class="tb-search">${icon("search")}<input type="search" id="board-search" placeholder="Cari task…" aria-label="Cari judul atau deskripsi task" disabled></label><button class="small-button" data-action="openBoardStatuses" disabled>${icon("settings")}Kelola status</button><button class="small-button primary" id="board-new-task" data-action="openBoardTask" disabled>${icon("plus")}Tambah task</button></div><p class="delete-error" id="board-error" role="alert"></p><button class="small-button" id="board-retry" data-action="reloadTaskBoard" hidden>Muat ulang papan</button><div class="tb-columns" id="board-columns" aria-label="Papan task menurut status"><p class="tb-loading" role="status">Memuat task…</p></div><div class="tb-no-results" id="board-empty-search" hidden>Tidak ada task yang cocok.<button class="small-button" data-action="clearBoardSearch">Hapus pencarian</button></div><p class="tb-hint tb-board-hint" id="board-view-hint">Seret kartu untuk mengubah status, atau klik kartu untuk mengedit.</p></section>`;
    try { await fetchBoard(); }
    catch (error) {
      if (state.current !== "tasks" || navigation !== state.navigationSequence || !$("board-error")) return;
      $("board-summary").textContent = "Papan belum dapat dimuat";
      $("board-columns").innerHTML = ""; $("board-error").textContent = error.message; $("board-retry").hidden = false;
    }
  }
  async function refreshTaskBoard() {
    if (state.current !== "tasks" || state.toolBusy || taskBoardDialogOpen() || draggingId || document.activeElement?.closest(".task-board") || conflicted) return;
    await fetchBoard();
  }
  function clearBoardSearch() { $("board-search").value = ""; paint(); $("board-search").focus(); }
  function setBoardView(value) {
    if (!board || state.toolBusy || taskBoardDialogOpen()) return;
    archivedView = value === "archive"; paint();
  }
  function taskControls() {
    const task = board?.tasks.find((task) => task.id === editingId), archived = Boolean(task?.archivedAt);
    for (const id of ["board-task-name", "board-task-status", "board-task-priority", "board-task-due", "board-task-description", "board-task-save"]) $(id).disabled = state.toolBusy || archived;
    mentions.busy(state.toolBusy);
    $("board-task-description-editor").setAttribute("contenteditable", String(!state.toolBusy && !archived));
    $("board-task-description-editor").setAttribute("aria-readonly", String(archived));
    $("board-mention-hint").hidden = archived;
    $("board-task-delete").hidden = !task || archived;
    $("board-task-save").hidden = archived;
    $("board-task-archive").hidden = !task || archived || !board.statuses.find((status) => status.id === task.statusId)?.completed;
    $("board-task-restore").hidden = !archived;
    $("board-task-hint").textContent = archived ? "Task diarsipkan dan hanya bisa dibaca. Pulihkan untuk mengedit kembali." : "Perubahan task diterapkan saat kamu menekan Simpan.";
  }
  function resetErrors() {
    for (const type of ["task", "status", "confirm"]) {
      $("board-" + type + "-error").textContent = "";
      $("board-" + type + "-reload").hidden = true;
    }
  }
  function openBoardTask(id = "", statusId = "") {
    if (!board || state.toolBusy || taskBoardDialogOpen()) return;
    const task = id ? board.tasks.find((task) => task.id === id) : null;
    if (id && !task) return actions.notify("Task sudah tidak tersedia. Muat ulang papan.");
    editingId = task?.id || null; state.taskBoardDirty = false; resetErrors();
    $("board-task-form").reset(); $("board-task-name").setCustomValidity("");
    $("board-task-title").textContent = task ? "Detail task" : "Task baru";
    $("board-task-code").textContent = task ? taskCode(task) : "Task baru · Belum disimpan";
    $("board-task-name").value = task?.title || "";
    mentions.load(task?.description || "", board.documents);
    $("board-task-status").innerHTML = view.statusOptions(board.statuses, task?.statusId || statusId || board.statuses[0].id);
    $("board-task-priority").value = task?.priority || "normal"; $("board-task-due").value = task?.due || "";
    taskControls();
    $("board-task-dialog").showModal(); $("board-task-name").focus();
  }
  function closeTaskBoardDialog(id) {
    if (!state.toolBusy && dialogIds.includes(id)) $(id).close();
  }
  function renderStatuses() {
    $("board-status-rows").innerHTML = view.statusRows(draft);
    $("board-status-dialog").querySelector('[data-action="addBoardStatus"]').disabled = draft.length >= 50;
  }
  function openBoardStatuses() {
    if (!board || state.toolBusy || taskBoardDialogOpen()) return;
    draft = structuredClone(board.statuses); moves = {}; state.taskBoardDirty = false; resetErrors();
    renderStatuses(); $("board-status-dialog").showModal();
  }
  function addBoardStatus() {
    if (state.toolBusy || !draft || draft.length >= 50) return;
    draft.push({ id: crypto.randomUUID(), name: "", tone: "neutral", completed: false }); state.taskBoardDirty = true;
    renderStatuses(); $("board-status-rows").lastElementChild.querySelector("input").focus();
  }
  function moveBoardStatus(id, offset) {
    if (state.toolBusy || !draft) return;
    const index = draft.findIndex((s) => s.id === id), target = index + Number(offset);
    if (index < 0 || target < 0 || target >= draft.length) return;
    [draft[index], draft[target]] = [draft[target], draft[index]]; state.taskBoardDirty = true;
    renderStatuses(); $("board-status-rows").children[target].querySelector("input").focus();
  }
  function ask(title, message, label, work, destinations = []) {
    $("board-confirm-title").textContent = title; $("board-confirm-copy").textContent = message;
    $("board-confirm-submit").textContent = label; $("board-confirm-error").textContent = "";
    $("board-confirm-reload").hidden = true; $("board-move-field").hidden = !destinations.length;
    $("board-move-target").innerHTML = view.statusOptions(destinations);
    confirmation = work; $("board-confirm-dialog").showModal();
  }
  function confirmBoardStatusDelete(id) {
    if (state.toolBusy || !draft || draft.length <= 1) return;
    const status = draft.find((s) => s.id === id);
    if (!status) return;
    const count = board.tasks.filter((task) => (moves[task.statusId] || task.statusId) === id).length;
    ask("Hapus status?", count ? `${count} task di “${status.name || "Tanpa nama"}” akan dipindahkan ke status yang kamu pilih.` : `Status “${status.name || "Tanpa nama"}” tidak berisi task. Hapus dari papan?`, count ? "Pindahkan & hapus" : "Hapus status", () => {
      const target = $("board-move-target").value;
      for (const from of Object.keys(moves)) {
        if (moves[from] === id) {
          if (count) moves[from] = target;
          else delete moves[from];
        }
      }
      if (count) moves[id] = target;
      else delete moves[id];
      draft = draft.filter((s) => s.id !== id); state.taskBoardDirty = true;
      $("board-confirm-dialog").close(); renderStatuses();
    }, count ? draft.filter((s) => s.id !== id) : []);
  }
  async function write(endpoint, body, type, closeIds, message) {
    if (state.toolBusy || !board) return;
    const errorElement = type === "board" ? $("board-error") : $("board-" + type + "-error");
    if (conflicted) {
      errorElement.textContent = "Muat ulang papan sebelum menyimpan lagi. Isi form task tetap dipertahankan.";
      $(type === "board" ? "board-retry" : "board-" + type + "-reload").hidden = false; return;
    }
    state.toolBusy = true; loadSequence++;
    mentions.busy(true);
    const scopes = [$("board-controls"), $("board-columns"), ...dialogIds.map($)].filter(Boolean);
    const controls = scopes.flatMap((scope) => [...scope.querySelectorAll("button,input,select,textarea")]);
    const disabled = controls.map((control) => control.disabled);
    controls.forEach((control) => { control.disabled = true; });
    errorElement.textContent = "";
    const scope = type === "board" ? $("board-columns") : $("board-" + type + "-dialog");
    const submit = scope.querySelector('button[type="submit"]');
    const submitLabel = submit?.textContent;
    if (submit) submit.textContent = "Menyimpan…";
    $("board-summary").textContent = "Menyimpan perubahan…";
    scope.setAttribute("aria-busy", "true");
    let focusAfter = null;
    try {
      const result = await actions.api("task-board/" + endpoint, { ...body, revision: board.revision });
      board = result.board; conflicted = false;
      closeIds.forEach((id) => $(id).close()); state.taskBoardDirty = false;
      paint(); actions.notify(message);
      if (closeIds.includes("board-task-dialog")) focusAfter = result.taskId || "new";
    } catch (error) {
      errorElement.textContent = error.message;
      if (error.status === 409) {
        conflicted = true;
        if (type === "status") errorElement.textContent += " Muat ulang akan membatalkan pengaturan status yang belum disimpan.";
        $(type === "board" ? "board-retry" : "board-" + type + "-reload").hidden = false;
      }
    } finally {
      state.toolBusy = false; scope.setAttribute("aria-busy", "false");
      mentions.busy(false);
      controls.forEach((control, index) => { control.disabled = disabled[index]; });
      if (submit) submit.textContent = submitLabel;
      paint(); taskControls();
      $("board-controls")?.querySelectorAll("button,input").forEach((control) => { control.disabled = !board; });
      $("board-columns")?.querySelectorAll("button").forEach((control) => { control.disabled = false; });
      if (focusAfter) (document.querySelector(focusAfter === "new" ? '#board-controls [data-action="openBoardTask"]' : `[data-action="openBoardTask"][data-arg="${focusAfter}"]`) || $(archivedView ? "board-archive-tab" : "board-active-tab"))?.focus({ preventScroll: true });
    }
  }
  function saveBoardTask(event) {
    event.preventDefault(); const title = $("board-task-name").value.trim();
    if (board?.tasks.find((task) => task.id === editingId)?.archivedAt) return;
    if (!mentions.sync()) { $("board-task-description-editor").focus(); return; }
    if (!title) { $("board-task-name").setCustomValidity("Tulis judul task terlebih dahulu."); $("board-task-name").reportValidity(); return; }
    return write("tasks/save", { ...(editingId ? { id: editingId } : {}), title, description: $("board-task-description").value, statusId: $("board-task-status").value, priority: $("board-task-priority").value, due: $("board-task-due").value }, "task", ["board-task-dialog"], editingId ? "Perubahan task disimpan." : "Task ditambahkan.");
  }
  function confirmBoardTaskDelete() {
    if (state.toolBusy) return;
    const task = board?.tasks.find((t) => t.id === editingId); if (!task) return;
    ask("Hapus task?", `“${task.title}” akan dihapus dari papan. Tindakan ini tidak bisa dibatalkan.`, "Hapus task", () => write("tasks/delete", { id: editingId, confirm: true }, "confirm", ["board-confirm-dialog", "board-task-dialog"], "Task dihapus."));
  }
  function confirmBoardTaskArchive() {
    if (state.toolBusy) return;
    const task = board?.tasks.find((task) => task.id === editingId);
    if (!task) return;
    if (state.taskBoardDirty) {
      $("board-task-error").textContent = "Ada perubahan form yang belum disimpan. Simpan terlebih dahulu, atau tutup dan buka ulang detail sebelum mengarsipkan atau memulihkan.";
      return;
    }
    const archived = Boolean(task.archivedAt);
    if (!archived && !board.statuses.find((status) => status.id === task.statusId)?.completed) return;
    ask(archived ? "Pulihkan task?" : "Arsipkan task?", archived ? `“${task.title}” akan dikembalikan ke papan pada status ${board.statuses.find((status) => status.id === task.statusId).name}.` : `“${task.title}” akan dipindahkan ke Arsip. Detail dan mention tetap tersimpan, dan task bisa dipulihkan kapan saja.`, archived ? "Pulihkan" : "Arsipkan", () => write(archived ? "tasks/restore" : "tasks/archive", { id: task.id, confirm: true }, "confirm", ["board-confirm-dialog", "board-task-dialog"], archived ? "Task dipulihkan ke papan." : "Task diarsipkan."));
  }
  function confirmBoardAction(event) { event.preventDefault(); if (!state.toolBusy) return confirmation?.(); }
  function saveBoardStatuses(event) {
    event.preventDefault(); const names = new Set(), inputs = $("board-status-rows").querySelectorAll('input[data-board-field="name"]');
    for (const [index, status] of draft.entries()) {
      const name = status.name.trim(), key = name.toLowerCase();
      if (!name || names.has(key)) { inputs[index].setCustomValidity(!name ? "Tulis nama status." : "Nama status harus berbeda."); inputs[index].reportValidity(); return; }
      names.add(key);
    }
    return write("statuses/save", { statuses: draft, moves: Object.fromEntries(Object.entries(moves).filter(([from]) => board.statuses.some((s) => s.id === from))) }, "status", ["board-status-dialog"], "Pengaturan status disimpan.");
  }
  async function reloadTaskBoard() {
    if (state.toolBusy) return;
    state.toolBusy = true;
    mentions.busy(true);
    const controls = dialogIds.flatMap((id) => [...$(id).querySelectorAll("button,input,select,textarea")]);
    const disabled = controls.map((control) => control.disabled);
    controls.forEach((control) => { control.disabled = true; });
    try {
      if (!await fetchBoard()) return;
      if ($("board-confirm-dialog").open) $("board-confirm-dialog").close();
      if ($("board-task-dialog").open) {
        mentions.load($("board-task-description").value, board.documents);
        const selected = $("board-task-status").value;
        $("board-task-status").innerHTML = view.statusOptions(board.statuses, selected);
        if (!board.statuses.some((s) => s.id === selected)) {
          $("board-task-status").insertAdjacentHTML("afterbegin", '<option value="" selected disabled>Pilih status baru</option>');
        }
        $("board-task-status").required = true;
        $("board-task-error").textContent = board.tasks.find((task) => task.id === editingId)?.archivedAt ? "Task sudah diarsipkan. Isi form dipertahankan; salin perubahan yang belum disimpan sebelum menutup atau memulihkan." : "Papan diperbarui. Isi form dipertahankan; periksa kembali sebelum menyimpan.";
      }
      if ($("board-status-dialog").open) { draft = structuredClone(board.statuses); moves = {}; renderStatuses(); state.taskBoardDirty = false; }
      for (const type of ["task", "status", "confirm"]) $("board-" + type + "-reload").hidden = true;
      $("board-status-error").textContent = "";
      actions.notify("Papan diperbarui.");
    } catch (error) { actions.notify(error.message); }
    finally {
      state.toolBusy = false;
      mentions.busy(false);
      controls.forEach((control, index) => { control.disabled = disabled[index]; });
      taskControls();
      $("board-controls")?.querySelectorAll("button,input").forEach((control) => { control.disabled = !board; });
    }
  }
  function bindTaskBoard() {
    mentions.bind();
    document.addEventListener("click", (event) => {
      const card = event.target.closest("[data-board-task]");
      if (card && !event.target.closest("a,button") && !draggingId) openBoardTask(card.dataset.boardTask);
    });
    document.addEventListener("input", (event) => {
      if (event.target.id === "board-search") paint();
      if (event.target.closest("#board-task-form")) {
        state.taskBoardDirty = true; $("board-task-name").setCustomValidity("");
      }
      if (event.target.dataset.boardField && draft) {
        const status = draft.find((s) => s.id === event.target.closest("[data-board-status-id]").dataset.boardStatusId);
        status[event.target.dataset.boardField] = event.target.type === "checkbox" ? event.target.checked : event.target.value; state.taskBoardDirty = true;
        $("board-status-rows").querySelectorAll("input").forEach((input) => input.setCustomValidity(""));
      }
    });
    document.addEventListener("close", (event) => {
      if (event.target.id === "board-task-dialog" || event.target.id === "board-status-dialog") state.taskBoardDirty = false;
    }, true);
    document.addEventListener("dragstart", (event) => {
      const card = event.target.closest("[data-board-task]"); if (!card) return;
      if (event.target.closest("a")) { event.preventDefault(); return; }
      if (state.toolBusy || taskBoardDialogOpen() || archivedView || board?.tasks.find((task) => task.id === card.dataset.boardTask)?.archivedAt) { event.preventDefault(); return; }
      draggingId = card.dataset.boardTask; event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggingId); card.classList.add("tb-dragging");
    });
    document.addEventListener("dragover", (event) => {
      const column = event.target.closest("[data-board-status]"); if (!column || !draggingId) return;
      event.preventDefault(); event.dataTransfer.dropEffect = "move";
      document.querySelectorAll(".tb-drag-over").forEach((node) => node.classList.remove("tb-drag-over")); column.classList.add("tb-drag-over");
    });
    const endDrag = () => { draggingId = null; document.querySelectorAll(".tb-drag-over,.tb-dragging").forEach((node) => node.classList.remove("tb-drag-over", "tb-dragging")); };
    document.addEventListener("dragend", endDrag);
    document.addEventListener("drop", (event) => {
      const column = event.target.closest("[data-board-status]"); if (!column || !draggingId) return;
      event.preventDefault(); const task = board?.tasks.find((t) => t.id === draggingId); endDrag();
      if (task && !task.archivedAt && task.statusId !== column.dataset.boardStatus)
        write("tasks/save", { ...task, statusId: column.dataset.boardStatus }, "board", [], "Status task diperbarui.");
    });
  }
  return { renderTaskBoard, refreshTaskBoard, openBoardTask, closeTaskBoardDialog, openBoardStatuses, addBoardStatus, moveBoardStatus, confirmBoardStatusDelete, saveBoardTask, confirmBoardTaskDelete, confirmBoardTaskArchive, confirmBoardAction, saveBoardStatuses, reloadTaskBoard, clearBoardSearch, setBoardView, bindTaskBoard, taskBoardDialogOpen };
}
