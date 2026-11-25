import { createFeature as createView, taskCode } from "./view.js";
import { createFeature as createMentions } from "./mention-editor.js";
import { currentWeek, moveWeek, weekStart } from "./timeline.js";
import { tagChoices, tagRows } from "./tags.js";
import { createFeature as createAttachments } from "./attachments.js";
import { emptyFilters, filterBoard } from "./filters.js";
import { createFeature as createDrafts } from "./drafts.js";
import { createFeature as createSelects } from "../../components/select.js";

export function createFeature({ state, actions }) {
  const view = createView({ actions });
  const mentions = createMentions({ state, actions });
  const results = createMentions({ state, actions }, "result");
  const editors = [mentions, results];
  const { $ , escape: esc, icon } = actions;
  const dialogIds = ["board-task-dialog", "board-status-dialog", "board-tag-dialog", "board-confirm-dialog", "board-save-view", "board-views-dialog"];
  const selects = createSelects({ actions, selector: '.task-board select,dialog[id^="board-"] select' });
  let viewDraft = [];
  let tagDraft = [];
  let board = null, editingId = null, draft = null, moves = {}, confirmation = null;
  let loadSequence = 0, draggingId = null, conflicted = false, boardView = "active", timelineWeek = currentWeek();
  let filters = emptyFilters(), savedViews = [], viewsToken = null, selectedView = "", checklist = [], formRevision = null;
  const taskDrafts = createDrafts({ state, actions, getBody: taskBody, applyBody: applyTaskBody, getKey: () => editingId || "new", getRevision: () => formRevision, onChanged: () => { state.taskBoardDirty = true; updateTaskFeedback(); } });
  const taskBoardDialogOpen = () => dialogIds.some((id) => $(id)?.open);
  const attachments = createAttachments({ state, actions, getBoard: () => board, setBoard: (value) => { board = value; }, getTaskId: () => editingId, invalidate: () => { loadSequence++; }, controls: taskControls, paint, ask });

  function paint() {
    if (state.current !== "tasks" || !$("board-columns") || !board) return;
    filters.query = $("board-search").value;
    const filtered = filterBoard(board, filters);
    const archivedView = boardView === "archive", timelineView = boardView === "timeline";
    const result = { count: filtered.tasks.filter((task) => Boolean(task.archivedAt) === archivedView).length };
    const archivedCount = board.tasks.filter((task) => task.archivedAt).length;
    const total = archivedView ? archivedCount : board.tasks.length - archivedCount;
    const filtering = Object.values(filters).some(Boolean);
    actions.renderBoardContent($("board-columns"), { board: filtered, view: boardView, week: timelineWeek, filtering });
    $("board-columns").classList.toggle("tb-archive", archivedView);
    $("board-columns").classList.toggle("tb-timetable", timelineView);
    $("board-columns").classList.toggle("tb-list-view", boardView === "list");
    $("board-columns").setAttribute("aria-label", timelineView ? "Timeline jadwal task" : archivedView ? "Arsip task" : "Papan task menurut status");
    $("board-summary").textContent = `${board.tasks.length - archivedCount} task aktif · ${board.tasks.filter((task) => !task.archivedAt && board.statuses.find((status) => status.id === task.statusId)?.completed).length} selesai · ${archivedCount} diarsipkan`;
    $("board-archive-count").textContent = archivedCount;
    $("board-count").textContent = `${result.count} dari ${total} task`;
    $("board-filter-count").textContent = Object.entries(filters).filter(([key, value]) => key !== "query" && value).length || "";
    renderFilterSummary();
    for (const [id, selected] of [["board-active-tab", boardView === "active"], ["board-timeline-tab", timelineView], ["board-list-tab", boardView === "list"], ["board-archive-tab", archivedView]]) { $(id).setAttribute("aria-pressed", String(selected)); $(id).setAttribute("aria-selected", String(selected)); $(id).tabIndex = selected ? 0 : -1; if (selected) $("board-columns").setAttribute("aria-labelledby", id); }
    $("board-new-task").hidden = archivedView;
    $("board-view-hint").textContent = archivedView ? "Task arsip tetap menyimpan detail dan mention. Buka task untuk memulihkannya ke papan." : timelineView ? "Klik nama atau bar task untuk mengedit jadwal. Task dengan satu tanggal ditandai sebagai titik." : boardView === "list" ? "Ubah status atau tanggal langsung di tabel; setiap perubahan langsung disimpan. Klik judul untuk detail." : "Seret kartu untuk mengubah status, atau klik kartu untuk mengedit.";
    $("board-empty-search").hidden = !filtering || result.count > 0;
    $("board-view-hint").hidden = !result.count;
    $("board-settings").inert = state.toolBusy;
    $("board-controls").querySelectorAll("button,input,select").forEach((control) => { control.disabled = state.toolBusy; });
    selects.refresh();
    actions.updateTabIndicator(document.querySelector(".tb-views"));
  }
  async function fetchBoard() {
    const sequence = ++loadSequence, navigation = state.navigationSequence;
    const result = await actions.api("task-board");
    if (sequence !== loadSequence || state.current !== "tasks" || navigation !== state.navigationSequence) return false;
    board = result.board; conflicted = false; renderFilters(); paint();
    $("board-error").textContent = ""; $("board-retry").hidden = true;
    return true;
  }
  async function renderTaskBoard() {
    const navigation = state.navigationSequence;
    actions.trackOutline([]);
    board = null; timelineWeek = currentWeek();
    actions.destroyTaskBoardView();
    $("main").innerHTML = view.shell();
    try { await fetchBoard(); const preferences = await taskDrafts.loadPreferences(); if (state.current === "tasks" && navigation === state.navigationSequence) { savedViews = preferences.views || []; viewsToken = preferences.viewsToken || null; renderFilters(); } }
    catch (error) {
      if (state.current !== "tasks" || navigation !== state.navigationSequence || !$("board-error")) return;
      $("board-summary").textContent = "Papan belum dapat dimuat";
      actions.destroyTaskBoardView();
      $("board-columns").innerHTML = ""; $("board-error").textContent = error.message; $("board-retry").hidden = false;
    }
  }
  async function refreshTaskBoard() {
    if (state.current !== "tasks" || state.toolBusy || taskBoardDialogOpen() || draggingId || document.activeElement?.closest(".task-board") || conflicted) return;
    await fetchBoard();
  }
  function clearBoardSearch() { filters = emptyFilters(); selectedView = ""; renderFilters(); paint(); $("board-search").focus(); }
  function setBoardView(value) {
    if (!board || state.toolBusy || taskBoardDialogOpen()) return;
    const next = ["archive", "timeline", "list"].includes(value) ? value : "active";
    if (next === boardView) return;
    boardView = next; paint(); actions.animateContent($("board-columns"));
  }
  function moveBoardWeek(value) {
    if (!board || state.toolBusy || taskBoardDialogOpen() || !["-1", "1", "today"].includes(String(value))) return;
    timelineWeek = value === "today" ? currentWeek() : moveWeek(timelineWeek, Number(value)); paint();
  }
  function renderFilters() {
    if (!board || !$("board-saved-view")) return;
    $("board-search").value = filters.query;
    $("board-filter-statusId").innerHTML = '<option value="">Semua status</option>' + view.statusOptions(board.statuses, filters.statusId);
    $("board-filter-tagId").innerHTML = '<option value="">Semua tag</option>' + (board.tags || []).map((tag) => `<option value="${esc(tag.id)}" ${tag.id === filters.tagId ? "selected" : ""}>${esc(tag.name)}</option>`).join("");
    for (const key of ["priority", "dateFrom", "dateTo", "dateMode"]) $("board-filter-" + key).value = filters[key];
    $("board-saved-view").innerHTML = '<option value="">Semua task</option>' + savedViews.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("");
    $("board-saved-view").value = selectedView;
    renderFilterSummary(); selects.refresh();
  }
  function renderFilterSummary() {
    const current = savedViews.find((item) => item.id === selectedView), changed = current && Object.keys(filters).some((key) => filters[key] !== (current.filters[key] || ""));
    $("board-view-dirty").hidden = !changed;
    $("board-save-view-button").hidden = !changed && !(!selectedView && Object.values(filters).some(Boolean));
    const labels = { query: `Cari: ${filters.query}`, statusId: board.statuses.find((item) => item.id === filters.statusId)?.name, tagId: board.tags?.find((item) => item.id === filters.tagId)?.name, priority: { high: "Tinggi", normal: "Normal", low: "Rendah" }[filters.priority], dateFrom: `Deadline dari ${filters.dateFrom}`, dateTo: `Deadline sampai ${filters.dateTo}`, dateMode: filters.dateMode === "today" ? "Hari ini" : "Lewat deadline" };
    $("board-filter-chips").innerHTML = Object.entries(filters).filter(([, value]) => value).map(([key]) => `<button type="button" class="tb-filter-chip" data-action="removeBoardFilter" data-arg="${key}" aria-label="Hapus filter ${esc(labels[key] || key)}">${esc(labels[key] || key)}${icon("close")}</button>`).join("");
    $("board-filter-error").textContent = filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo ? "Deadline sampai tidak boleh sebelum tanggal dari." : "";
    $("board-filters").querySelectorAll("[data-action=setBoardDateFilter]").forEach((button) => button.setAttribute("aria-pressed", String(filters.dateMode === button.dataset.arg)));
  }
  function toggleBoardFilters() {
    const panel = $("board-filters");
    const returnFocus = panel.contains(document.activeElement);
    panel.hidden = !panel.hidden;
    panel.inert = panel.hidden;
    $("board-filter-toggle").setAttribute("aria-expanded", String(!panel.hidden));
    if (panel.hidden && returnFocus) $("board-filter-toggle").focus();
  }
  function removeBoardFilter(key) { if (!(key in filters) || state.toolBusy) return; filters[key] = ""; renderFilters(); paint(); }
  function setBoardDateFilter(value) { filters.dateMode = filters.dateMode === value ? "" : value; renderFilters(); paint(); }
  function openBoardSaveView() {
    if (state.toolBusy || taskBoardDialogOpen()) return;
    $("board-view-name").value = savedViews.find((item) => item.id === selectedView)?.name || "";
    $("board-view-save-mode-field").hidden = !selectedView; $("board-view-save-mode").value = "update";
    $("board-save-view-error").textContent = ""; $("board-save-view").showModal(); $("board-view-name").focus();
  }
  function cancelBoardSaveView() { if (!state.toolBusy) $("board-save-view").close(); }
  async function saveBoardView(event) {
    event.preventDefault(); if (state.toolBusy) return;
    const updating = selectedView && $("board-view-save-mode").value === "update";
    const name = $("board-view-name").value.trim();
    if (!name) { $("board-view-name").setCustomValidity("Tulis nama view."); $("board-view-name").reportValidity(); return; }
    if (savedViews.some((item) => (!updating || item.id !== selectedView) && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { $("board-save-view-error").textContent = "Nama view sudah digunakan."; return; }
    const id = updating ? selectedView : crypto.randomUUID(), item = { id, name, filters: { ...filters } };
    const views = updating ? savedViews.map((view) => view.id === selectedView ? item : view) : [...savedViews, item];
    if (views.length > 20) return actions.notify("Maksimal 20 view tersimpan.");
    await persistViews(views, "board-save-view", "board-save-view-error", id);
  }
  async function persistViews(views, dialogId, errorId, selected = selectedView) {
    state.toolBusy = true; const dialog = $(dialogId), controls = [...dialog.querySelectorAll("button,input,select")];
    controls.forEach((control) => { control.disabled = true; }); dialog.setAttribute("aria-busy", "true");
    try {
      const data = await actions.api("task-board/views/save", { views, token: viewsToken });
      savedViews = data.views; viewsToken = data.viewsToken; selectedView = savedViews.some((item) => item.id === selected) ? selected : "";
      state.taskBoardDirty = false; dialog.close(); renderFilters(); paint(); actions.notify("View disimpan.");
    } catch (error) { $(errorId).textContent = error.message; if (error.status === 409) { $("board-error").textContent = "View berubah di perangkat lain. Tutup pengaturan lalu muat ulang papan sebelum menyimpan lagi."; $("board-retry").hidden = false; } }
    finally { state.toolBusy = false; controls.forEach((control) => { control.disabled = false; }); dialog.setAttribute("aria-busy", "false"); paint(); }
  }
  function renderViews() {
    $("board-view-rows").innerHTML = viewDraft.map((item) => `<div class="tb-tag-row" data-board-view-id="${esc(item.id)}"><input class="text-input" value="${esc(item.name)}" maxlength="40" required aria-label="Nama view ${esc(item.name)}"><span class="tb-hint">${Object.values(item.filters).filter(Boolean).length} filter</span><button type="button" class="icon-button" data-action="deleteBoardSavedView" data-arg="${esc(item.id)}" aria-label="Hapus view ${esc(item.name)}">${icon("trash")}</button></div>`).join("") || '<p class="tb-hint">Belum ada view tersimpan. Atur filter lalu pilih Simpan view.</p>';
  }
  function openBoardViews() {
    $("board-settings").open = false;
    if (state.toolBusy || taskBoardDialogOpen()) return;
    viewDraft = structuredClone(savedViews); state.taskBoardDirty = false; $("board-views-error").textContent = ""; renderViews(); $("board-views-dialog").showModal();
  }
  function deleteBoardSavedView(id) {
    if (state.toolBusy) return;
    const item = viewDraft.find((view) => view.id === id); if (!item) return;
    ask("Hapus view?", `View “${item.name}” akan dihapus setelah Simpan pengaturan. Task tetap tersimpan.`, "Hapus view", () => {
      viewDraft = viewDraft.filter((view) => view.id !== id); state.taskBoardDirty = true; $("board-confirm-dialog").close(); renderViews();
    });
  }
  function saveBoardViews(event) {
    event.preventDefault(); if (state.toolBusy) return;
    const names = viewDraft.map((item) => item.name.trim().toLocaleLowerCase());
    if (names.some((name) => !name) || new Set(names).size !== names.length) { $("board-views-error").textContent = "Tulis nama view yang berbeda dan tidak kosong."; return; }
    return persistViews(viewDraft.map((item) => ({ ...item, name: item.name.trim() })), "board-views-dialog", "board-views-error");
  }
  function renderChecklist() {
    const archived = Boolean(board?.tasks.find((task) => task.id === editingId)?.archivedAt);
    $("board-checklist-progress").textContent = checklist.length ? `${checklist.filter((item) => item.done).length}/${checklist.length}` : "";
    $("board-checklist-items").innerHTML = checklist.map((item) => `<div class="tb-checklist-item" data-checklist-id="${esc(item.id)}"><input type="checkbox" data-checklist-field="done" ${item.done ? "checked" : ""} ${archived ? "disabled" : ""} aria-label="Selesai: ${esc(item.text || "Item checklist")}"><input class="text-input" data-checklist-field="text" value="${esc(item.text)}" maxlength="200" ${archived ? "disabled" : ""} aria-label="Isi item checklist"><button type="button" class="icon-button" data-action="removeBoardChecklist" data-arg="${esc(item.id)}" ${archived ? "disabled" : ""} aria-label="Hapus item checklist">${icon("close")}</button></div>`).join("");
    $("board-checklist-add").disabled = archived || state.toolBusy || checklist.length >= 100;
  }
  function addBoardChecklist() {
    if (state.toolBusy || checklist.length >= 100 || board?.tasks.find((task) => task.id === editingId)?.archivedAt) return;
    checklist.push({ id: crypto.randomUUID(), text: "", done: false }); renderChecklist(); state.taskBoardDirty = true; taskDrafts.changed(); updateTaskFeedback();
    $("board-checklist-items").lastElementChild.querySelector('[data-checklist-field="text"]').focus();
  }
  function removeBoardChecklist(id) {
    if (state.toolBusy || board?.tasks.find((task) => task.id === editingId)?.archivedAt) return;
    checklist = checklist.filter((item) => item.id !== id); renderChecklist(); state.taskBoardDirty = true; taskDrafts.changed(); updateTaskFeedback();
  }
  function taskBody() {
    return { ...(editingId ? { id: editingId } : {}), title: $("board-task-name").value, description: $("board-task-description").value, result: $("board-task-result").value, statusId: $("board-task-status").value, priority: $("board-task-priority").value, startDate: $("board-task-start").value, due: $("board-task-due").value, tagIds: selectedTags(), checklist: structuredClone(checklist), revision: formRevision };
  }
  function applyTaskBody(body) {
    $("board-task-name").value = body.title || ""; mentions.load(body.description || "", board.documents); results.load(body.result || "", board.documents);
    $("board-task-status").innerHTML = view.statusOptions(board.statuses, body.statusId);
    if (!board.statuses.some((status) => status.id === body.statusId)) $("board-task-status").insertAdjacentHTML("afterbegin", '<option value="" selected disabled>Pilih status baru</option>');
    $("board-task-priority").value = body.priority || "normal"; $("board-task-start").value = body.startDate || ""; $("board-task-due").value = body.due || "";
    $("board-task-tags").innerHTML = tagChoices(board.tags || [], body.tagIds || [], esc); checklist = structuredClone(body.checklist || []); renderChecklist(); renderSelectedTags();
    if (body.revision !== board.revision) { conflicted = true; $("board-task-error").textContent = "Draft berasal dari revisi papan sebelumnya. Muat ulang papan, lalu periksa perubahan sebelum menyimpan."; $("board-task-reload").hidden = false; }
  }
  async function openBoardTaskFromDocument(body) {
    if (state.current !== "tasks" && !await actions.navigate("tasks")) return;
    if (!board) return;
    openBoardTask(); if (!$("board-task-dialog").open) return;
    if (!$("board-draft-recovery").hidden) { actions.notify("Pulihkan atau buang draft task baru sebelum membuat task dari dokumen."); return; }
    applyTaskBody({ ...taskBody(), ...body, revision: board.revision }); state.taskBoardDirty = true; taskDrafts.changed(); updateTaskFeedback();
  }
  async function openRelatedTask(id) {
    if (state.current !== "tasks" && !await actions.navigate("tasks")) return;
    const task = board?.tasks.find((item) => item.id === id); if (task?.archivedAt) setBoardView("archive"); openBoardTask(id);
  }
  function taskControls() {
    const task = board?.tasks.find((task) => task.id === editingId), archived = Boolean(task?.archivedAt);
    for (const id of ["board-task-name", "board-task-status", "board-task-priority", "board-task-start", "board-task-due", "board-task-description", "board-task-result", "board-task-save"]) $(id).disabled = state.toolBusy || archived;
    $("board-task-tags").querySelectorAll("input").forEach((input) => { input.disabled = state.toolBusy || archived || (!input.checked && selectedTags().length >= 20); });
    $("board-checklist-items").querySelectorAll("input,button").forEach((input) => { input.disabled = state.toolBusy || archived; });
    $("board-checklist-add").disabled = state.toolBusy || archived || checklist.length >= 100;
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
    $("board-tag-toggle").disabled = state.toolBusy || archived;
    $("board-tag-search").disabled = state.toolBusy || archived;
    if (state.toolBusy || archived) closeTagPicker();
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
    formRevision = board.revision; checklist = structuredClone(task?.checklist || []); renderChecklist();
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
    $("board-task-actions").open = false; closeTagPicker(); $("board-tag-search").value = "";
    $("board-properties").open = !matchMedia("(max-width:760px)").matches;
    $("board-checklist-section").open = Boolean(checklist.length);
    $("board-attachments").open = Boolean(task?.attachments?.length);
    renderSelectedTags(); filterTaskTags(); setBoardEditor("description"); taskControls();
    $("board-task-dialog").showModal(); (task?.archivedAt ? $("board-task-dialog").querySelector("[data-action=closeTaskBoardDialog]") : $("board-task-name")).focus();
    updateTaskFeedback();
    taskDrafts.open(Boolean(task?.archivedAt));
  }
  async function closeBoardDialog(id) {
    const dialog = $(id);
    if (id !== "board-task-dialog" || !dialog.open) { dialog.close(); return; }
    dialog.classList.add("is-closing");
    const form = $("board-task-form");
    form.inert = true;
    try {
      await Promise.allSettled(dialog.getAnimations().map((animation) => animation.finished));
    } finally {
      dialog.close();
      dialog.classList.remove("is-closing");
      form.inert = false;
    }
  }
  function closeTaskBoardDialog(id) {
    if (state.toolBusy || !dialogIds.includes(id) || $(id).classList.contains("is-closing")) return;
    if (id !== "board-confirm-dialog" && state.taskBoardDirty) {
      ask("Tutup editor?", id === "board-task-dialog" ? "Perubahan belum diterapkan ke papan. Simpan sebagai draft untuk melanjutkan nanti." : "Ada pengaturan yang belum disimpan. Tutup dan buang perubahan form ini?", id === "board-task-dialog" ? "Simpan draft & tutup" : "Buang perubahan", async () => {
        if (id === "board-task-dialog") { try { await taskDrafts.flush(); } catch (error) { $("board-confirm-error").textContent = error.message; return; } }
        state.taskBoardDirty = false; $("board-confirm-dialog").close(); await closeBoardDialog(id);
      });
    } else return closeBoardDialog(id);
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
    const changed = $("board-" + field + "-panel").hidden;
    editors.forEach((editor) => editor.close());
    for (const name of ["description", "result"]) {
      const selected = name === field;
      $("board-" + name + "-panel").hidden = !selected;
      $("board-" + name + "-label").setAttribute("aria-selected", String(selected));
      $("board-" + name + "-label").tabIndex = selected ? 0 : -1;
    }
    updateTaskFeedback();
    if (changed) actions.animateContent($("board-" + field + "-panel"), 0);
  }
  function updateTaskFeedback() {
    const filled = Boolean($("board-task-result").value.trim());
    $("board-result-indicator").hidden = !filled;
    $("board-result-indicator").textContent = filled ? "Terisi" : "";
    $("board-result-label").setAttribute("aria-label", filled ? "Hasil task, sudah terisi" : "Hasil task, belum terisi");
    const archived = Boolean(board?.tasks.find((task) => task.id === editingId)?.archivedAt);
    actions.animateStatus($("board-task-save-state"), archived ? "Hanya baca" : state.toolBusy ? "Menyimpan…" : state.taskBoardDirty ? "Perubahan belum disimpan" : "Belum ada perubahan");
    for (const field of ["description", "result"]) $("board-" + field + "-length").textContent = `${$("board-task-" + field).value.length.toLocaleString("id-ID")}/3.000`;
    $("board-property-summary").textContent = [$("board-task-status").selectedOptions[0]?.textContent, $("board-task-due").value ? `Deadline ${$("board-task-due").value}` : "Tanpa deadline"].filter(Boolean).join(" · ");
    const title = $("board-task-name"); title.style.height = "auto"; title.style.height = title.scrollHeight + "px";
    selects.refresh();
    actions.updateTabIndicator(document.querySelector(".tb-editor-tabs"));
  }
  function renderSelectedTags() {
    const selected = selectedTags(), archived = Boolean(board.tasks.find((task) => task.id === editingId)?.archivedAt);
    $("board-selected-tags").innerHTML = (board.tags || []).filter((tag) => selected.includes(tag.id)).map((tag) => archived ? `<span class="tb-selected-tag">${esc(tag.name)}</span>` : `<button type="button" class="tb-selected-tag" data-action="removeBoardTaskTag" data-arg="${esc(tag.id)}" aria-label="Lepas tag ${esc(tag.name)}"><span>${esc(tag.name)}</span>${icon("close")}</button>`).join("");
    $("board-selected-tags").hidden = !selected.length;
    $("board-tag-toggle").firstElementChild.textContent = selected.length ? "Tambah atau ubah tag" : "Pilih tag";
    $("board-tag-selection-count").textContent = `${selected.length}/20 dipilih`;
    $("board-task-tags").querySelectorAll("input").forEach((input) => { input.disabled = state.toolBusy || archived || (!input.checked && selected.length >= 20); });
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
    if (input) {
      const chips = [...$("board-selected-tags").querySelectorAll("button")], index = chips.findIndex((chip) => chip.dataset.arg === id);
      input.checked = false; state.taskBoardDirty = true; renderSelectedTags(); taskDrafts.changed(); updateTaskFeedback();
      ($("board-selected-tags").querySelectorAll("button")[Math.max(0, index)] || $("board-tag-toggle")).focus();
    }
  }
  function restoreBoardTask(id) {
    if (state.toolBusy || taskBoardDialogOpen()) return;
    const task = board?.tasks.find((task) => task.id === id && task.archivedAt);
    if (!task) return;
    ask("Pulihkan task?", `“${task.title}” akan dikembalikan ke papan dengan status ${board.statuses.find((status) => status.id === task.statusId).name}.`, "Pulihkan", () => write("tasks/restore", { id: task.id, confirm: true }, "confirm", ["board-confirm-dialog"], "Task dipulihkan ke papan."));
  }
  function selectedTags() { return [...$("board-task-tags").querySelectorAll("input:checked")].map((input) => input.value); }
  function closeTagPicker() { if ($("board-tag-panel").matches(":popover-open")) $("board-tag-panel").hidePopover(); }
  function chooseBoardAttachments() { if (!state.toolBusy && !$("board-attachment-input").disabled) $("board-attachment-input").click(); }
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
    $("board-settings").inert = true; $("board-task-actions").open = false; closeTagPicker();
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
      if (endpoint === "tasks/save" && type === "task") taskDrafts.published(body);
      for (const id of closeIds) await closeBoardDialog(id);
      state.taskBoardDirty = false;
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
  async function saveBoardTask(event) {
    event.preventDefault(); if (state.toolBusy) return; const title = $("board-task-name").value.trim();
    if (board?.tasks.find((task) => task.id === editingId)?.archivedAt) return;
    if (!mentions.sync()) { setBoardEditor("description"); $("board-task-description-editor").focus(); return; }
    if (!results.sync()) { setBoardEditor("result"); $("board-task-result-editor").focus(); return; }
    if (!title) { $("board-task-name").setCustomValidity("Tulis judul task terlebih dahulu."); $("board-task-name").reportValidity(); return; }
    const startDate = $("board-task-start").value, due = $("board-task-due").value;
    if (startDate && due && startDate > due) { $("board-properties").open = true; $("board-task-due").setCustomValidity("Deadline tidak boleh sebelum tanggal mulai."); $("board-task-due").reportValidity(); return; }
    const tagIds = selectedTags();
    if (tagIds.length > 20) { $("board-task-tags-error").textContent = "Pilih maksimal 20 tag per task."; $("board-properties").open = true; $("board-tag-panel").showPopover(); return; }
    if (checklist.some((item) => !item.text.trim())) { $("board-task-error").textContent = "Isi atau hapus item checklist yang masih kosong."; return; }
    const controls = [...$("board-task-form").querySelectorAll("button,input,select,textarea")], disabled = controls.map((control) => control.disabled);
    state.toolBusy = true; controls.forEach((control) => { control.disabled = true; }); editors.forEach((editor) => editor.busy(true));
    let flushed = false;
    try { await taskDrafts.flush(); flushed = true; }
    catch (error) { $("board-task-error").textContent = error.message; }
    finally { state.toolBusy = false; controls.forEach((control, index) => { control.disabled = disabled[index]; }); editors.forEach((editor) => editor.busy(false)); taskControls(); }
    if (!flushed) return;
    return write("tasks/save", { ...taskBody(), ...taskDrafts.draftFields(), title, tagIds, startDate, due }, "task", ["board-task-dialog"], editingId ? "Perubahan task disimpan." : "Task ditambahkan.");
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
      formRevision = board.revision;
      const preferences = await taskDrafts.loadPreferences(); savedViews = preferences.views || []; viewsToken = preferences.viewsToken || null; renderFilters();
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
      taskDrafts.rebase();
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
    selects.bind();
    taskDrafts.bind();
    attachments.bind();
    editors.forEach((editor) => editor.bind());
    for (const id of ["board-task-dialog", "board-status-dialog", "board-tag-dialog", "board-views-dialog"]) $(id).addEventListener("cancel", (event) => {
      if (state.toolBusy) return;
      if (id === "board-task-dialog" || state.taskBoardDirty) { event.preventDefault(); closeTaskBoardDialog(id); }
    });
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        const open = ["board-settings", "board-task-actions"].map($).find((node) => node?.open && !node.inert && !$("board-confirm-dialog").open);
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
      for (const id of ["board-settings", "board-task-actions"]) {
        const detail = $(id); if (detail?.open && !detail.contains(event.target)) detail.open = false;
      }
    });
    document.addEventListener("click", (event) => {
      const dateButton = event.target.closest("[data-board-date]");
      if (dateButton && !state.toolBusy && !taskBoardDialogOpen()) {
        const input = dateButton.nextElementSibling;
        if (typeof input.showPicker === "function") { try { input.showPicker(); } catch { input.removeAttribute("aria-hidden"); input.focus(); } }
        else { input.removeAttribute("aria-hidden"); input.focus(); }
        return;
      }
      const card = event.target.closest("[data-board-task]");
      if (card && !event.target.closest("a,button,input,select,textarea") && !draggingId) openBoardTask(card.dataset.boardTask);
    });
    document.addEventListener("change", async (event) => {
      if (event.target.dataset.boardQuick && !state.toolBusy && !taskBoardDialogOpen()) {
        const task = board?.tasks.find((item) => item.id === event.target.dataset.taskId); if (!task) return;
        const changed = { ...task, [event.target.dataset.boardQuick]: event.target.value };
        const key = event.target.dataset.boardQuick, id = task.id;
        if (changed.startDate && changed.due && changed.startDate > changed.due) { paint(); actions.notify("Deadline tidak boleh sebelum tanggal mulai."); }
        else await write("tasks/save", changed, "board", [], "Task diperbarui.");
        const input = [...document.querySelectorAll("[data-board-quick]")].find((node) => node.dataset.taskId === id && node.dataset.boardQuick === key);
        (input?.previousElementSibling?.matches("[data-board-date]") ? input.previousElementSibling : input?.parentElement.querySelector(".tb-select-trigger"))?.focus({ preventScroll: true });
        return;
      }
      if (event.target.id === "board-saved-view") { selectedView = event.target.value; filters = { ...emptyFilters(), ...(savedViews.find((item) => item.id === selectedView)?.filters || {}) }; renderFilters(); paint(); return; }
      if (event.target.id.startsWith("board-filter-")) { const key = event.target.id.slice(13); if (!(key in filters)) return; filters[key] = event.target.value; renderFilters(); paint(); return; }
      if (event.target.id !== "board-timeline-week" || state.toolBusy || taskBoardDialogOpen()) return;
      const value = event.target.value;
      if (event.target.validity.valid && value) { timelineWeek = weekStart(value); paint(); }
    });
    document.addEventListener("input", (event) => {
      if (event.target.id === "board-attachment-input") return;
      if (event.target.id === "board-search") paint();
      if (event.target.id === "board-view-name") event.target.setCustomValidity("");
      if (event.target.id === "board-tag-search") { filterTaskTags(); return; }
      if (event.target.closest("#board-task-form")) {
        const field = event.target.dataset.checklistField;
        if (field) { const item = checklist.find((item) => item.id === event.target.closest("[data-checklist-id]").dataset.checklistId); if (item) item[field] = field === "done" ? event.target.checked : event.target.value; $("board-checklist-progress").textContent = `${checklist.filter((item) => item.done).length}/${checklist.length}`; }
        state.taskBoardDirty = true; $("board-task-name").setCustomValidity("");
        $("board-task-due").setCustomValidity(""); taskDrafts.changed(); updateTaskFeedback();
      }
      if (event.target.closest("#board-task-tags")) { $("board-task-tags-error").textContent = ""; renderSelectedTags(); }
      if (event.target.closest("#board-tag-rows")) {
        const tag = tagDraft.find((tag) => tag.id === event.target.closest("[data-board-tag-id]").dataset.boardTagId);
        if (tag) tag.name = event.target.value;
        state.taskBoardDirty = true;
        $("board-tag-rows").querySelectorAll("input").forEach((input) => input.setCustomValidity(""));
      }
      if (event.target.closest("#board-view-rows")) {
        const item = viewDraft.find((item) => item.id === event.target.closest("[data-board-view-id]").dataset.boardViewId);
        if (item) item.name = event.target.value;
        state.taskBoardDirty = true; $("board-views-error").textContent = "";
      }
      if (event.target.dataset.boardField && draft) {
        const status = draft.find((s) => s.id === event.target.closest("[data-board-status-id]").dataset.boardStatusId);
        status[event.target.dataset.boardField] = event.target.type === "checkbox" ? event.target.checked : event.target.value; state.taskBoardDirty = true;
        if (event.target.checked && ["completed", "inProgress"].includes(event.target.dataset.boardField)) {
          const other = event.target.dataset.boardField === "completed" ? "inProgress" : "completed";
          status[other] = false;
          event.target.closest("[data-board-status-id]").querySelector(`[data-board-field="${other}"]`).checked = false;
        }
        $("board-status-rows").querySelectorAll("input").forEach((input) => input.setCustomValidity(""));
      }
    });
    document.addEventListener("close", (event) => {
      if (["board-task-dialog", "board-status-dialog", "board-tag-dialog", "board-views-dialog"].includes(event.target.id)) state.taskBoardDirty = false;
      if (event.target.id === "board-task-dialog") closeTagPicker();
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
    const tagPanel = $("board-tag-panel");
    tagPanel.addEventListener("toggle", () => {
      const open = tagPanel.matches(":popover-open"), trigger = $("board-tag-toggle");
      trigger.setAttribute("aria-expanded", String(open));
      if (open) {
        selects.close(); const rect = trigger.getBoundingClientRect(), below = innerHeight - rect.bottom - 10, above = rect.top - 10, up = below < 200 && above > below;
        tagPanel.style.width = Math.min(innerWidth - 16, Math.max(260, rect.width)) + "px";
        tagPanel.style.maxHeight = Math.min(340, Math.max(140, up ? above : below)) + "px";
        tagPanel.style.left = Math.max(8, Math.min(rect.left, innerWidth - tagPanel.offsetWidth - 8)) + "px";
        tagPanel.style.top = (up ? Math.max(8, rect.top - tagPanel.offsetHeight - 5) : rect.bottom + 5) + "px";
        $("board-tag-search").focus();
      } else if ($("board-task-dialog").open && (tagPanel.contains(document.activeElement) || document.activeElement === document.body)) trigger.focus({ preventScroll: true });
    });
    tagPanel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeTagPicker(); $("board-tag-toggle").focus(); }
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        const inputs = [...$("board-task-tags").querySelectorAll("label:not([hidden]) input:not(:disabled)")], index = inputs.indexOf(document.activeElement);
        event.preventDefault(); inputs[Math.max(0, Math.min(inputs.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
      }
    });
    document.addEventListener("scroll", (event) => { if (!tagPanel.contains(event.target)) closeTagPicker(); }, true);
    window.addEventListener("resize", () => { closeTagPicker(); if ($("board-task-dialog").open) updateTaskFeedback(); });
    matchMedia("(max-width:760px)").addEventListener("change", (event) => { $("board-properties").open = !event.matches; });
    $("board-task-form").addEventListener("invalid", (event) => { if (event.target.closest(".tb-properties")) $("board-properties").open = true; }, true);
  }
  return { toggleBoardFilters, removeBoardFilter, openBoardViews, saveBoardViews, chooseBoardAttachments, openRelatedTask, openBoardTaskFromDocument, addBoardChecklist, removeBoardChecklist, recoverBoardTaskDraft: taskDrafts.recover, discardBoardTaskDraft: taskDrafts.discard, setBoardDateFilter, openBoardSaveView, cancelBoardSaveView, saveBoardView, deleteBoardSavedView, removeBoardAttachment: attachments.removeBoardAttachment, setBoardEditor, removeBoardTaskTag, restoreBoardTask, openBoardTags, addBoardTag, confirmBoardTagDelete, saveBoardTags, renderTaskBoard, refreshTaskBoard, openBoardTask, closeTaskBoardDialog, openBoardStatuses, addBoardStatus, moveBoardStatus, confirmBoardStatusDelete, saveBoardTask, confirmBoardTaskDelete, confirmBoardTaskArchive, confirmBoardAction, saveBoardStatuses, reloadTaskBoard, clearBoardSearch, setBoardView, moveBoardWeek, bindTaskBoard, taskBoardDialogOpen };
}
