const dayDate = (day) => new Date(day + "T12:00:00Z");
const formatDate = (day, year = true) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" }).format(dayDate(day));
const dayOffset = (first, last) => Math.round((dayDate(last) - dayDate(first)) / 86400000);
function shiftDay(day, offset) {
  const date = dayDate(day); date.setUTCDate(date.getUTCDate() + offset);
  return date.getUTCFullYear() < 1 ? "0001-01-01" : date.getUTCFullYear() > 9999 ? "9999-12-31" : date.toISOString().slice(0, 10);
}
function localToday() {
  const now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
}
export function weekStart(day) {
  if (typeof day !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(dayDate(day).getTime()) || dayDate(day).toISOString().slice(0, 10) !== day)
    throw new RangeError("Tanggal tidak valid");
  return shiftDay(day, -((dayDate(day).getUTCDay() + 6) % 7));
}
export const currentWeek = () => weekStart(localToday());
export const moveWeek = (week, offset) => weekStart(shiftDay(weekStart(week), offset * 7));
export function weekModel(tasks, week) {
  const first = weekStart(week), last = shiftDay(first, 6), days = dayOffset(first, last) + 1;
  const scheduled = tasks.filter((task) => task.startDate || task.due).map((task) => {
    const start = task.startDate || task.due, finish = task.due || task.startDate;
    return { task, start, finish, columns: [start < first ? 1 : dayOffset(first, start) + 1, finish > last ? days + 1 : dayOffset(first, finish) + 2] };
  }).filter((row) => row.start <= last && row.finish >= first).sort((a, b) => a.start.localeCompare(b.start) || Number(a.task.number) - Number(b.task.number));
  return { days, first, last, scheduled, undated: tasks.filter((task) => !task.startDate && !task.due) };
}
function dates(task, compact = false) {
  if (!task.startDate) return formatDate(task.due, !compact) + " · Mulai belum diisi";
  if (!task.due) return formatDate(task.startDate, !compact) + " · Akhir belum diisi";
  return formatDate(task.startDate, !compact) + (task.startDate === task.due ? "" : " – " + formatDate(task.due, !compact));
}
export function timelineHTML(tasks, statuses, week, { escape: esc, icon }) {
  const { days, first, last, scheduled, undated } = weekModel(tasks, week);
  const now = localToday(), today = now >= first && now <= last ? dayOffset(first, now) + 1 : 0;
  const heading = formatDate(first) + " – " + formatDate(last);
  const statusOf = (task) => statuses.find((status) => status.id === task.statusId);
  const statusLabel = (task) => { const s = statusOf(task); return `<span class="tb-status-chip" data-tone="${esc(s.tone)}"><i class="tb-dot" aria-hidden="true"></i>${esc(s.name)}</span>`; };
  const openButton = (task) => `<button data-action="openBoardTask" data-arg="${esc(task.id)}" class="tb-timeline-title">${esc(task.title)}</button>`;
  const headers = Array.from({ length: days }, (_, index) => {
    const day = index + 1, date = dayDate(shiftDay(first, index)), weekend = [0, 6].includes(date.getUTCDay());
    return `<th scope="col" class="${weekend ? "tb-weekend" : ""} ${day === today ? "tb-today" : ""}"><span>${new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" }).format(date)}</span><b>${date.getUTCDate()}</b></th>`;
  }).join("");
  const rows = scheduled.map(({ task, columns }) => {
    const label = task.title + " · " + statusOf(task).name + " · " + dates(task), partial = !task.startDate || !task.due;
    return `<tr><th scope="row" class="tb-timeline-label">${openButton(task)}<small title="${esc(dates(task))}">${esc(dates(task, true))}</small></th><td colspan="${days}"><div class="tb-timeline-track">${today ? `<span class="tb-today-line" style="grid-column:${today}" aria-hidden="true"></span>` : ""}<button data-action="openBoardTask" data-arg="${esc(task.id)}" class="tb-timeline-bar tb-status-chip ${partial ? "tb-timeline-point" : ""}" data-tone="${esc(statusOf(task).tone)}" style="grid-column:${columns[0]}/${columns[1]}" title="${esc(label)}" aria-label="${esc(label)}"><span aria-hidden="true">${partial ? "◆ " : ""}${esc(statusOf(task).name)}</span></button></div></td></tr>`;
  }).join("");
  return `<div class="tb-timeline-controls"><div><h2>${esc(heading)}</h2><p>${scheduled.length} terjadwal minggu ini · Senin–Minggu</p></div><div class="tb-week-nav"><button class="icon-button" data-action="moveBoardWeek" data-arg="-1" aria-label="Minggu sebelumnya" ${first === "0001-01-01" ? "disabled" : ""}>${icon("chevron")}</button><input id="board-timeline-week" type="date" class="text-input" value="${first}" min="0001-01-01" max="9999-12-31" aria-label="Pilih tanggal dalam minggu timeline"><button class="icon-button" data-action="moveBoardWeek" data-arg="1" aria-label="Minggu berikutnya" ${last === "9999-12-31" ? "disabled" : ""}>${icon("chevron")}</button><button class="small-button" data-action="moveBoardWeek" data-arg="today">Minggu ini</button></div></div>${scheduled.length ? `<div class="tb-timeline-scroll" tabindex="0" role="region" aria-label="Jadwal task ${esc(heading)}. Geser untuk melihat tanggal lainnya."><table class="tb-timeline-table" style="--days:${days}"><caption class="sr-only">Jadwal task ${esc(heading)}. Klik nama atau bar untuk membuka detail.</caption><colgroup><col class="tb-timeline-name-col"><col span="${days}"></colgroup><thead><tr><th scope="col" class="tb-timeline-label">Task & jadwal</th>${headers}</tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="tb-empty-column">Tidak ada jadwal pada minggu ini. Pilih minggu lain atau tambahkan tanggal di detail task.</p>'}${undated.length ? `<details class="tb-unscheduled"><summary>Belum dijadwalkan · ${undated.length} task</summary><div>${undated.map((task) => `<div class="tb-unscheduled-task">${openButton(task)}${statusLabel(task)}</div>`).join("")}</div></details>` : ""}`;
}
