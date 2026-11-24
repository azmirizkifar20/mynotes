import { descriptionText, descriptionParts } from "./mention-text.js";
import { timelineHTML } from "./timeline.js";
import { taskTags, tagsHTML } from "./tags.js";

export const tones = { neutral: "Abu-abu", blue: "Biru", amber: "Amber", green: "Hijau", red: "Merah" };
export const priorities = { low: "Rendah", normal: "Normal", high: "Tinggi" };
export const taskCode = (task) => "T-" + String(task.number).padStart(3, "0");

export function createFeature({ actions }) {
  const { escape: esc, icon } = actions;
  const options = (statuses, selected = "") => statuses.map((status) => `<option value="${esc(status.id)}" ${status.id === selected ? "selected" : ""}>${esc(status.name)}</option>`).join("");
  function shell() {
    return `<section class="task-board">
      <div id="board-controls">
        <header class="tb-heading"><div><h1>Task board</h1><p id="board-summary" role="status">Memuat papan…</p></div><button class="small-button primary" id="board-new-task" data-action="openBoardTask" disabled>${icon("plus")}Tambah task</button></header>
        <div class="tb-toolbar"><div class="tb-views" role="tablist" aria-label="Tampilan task board">
          <button class="tb-view" id="board-active-tab" role="tab" aria-controls="board-columns" data-action="setBoardView" data-arg="active" aria-selected="true" aria-pressed="true" disabled>Papan</button>
          <button class="tb-view" id="board-timeline-tab" role="tab" aria-controls="board-columns" data-action="setBoardView" data-arg="timeline" aria-selected="false" aria-pressed="false" tabindex="-1" disabled>Time table</button>
          <button class="tb-view" id="board-archive-tab" role="tab" aria-controls="board-columns" data-action="setBoardView" data-arg="archive" aria-selected="false" aria-pressed="false" tabindex="-1" disabled>Arsip <span id="board-archive-count">0</span></button>
        </div><div class="tb-utilities"><label class="tb-search">${icon("search")}<input type="search" id="board-search" placeholder="Cari task atau tag…" aria-label="Cari judul, deskripsi, hasil, atau tag task" disabled></label>
          <details class="tb-settings" id="board-settings" inert><summary aria-label="Pengaturan task board">${icon("settings")}<span>Pengaturan</span></summary><div class="tb-menu"><button data-action="openBoardTags">Kelola tag</button><button data-action="openBoardStatuses">Kelola status</button></div></details>
        </div></div>
      </div>
      <span class="sr-only" id="board-count" role="status"></span><p class="delete-error" id="board-error" role="alert"></p><button class="small-button" id="board-retry" data-action="reloadTaskBoard" hidden>Muat ulang papan</button>
      <div class="tb-columns" id="board-columns" role="tabpanel" aria-labelledby="board-active-tab"><p class="tb-loading" role="status">Memuat task…</p></div>
      <div class="tb-no-results" id="board-empty-search" hidden>Tidak ada task yang cocok.<button class="small-button" data-action="clearBoardSearch">Hapus pencarian</button></div><p class="tb-hint tb-board-hint" id="board-view-hint">Seret kartu untuk mengubah status, atau klik kartu untuk mengedit.</p>
    </section>`;
  }
  const visibleTasks = (board, query, archived = false) => board.tasks.filter((task) => Boolean(task.archivedAt) === archived && `${task.title} ${descriptionText(task.description, board.documents)} ${descriptionText(task.result || "", board.documents)} ${taskTags(board, task).map((tag) => tag.name).join(" ")}`.toLocaleLowerCase().includes(query));
  function card(board, task, archived = false) {
    const status = board.statuses.find((status) => status.id === task.statusId);
    const now = new Date(), today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
    const late = task.due && task.due < today && !status.completed;
    const scheduledDate = task.due || task.startDate;
    const date = scheduledDate ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(scheduledDate + "T12:00:00")) : "";
    const datePrefix = !task.due ? "Mulai " : late ? "Lewat · " : status.completed ? "Tenggat " : "";
    const references = new Set(descriptionParts((task.description || "") + "\n" + (task.result || "")).filter((part) => part.id && board.documents.some((document) => document.id === part.id)).map((part) => part.id)).size;
    const title = `<button class="tb-card-open" data-action="openBoardTask" data-arg="${esc(task.id)}" aria-label="${archived ? "Lihat arsip" : "Edit"} ${esc(task.title)}"><h2>${esc(task.title)}</h2></button>`;
    if (archived) return `<article class="tb-archive-row" data-board-task="${esc(task.id)}"><div>${title}<small class="tb-task-code">${esc(taskCode(task))}</small>${tagsHTML(board, task, esc)}</div><span class="tb-status-chip tb-status-badge" data-tone="${esc(status.tone)}"><i class="tb-dot" aria-hidden="true"></i>${esc(status.name)}</span><span class="tb-archive-date">${esc(new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(task.archivedAt)))}</span><button class="small-button" data-action="restoreBoardTask" data-arg="${esc(task.id)}" aria-label="Pulihkan ${esc(task.title)}">Pulihkan</button></article>`;
    const tags = tagsHTML(board, task, esc, 1);
    const attachments = task.attachments?.length || 0;
    const hasResult = Boolean(task.result?.trim());
    return `<article class="tb-card" draggable="true" data-board-task="${esc(task.id)}">${title}${tags || date ? `<div class="tb-card-context">${tags}${date ? `<span class="tb-date ${late ? "tb-overdue" : ""}" title="${task.due ? "Tenggat " : "Mulai "}${esc(date)}">${icon("calendar")}${datePrefix}${esc(date)}</span>` : ""}</div>` : ""}<div class="tb-card-meta"><span class="tb-task-code">${esc(taskCode(task))}</span>${task.priority === "high" ? `<span class="tb-priority tb-priority-high">${icon("priority")}Tinggi</span>` : ""}${references || attachments || hasResult ? `<span class="tb-card-resources">${references ? `<span class="tb-linked" aria-label="${references} dokumen disebut" title="${references} dokumen disebut">${icon("doc")}${references}</span>` : ""}${attachments ? `<span class="tb-linked" aria-label="${attachments} lampiran" title="${attachments} lampiran">${icon("attachment")}${attachments}</span>` : ""}${hasResult ? `<span class="tb-linked" role="img" aria-label="Hasil task sudah diisi" title="Hasil task sudah diisi">${icon("check")}</span>` : ""}</span>` : ""}</div></article>`;
  }
  function boardColumns(board, query, archived = false) {
    const visible = visibleTasks(board, query, archived);
    if (archived) return { count: visible.length, html: visible.length ? `<div class="tb-archive-list"><div class="tb-archive-head"><span>Task</span><span>Status</span><span>Diarsipkan</span><span class="sr-only">Aksi</span></div>${visible.map((task) => card(board, task, true)).join("")}</div>` : (query ? "" : '<p class="tb-empty-column">Belum ada task di arsip. Arsipkan task yang sudah selesai melalui detail task.</p>') };
    return { count: visible.length, html: board.statuses.map((status) => {
      const tasks = visible.filter((task) => task.statusId === status.id);
      return `<section class="tb-column" data-board-status="${esc(status.id)}" aria-label="${esc(status.name)}"><div class="tb-column-head"><span class="tb-status-chip" data-tone="${esc(status.tone)}"><i class="tb-dot" aria-hidden="true"></i><span>${esc(status.name)}</span></span><span class="tb-column-count">${tasks.length}</span><button class="icon-button" data-action="openBoardTask" data-arg="" data-arg1="${esc(status.id)}" aria-label="Tambah task di ${esc(status.name)}">${icon("plus")}</button></div><div class="tb-cards">${tasks.map((task) => card(board, task)).join("") || `<p class="tb-empty-column">${query ? "Tidak ada hasil di status ini" : "Belum ada task di sini"}</p>`}</div><button class="tb-add-task" data-action="openBoardTask" data-arg="" data-arg1="${esc(status.id)}">${icon("plus")}Tambah task</button></section>`;
    }).join("") };
  }
  function boardTimeline(board, query, week) {
    const tasks = visibleTasks(board, query);
    return { count: tasks.length, html: timelineHTML(tasks, board.statuses, week, actions) };
  }
  function statusRows(statuses) {
    return statuses.map((status, index) => `<div class="tb-status-row" data-board-status-id="${esc(status.id)}"><input class="text-input" aria-label="Nama status ${index + 1}" data-board-field="name" value="${esc(status.name)}" maxlength="32" required placeholder="Nama status"><select class="text-input" aria-label="Warna status ${index + 1}" data-board-field="tone">${Object.entries(tones).map(([key, name]) => `<option value="${key}" ${status.tone === key ? "selected" : ""}>${name}</option>`).join("")}</select><label class="tb-completed"><input type="checkbox" data-board-field="completed" ${status.completed ? "checked" : ""}>Selesai</label><div class="tb-status-actions"><button type="button" class="icon-button" data-action="moveBoardStatus" data-arg="${esc(status.id)}" data-arg1="-1" ${index === 0 ? "disabled" : ""} aria-label="Geser ${esc(status.name)} ke kiri">${icon("up")}</button><button type="button" class="icon-button" data-action="moveBoardStatus" data-arg="${esc(status.id)}" data-arg1="1" ${index === statuses.length - 1 ? "disabled" : ""} aria-label="Geser ${esc(status.name)} ke kanan">${icon("down")}</button><button type="button" class="icon-button" data-action="confirmBoardStatusDelete" data-arg="${esc(status.id)}" ${statuses.length === 1 ? "disabled" : ""} aria-label="Hapus status ${esc(status.name)}">${icon("trash")}</button></div></div>`).join("");
  }
  return { shell, boardColumns, boardTimeline, statusRows, statusOptions: options };
}
