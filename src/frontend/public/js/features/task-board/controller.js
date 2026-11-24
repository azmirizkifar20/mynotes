import { createFeature as createView, taskCode } from "./view.js";
import { createFeature as createMentions } from "./mention-editor.js";
import { currentWeek, moveWeek, weekStart } from "./timeline.js";
import { tagChoices, tagRows } from "./tags.js";
import { createFeature as createAttachments } from "./attachments.js";

export function createFeature({ state, actions }) {
  const view = createView({ actions });
  const mentions = createMentions({ state, actions });
  const results = createMentions({ state, actions }, "result");
  const editors = [mentions, results];
  const { $ , escape: esc, icon } = actions;
  const dialogIds = ["board-task-dialog", "board-status-dialog", "board-tag-dialog", "board-confirm-dialog"];
  let tagDraft = [];
  let board = null, editingId = null, draft = null, moves = {}, confirmation = null;
  let loadSequence = 0, draggingId = null, conflicted = false, boardView = "active", timelineWeek = currentWeek();
  const taskBoardDialogOpen = () => dialogIds.some((id) => $(id)?.open);
  const attachments = createAttachments({ state, actions, getBoard: () => board, setBoard: (value) => { board = value; }, getTaskId: () => editingId, invalidate: () => { loadSequence++; }, controls: taskControls, paint, ask });

  function paint() {
    if (state.current !== "tasks" || !$("board-columns") || !board) return;
    const query = $("board-search").value.trim().toLocaleLowerCase();
    const archivedView = boardView === "archive", timelineView = boardView === "timeline";
    const result = timelineView ? view.boardTimeline(board, query, timelineWeek) : view.boardColumns(board, query, archivedView);
    const archivedCount = board.tasks.filter((task) => task.archivedAt).length;
    const total = archivedView ? archivedCount : board.tasks.length - archivedCount;
    $("board-columns").innerHTML = result.html;
    $("board-columns").classList.toggle("tb-archive", archivedView);
    $("board-columns").classList.toggle("tb-timetable", timelineView);
    $("board-columns").setAttribute("aria-label", timelineView ? "Timeline jadwal task" : archivedView ? "Arsip task" : "Papan task menurut status");
    $("board-summary").textContent = `${board.tasks.length - archivedCount} task aktif · ${board.tasks.filter((task) => !task.archivedAt && board.statuses.find((status) => status.id === task.statusId)?.completed).length} selesai · ${archivedCount} diarsipkan`;
    $("board-archive-count").textContent = archivedCount;
    $("board-count").textContent = query ? `${result.count} dari ${total} task` : `${total} task`;
    for (const [id, selected] of [["board-active-tab", boardView === "active"], ["board-timeline-tab", timelineView], ["board-archive-tab", archivedView]]) { $(id).setAttribute("aria-pressed", String(selected)); $(id).setAttribute("aria-selected", String(selected)); $(id).tabIndex = selected ? 0 : -1; if (selected) $("board-columns").setAttribute("aria-labelledby", id); }
    $("board-new-task").hidden = archivedView;
    $("board-view-hint").textContent = archivedView ? "Task arsip tetap menyimpan detail dan mention. Buka task untuk memulihkannya ke papan." : timelineView ? "Klik nama atau bar task untuk mengedit jadwal. Task dengan satu tanggal ditandai sebagai titik." : "Seret kartu untuk mengubah status, atau klik kartu untuk mengedit.";
    $("board-empty-search").hidden = !query || result.count > 0;
    if (query && !result.count) $("board-columns").innerHTML = "";
    $("board-settings").inert = state.toolBusy;
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
    board = null; timelineWeek = currentWeek();
    $("main").innerHTML = view.shell();
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
    boardView = ["archive", "timeline"].includes(value) ? value : "active"; paint();
  }
  function moveBoardWeek(value) {
    if (!board || state.toolBusy || taskBoardDialogOpen() || !["-1", "1", "today"].includes(String(value))) return;
    timelineWeek = value === "today" ? currentWeek() : moveWeek(timelineWeek, Number(value)); paint();
  }
  function taskControls() {
    const task = board?.tasks.find((task) => task.id === editingId), archived = Boolean(task?.archivedAt);
    for (const id of ["board-task-name", "board-task-status", "board-task-priority", "board-task-start", "board-task-due", "board-task-description", "board-task-result", "board-task-save"]) $(id).disabled = state.toolBusy || archived;
    $("board-task-tags").querySelectorAll("input").forEach((input) => { input.disabled = state.toolBusy || archived; });
    editors.forEach((editor) => editor.busy(state.toolBusy, archived));
    $("board-mention-hint").hidden = archived;
    $("board-result-mention-hint").hidden = archived;
    $("board-task-delete").hidden = !task || archived;
    $("board-task-save").hidden = archived;
    $("board-task-archive").hidden = !task || archived || !board.statuses.find((status) => status.id === task.statusId)?.completed;
    $("board-task-restore").hidden = !archived;
    $("board-task-actions").hidden = !task || archived;
    $("board-tag-picker").hidden = archived;
    $("board-task-actions").inert = state.toolBusy; $("board-tag-picker").inert = state.toolBusy;
    $("board-task-hint").hidden = !archived;
    updateTaskFeedback();
    attachments.render();
    $("board-task-hint").textContent = archived ? "Task diarsipkan dan hanya bisa dibaca. Pulihkan untuk mengedit kembali." : "Perubahan task diterapkan saat kamu menekan Simpan.";
  }
  function resetErrors() {
    for (const type of ["task", "status", "tag", "confirm"]) {
      $("board-" + type + "-error").textContent = "";
      $("board-" + type + "-reload").hidden = true;
    }
  }
  function openBoardTask(id = "", statusId = "") {
    if (!board || state.toolBusy || taskBoardDialogOpen()) return;
    const task = id ? board.tasks.find((task) => task.id === id) : null;
    if (id && !task) return actions.notify("Task sudah tidak tersedia. Muat ulang papan.");
    editingId = task?.id || null; state.taskBoardDirty = false; resetErrors();
    $("board-attachment-error").textContent = ""; $("board-attachment-progress").textContent = "";
    $("board-task-form").reset(); $("board-task-name").setCustomValidity("");
    $("board-task-title").textContent = task ? "Detail task" : "Task baru";
    $("board-task-code").textContent = task ? taskCode(task) : "Task baru · Belum disimpan";
    $("board-task-name").value = task?.title || "";
    mentions.load(task?.description || "", board.documents);
    results.load(task?.result || "", board.documents);
    $("board-task-status").innerHTML = view.statusOptions(board.statuses, task?.statusId || statusId || board.statuses[0].id);
    $("board-task-priority").value = task?.priority || "normal"; $("board-task-due").value = task?.due || "";
    $("board-task-start").value = task?.startDate || ""; $("board-task-due").setCustomValidity("");
    $("board-task-tags").innerHTML = tagChoices(board.tags || [], task?.tagIds || [], esc);
    $("board-task-tags-error").textContent = "";
    $("board-task-actions").open = false; $("board-tag-picker").open = false; $("board-tag-search").value = "";
    renderSelectedTags(); filterTaskTags(); setBoardEditor("description"); taskControls();
    $("board-task-dialog").showModal(); (task?.archivedAt ? $("board-task-dialog").querySelector("[data-action=closeTaskBoardDialog]") : $("board-task-name")).focus();
  }
  function closeTaskBoardDialog(id) {
    if (state.toolBusy || !dialogIds.includes(id)) return;
    if (id !== "board-confirm-dialog" && state.taskBoardDirty) {
      ask("Tutup tanpa menyimpan?", "Ada perubahan yang belum disimpan. Tutup dan buang perubahan pada form ini?", "Buang perubahan", () => {
        state.taskBoardDirty = false; $("board-confirm-dialog").close(); $(id).close();
      });
    } else $(id).close();
  }
  function renderStatuses() {
    $("board-status-rows").innerHTML = view.statusRows(draft);
    $("board-status-dialog").querySelector('[data-action="addBoardStatus"]').disabled = draft.length >= 50;
  }
  function openBoardStatuses() {
    if ($("board-settings")) $("board-settings").open = false;
    if (!board || state.toolBusy || taskBoardDialogOpen()) return;
    $("board-settings").querySelector("summary").focus();
    draft = structuredClone(board.statuses); moves = {}; state.taskBoardDirty = false; resetErrors();
    renderStatuses(); $("board-status-dialog").showModal();
  }
  function renderTags() {
    $("board-tag-rows").innerHTML = tagRows(tagDraft, board.tasks, actions);
    $("board-tag-dialog").querySelector('[data-action="addBoardTag"]').disabled = tagDraft.length >= 100;
  }
  function openBoardTags() {
    if ($("board-settings")) $("board-settings").open = false;
    if (!board || state.toolBusy || taskBoardDialogOpen()) return;
    $("board-settings").querySelector("summary").focus();
    tagDraft = structuredClone(board.tags || []); state.taskBoardDirty = false; resetErrors();
    renderTags(); $("board-tag-dialog").showModal();
  }
  function addBoardTag() {
    if (state.toolBusy || !$("board-tag-dialog").open || tagDraft.length >= 100) return;
    tagDraft.push({ id: crypto.randomUUID(), name: "" }); state.taskBoardDirty = true;
    renderTags(); $("board-tag-rows").lastElementChild.querySelector("input").focus();
  }
  function confirmBoardTagDelete(id) {
    if (state.toolBusy || !$("board-tag-dialog").open) return;
    const tag = tagDraft.find((tag) => tag.id === id); if (!tag) return;
    const count = board.tasks.filter((task) => (task.tagIds || []).includes(id)).length;
    ask("Hapus tag?", `Tag “${tag.name || "Tanpa nama"}” akan dilepas dari ${count} task, termasuk arsip. Task tidak dihapus. Perubahan diterapkan setelah Simpan tag.`, "Hapus tag", () => {
      tagDraft = tagDraft.filter((tag) => tag.id !== id); state.taskBoardDirty = true;
      $("board-confirm-dialog").close(); renderTags();
    });
  }
  function saveBoardTags(event) {
    event.preventDefault(); const names = new Set();
    const inputs = $("board-tag-rows").querySelectorAll("input");
    for (const [index, tag] of tagDraft.entries()) {
      const name = tag.name.trim(), key = name.toLowerCase();
      if (!name || names.has(key)) { inputs[index].setCustomValidity(!name ? "Tulis nama tag." : "Nama tag harus berbeda."); inputs[index].reportValidity(); return; }
      names.add(key);
    }
    return write("tags/save", { tags: tagDraft }, "tag", ["board-tag-dialog"], "Pengaturan tag disimpan.");
  }
  function setBoardEditor(field) {
    if (state.toolBusy || !["description", "result"].includes(field)) return;
    editors.forEach((editor) => editor.close());
    for (const name of ["description", "result"]) {
      const selected = name === field;
      $("board-" + name + "-panel").hidden = !selected;
      $("board-" + name + "-label").setAttribute("aria-selected", String(selected));
      $("board-" + name + "-label").tabIndex = selected ? 0 : -1;
    }
    updateTaskFeedback();
  }
  function updateTaskFeedback() {
    const filled = Boolean($("board-task-result").value.trim());
    $("board-result-indicator").hidden = !filled;
    $("board-result-label").setAttribute("aria-label", filled ? "Hasil task, sudah terisi" : "Hasil task, belum terisi");
    const archived = Boolean(board?.tasks.find((task) => task.id === editingId)?.archivedAt);
    $("board-task-save-state").textContent = archived ? "Hanya baca" : state.toolBusy ? "Menyimpan…" : state.taskBoardDirty ? "Perubahan belum disimpan" : "Belum ada perubahan";
  }
  function renderSelectedTags() {
    const selected = selectedTags(), archived = Boolean(board.tasks.find((task) => task.id === editingId)?.archivedAt);
    $("board-selected-tags").innerHTML = (board.tags || []).filter((tag) => selected.includes(tag.id)).map((tag) => `<span class="tb-selected-tag">${esc(tag.name)}${!archived ? `<button type="button" data-action="removeBoardTaskTag" data-arg="${esc(tag.id)}" aria-label="Lepas tag ${esc(tag.name)}">×</button>` : ""}</span>`).join("") || '<span class="tb-hint">Tanpa tag</span>';
    $("board-tag-picker").querySelector("summary").textContent = selected.length ? "+ Tag" : "Pilih tag";
  }
  function filterTaskTags() {
    const query = $("board-tag-search").value.trim().toLocaleLowerCase();
    const choices = [...$("board-task-tags").querySelectorAll("label")];
    choices.forEach((choice) => { choice.hidden = !choice.textContent.toLocaleLowerCase().includes(query); });
    $("board-tag-no-results").hidden = !choices.length || choices.some((choice) => !choice.hidden);
  }
  function removeBoardTaskTag(id) {
    if (state.toolBusy || board?.tasks.find((task) => task.id === editingId)?.archivedAt) return;
    const input = [...$("board-task-tags").querySelectorAll("input")].find((input) => input.value === id);
    if (input) { input.checked = false; state.taskBoardDirty = true; renderSelectedTags(); updateTaskFeedback(); }
  }
  function restoreBoardTask(id) {
    if (state.toolBusy || taskBoardDialogOpen()) return;
    const task = board?.tasks.find((task) => task.id === id && task.archivedAt);
    if (!task) return;
    ask("Pulihkan task?", `“${task.title}” akan dikembalikan ke papan dengan status ${board.statuses.find((status) => status.id === task.statusId).name}.`, "Pulihkan", () => write("tasks/restore", { id: task.id, confirm: true }, "confirm", ["board-confirm-dialog"], "Task dipulihkan ke papan."));
  }
  function selectedTags() { return [...$("board-task-tags").querySelectorAll("input:checked")].map((input) => input.value); }
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
    $("board-confirm-files").hidden = true; $("board-confirm-files").innerHTML = "";
    $("board-confirm-progress").textContent = "";
    const destructive = !["Pulihkan", "Arsipkan", "Upload"].includes(label);
    $("board-confirm-submit").classList.toggle("destructive", destructive);
    $("board-confirm-submit").classList.toggle("primary", !destructive);
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
    $("board-settings").inert = true; $("board-task-actions").open = false; $("board-tag-picker").open = false;
    editors.forEach((editor) => editor.busy(true));
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
      if (closeIds.includes("board-task-dialog")) focusAfter = result.taskId ? `[data-action="openBoardTask"][data-arg="${result.taskId}"]` : '#board-controls [data-action="openBoardTask"]';
      else if (closeIds.includes("board-status-dialog") || closeIds.includes("board-tag-dialog")) focusAfter = "#board-settings > summary";
      else if (closeIds.includes("board-confirm-dialog")) focusAfter = "#board-archive-tab";
    } catch (error) {
      errorElement.textContent = error.message;
      if (error.status === 409) {
        conflicted = true;
        if (type === "status" || type === "tag") errorElement.textContent += " Muat ulang akan membatalkan pengaturan yang belum disimpan.";
        $(type === "board" ? "board-retry" : "board-" + type + "-reload").hidden = false;
      }
    } finally {
      state.toolBusy = false; scope.setAttribute("aria-busy", "false");
      editors.forEach((editor) => editor.busy(false));
      controls.forEach((control, index) => { control.disabled = disabled[index]; });
      if (submit) submit.textContent = submitLabel;
      paint(); taskControls();
      $("board-controls")?.querySelectorAll("button,input").forEach((control) => { control.disabled = !board; });
      if ($("board-settings")) $("board-settings").inert = !board;
      if (focusAfter) (document.querySelector(focusAfter) || $(boardView === "archive" ? "board-archive-tab" : boardView === "timeline" ? "board-timeline-tab" : "board-active-tab"))?.focus({ preventScroll: true });
    }
  }
  function saveBoardTask(event) {
    event.preventDefault(); const title = $("board-task-name").value.trim();
    if (board?.tasks.find((task) => task.id === editingId)?.archivedAt) return;
    if (!mentions.sync()) { setBoardEditor("description"); $("board-task-description-editor").focus(); return; }
    if (!results.sync()) { setBoardEditor("result"); $("board-task-result-editor").focus(); return; }
    if (!title) { $("board-task-name").setCustomValidity("Tulis judul task terlebih dahulu."); $("board-task-name").reportValidity(); return; }
    const startDate = $("board-task-start").value, due = $("board-task-due").value;
    if (startDate && due && startDate > due) { $("board-task-due").setCustomValidity("Tanggal akhir tidak boleh sebelum tanggal mulai."); $("board-task-due").reportValidity(); return; }
    const tagIds = selectedTags();
    if (tagIds.length > 20) { $("board-task-tags-error").textContent = "Pilih maksimal 20 tag per task."; $("board-tag-picker").open = true; $("board-task-tags").querySelector("input")?.focus(); return; }
    return write("tasks/save", { tagIds, ...(editingId ? { id: editingId } : {}), title, description: $("board-task-description").value, result: $("board-task-result").value, startDate, statusId: $("board-task-status").value, priority: $("board-task-priority").value, due }, "task", ["board-task-dialog"], editingId ? "Perubahan task disimpan." : "Task ditambahkan.");
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
    editors.forEach((editor) => editor.busy(true));
    const controls = dialogIds.flatMap((id) => [...$(id).querySelectorAll("button,input,select,textarea")]);
    const disabled = controls.map((control) => control.disabled);
    controls.forEach((control) => { control.disabled = true; });
    try {
      if (!await fetchBoard()) return;
      if ($("board-confirm-dialog").open) $("board-confirm-dialog").close();
      if ($("board-task-dialog").open) {
        $("board-attachment-error").textContent = "";
        mentions.load($("board-task-description").value, board.documents);
        results.load($("board-task-result").value, board.documents);
        const selectedTagIds = selectedTags();
        $("board-task-tags").innerHTML = tagChoices(board.tags || [], selectedTagIds, esc);
        $("board-task-tags-error").textContent = selectedTagIds.some((id) => !(board.tags || []).some((tag) => tag.id === id)) ? "Tag yang sudah dihapus dilepas dari pilihan. Periksa kembali sebelum menyimpan." : "";
        renderSelectedTags(); filterTaskTags(); updateTaskFeedback();
        const selected = $("board-task-status").value;
        $("board-task-status").innerHTML = view.statusOptions(board.statuses, selected);
        if (!board.statuses.some((s) => s.id === selected)) {
          $("board-task-status").insertAdjacentHTML("afterbegin", '<option value="" selected disabled>Pilih status baru</option>');
        }
        $("board-task-status").required = true;
        $("board-task-error").textContent = board.tasks.find((task) => task.id === editingId)?.archivedAt ? "Task sudah diarsipkan. Isi form dipertahankan; salin perubahan yang belum disimpan sebelum menutup atau memulihkan." : "Papan diperbarui. Isi form dipertahankan; periksa kembali sebelum menyimpan.";
      }
      if ($("board-status-dialog").open) { draft = structuredClone(board.statuses); moves = {}; renderStatuses(); state.taskBoardDirty = false; }
      if ($("board-tag-dialog").open) { tagDraft = structuredClone(board.tags || []); renderTags(); state.taskBoardDirty = false; }
      for (const type of ["task", "status", "tag", "confirm"]) $("board-" + type + "-reload").hidden = true;
      $("board-status-error").textContent = ""; $("board-tag-error").textContent = "";
      actions.notify("Papan diperbarui.");
    } catch (error) { actions.notify(error.message); }
    finally {
      state.toolBusy = false;
      editors.forEach((editor) => editor.busy(false));
      controls.forEach((control, index) => { control.disabled = disabled[index]; });
      taskControls();
      $("board-controls")?.querySelectorAll("button,input").forEach((control) => { control.disabled = !board; });
      if ($("board-settings")) $("board-settings").inert = !board;
    }
  }
  function bindTaskBoard() {
    attachments.bind();
    editors.forEach((editor) => editor.bind());
    for (const id of ["board-task-dialog", "board-status-dialog", "board-tag-dialog"]) $(id).addEventListener("cancel", (event) => {
      if (state.toolBusy) return;
      if (state.taskBoardDirty) { event.preventDefault(); closeTaskBoardDialog(id); }
    });
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        const open = ["board-settings", "board-task-actions", "board-tag-picker"].map($).find((node) => node?.open && !node.inert && !$("board-confirm-dialog").open);
        if (open) { event.preventDefault(); open.open = false; open.querySelector("summary").focus(); return; }
      }
      const tab = event.target.closest('.tb-views [role="tab"],.tb-editor-tabs [role="tab"]');
      if (tab && !state.toolBusy && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault(); const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')], index = tabs.indexOf(tab);
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next].click(); tabs[next].focus();
      }
    });
    document.addEventListener("click", (event) => {
      for (const id of ["board-settings", "board-task-actions", "board-tag-picker"]) {
        const detail = $(id); if (detail?.open && !detail.contains(event.target)) detail.open = false;
      }
    });
    document.addEventListener("click", (event) => {
      const card = event.target.closest("[data-board-task]");
      if (card && !event.target.closest("a,button") && !draggingId) openBoardTask(card.dataset.boardTask);
    });
    document.addEventListener("change", (event) => {
      if (event.target.id !== "board-timeline-week" || state.toolBusy || taskBoardDialogOpen()) return;
      const value = event.target.value;
      if (event.target.validity.valid && value) { timelineWeek = weekStart(value); paint(); }
    });
    document.addEventListener("input", (event) => {
      if (event.target.id === "board-attachment-input") return;
      if (event.target.id === "board-search") paint();
      if (event.target.id === "board-tag-search") { filterTaskTags(); return; }
      if (event.target.closest("#board-task-form")) {
        state.taskBoardDirty = true; $("board-task-name").setCustomValidity("");
        $("board-task-due").setCustomValidity(""); updateTaskFeedback();
      }
      if (event.target.closest("#board-task-tags")) { $("board-task-tags-error").textContent = ""; renderSelectedTags(); }
      if (event.target.closest("#board-tag-rows")) {
        const tag = tagDraft.find((tag) => tag.id === event.target.closest("[data-board-tag-id]").dataset.boardTagId);
        if (tag) tag.name = event.target.value;
        state.taskBoardDirty = true;
        $("board-tag-rows").querySelectorAll("input").forEach((input) => input.setCustomValidity(""));
      }
      if (event.target.dataset.boardField && draft) {
        const status = draft.find((s) => s.id === event.target.closest("[data-board-status-id]").dataset.boardStatusId);
        status[event.target.dataset.boardField] = event.target.type === "checkbox" ? event.target.checked : event.target.value; state.taskBoardDirty = true;
        $("board-status-rows").querySelectorAll("input").forEach((input) => input.setCustomValidity(""));
      }
    });
    document.addEventListener("close", (event) => {
      if (["board-task-dialog", "board-status-dialog", "board-tag-dialog"].includes(event.target.id)) state.taskBoardDirty = false;
    }, true);
    document.addEventListener("dragstart", (event) => {
      const card = event.target.closest("[data-board-task]"); if (!card) return;
      if (event.target.closest("a")) { event.preventDefault(); return; }
      if (state.toolBusy || taskBoardDialogOpen() || boardView !== "active" || board?.tasks.find((task) => task.id === card.dataset.boardTask)?.archivedAt) { event.preventDefault(); return; }
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
  return { removeBoardAttachment: attachments.removeBoardAttachment, setBoardEditor, removeBoardTaskTag, restoreBoardTask, openBoardTags, addBoardTag, confirmBoardTagDelete, saveBoardTags, renderTaskBoard, refreshTaskBoard, openBoardTask, closeTaskBoardDialog, openBoardStatuses, addBoardStatus, moveBoardStatus, confirmBoardStatusDelete, saveBoardTask, confirmBoardTaskDelete, confirmBoardTaskArchive, confirmBoardAction, saveBoardStatuses, reloadTaskBoard, clearBoardSearch, setBoardView, moveBoardWeek, bindTaskBoard, taskBoardDialogOpen };
}
