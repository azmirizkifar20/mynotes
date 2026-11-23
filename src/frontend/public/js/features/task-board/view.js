import { descriptionHTML, descriptionText } from "./mention-text.js";

export const tones = { neutral: "Abu-abu", blue: "Biru", amber: "Amber", green: "Hijau", red: "Merah" };
export const priorities = { low: "Rendah", normal: "Normal", high: "Tinggi" };
export const taskCode = (task) => "T-" + String(task.number).padStart(3, "0");

export function createFeature({ actions }) {
  const { escape: esc, icon } = actions;
  const options = (statuses, selected = "") => statuses.map((status) => `<option value="${esc(status.id)}" ${status.id === selected ? "selected" : ""}>${esc(status.name)}</option>`).join("");
  function card(board, task, archived = false) {
    const status = board.statuses.find((status) => status.id === task.statusId);
    return `<article class="tb-card" draggable="${!archived}" data-board-task="${esc(task.id)}"><button class="tb-card-open" data-action="openBoardTask" data-arg="${esc(task.id)}" aria-label="${archived ? "Lihat arsip" : "Edit"} ${esc(task.title)}"><h2>${esc(task.title)}</h2></button>${task.description ? `<p class="tb-card-copy">${descriptionHTML(task.description, board.documents, actions)}</p>` : ""}${archived ? `<p class="tb-archive-meta">${esc(status.name)} · Diarsipkan ${esc(new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(task.archivedAt)))}</p>` : ""}<div class="tb-card-meta"><span class="tb-priority tb-priority-${esc(task.priority)}">${icon("priority")}${esc(priorities[task.priority])}</span>${task.due ? `<span class="tb-date">${icon("calendar")}${esc(new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(task.due + "T12:00:00")))}</span>` : ""}<span class="tb-task-code">${esc(taskCode(task))}</span></div></article>`;
  }
  function boardColumns(board, query, archived = false) {
    const visible = board.tasks.filter((task) => Boolean(task.archivedAt) === archived && `${task.title} ${descriptionText(task.description, board.documents)}`.toLocaleLowerCase().includes(query));
    if (archived) return { count: visible.length, html: visible.map((task) => card(board, task, true)).join("") || (query ? "" : '<p class="tb-empty-column">Belum ada task di arsip. Arsipkan task yang sudah selesai melalui detail task.</p>') };
    return { count: visible.length, html: board.statuses.map((status) => {
      const tasks = visible.filter((task) => task.statusId === status.id);
      return `<section class="tb-column" data-board-status="${esc(status.id)}" aria-label="${esc(status.name)}"><div class="tb-column-head"><span class="tb-status-chip" data-tone="${esc(status.tone)}"><i class="tb-dot" aria-hidden="true"></i><span>${esc(status.name)}</span></span><span class="tb-column-count">${tasks.length}</span><button class="icon-button" data-action="openBoardTask" data-arg="" data-arg1="${esc(status.id)}" aria-label="Tambah task di ${esc(status.name)}">${icon("plus")}</button></div><div class="tb-cards">${tasks.map((task) => card(board, task)).join("") || `<p class="tb-empty-column">${query ? "Tidak ada hasil di status ini" : "Belum ada task di sini"}</p>`}</div><button class="tb-add-task" data-action="openBoardTask" data-arg="" data-arg1="${esc(status.id)}">${icon("plus")}Tambah task</button></section>`;
    }).join("") };
  }
  function statusRows(statuses) {
    return statuses.map((status, index) => `<div class="tb-status-row" data-board-status-id="${esc(status.id)}"><input class="text-input" aria-label="Nama status ${index + 1}" data-board-field="name" value="${esc(status.name)}" maxlength="32" required placeholder="Nama status"><select class="text-input" aria-label="Warna status ${index + 1}" data-board-field="tone">${Object.entries(tones).map(([key, name]) => `<option value="${key}" ${status.tone === key ? "selected" : ""}>${name}</option>`).join("")}</select><label class="tb-completed"><input type="checkbox" data-board-field="completed" ${status.completed ? "checked" : ""}>Selesai</label><div class="tb-status-actions"><button type="button" class="icon-button" data-action="moveBoardStatus" data-arg="${esc(status.id)}" data-arg1="-1" ${index === 0 ? "disabled" : ""} aria-label="Geser ${esc(status.name)} ke kiri">${icon("up")}</button><button type="button" class="icon-button" data-action="moveBoardStatus" data-arg="${esc(status.id)}" data-arg1="1" ${index === statuses.length - 1 ? "disabled" : ""} aria-label="Geser ${esc(status.name)} ke kanan">${icon("down")}</button><button type="button" class="icon-button" data-action="confirmBoardStatusDelete" data-arg="${esc(status.id)}" ${statuses.length === 1 ? "disabled" : ""} aria-label="Hapus status ${esc(status.name)}">${icon("trash")}</button></div></div>`).join("");
  }
  return { boardColumns, statusRows, statusOptions: options };
}
