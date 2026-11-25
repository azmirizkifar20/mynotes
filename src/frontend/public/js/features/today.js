export function createFeature({ state, actions }) {
  let today = null;
  let request = 0;
  const esc = actions.escape;
  const dateLabel = (day) => new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta",
  }).format(new Date(day + "T12:00:00Z"));

  function taskRows(tasks, empty) {
    return tasks.length ? `<ul class="today-task-list">${tasks.map((task) => {
      const status = today.statuses.find((item) => item.id === task.statusId);
      return `<li><button type="button" class="today-task-open" data-action="openRelatedTask" data-arg="${esc(task.id)}"><span class="today-task-code">T-${String(task.number).padStart(3, "0")}</span><span class="today-task-title">${esc(task.title)}<small>${esc(status?.name || "")}${task.priority === "high" ? " · Prioritas tinggi" : ""}</small></span>${task.due ? `<time class="today-deadline ${task.due < today.day ? "is-overdue" : ""}" datetime="${esc(task.due)}">${esc(dateLabel(task.due))}</time>` : ""}${actions.icon("chevron")}</button></li>`;
    }).join("")}</ul>` : `<p class="today-empty">${esc(empty)}</p>`;
  }

  function paint() {
    if (!today || state.current !== "today" || !actions.$("today-content")) return;
    const focus = today.focusIds.map((id) => today.tasks.find((task) => task.id === id)).filter(Boolean);
    const sorted = [...today.tasks].sort((a, b) =>
      (a.due || "9999").localeCompare(b.due || "9999") ||
      Number(b.priority === "high") - Number(a.priority === "high") || a.number - b.number);
    const groups = [
      ["Lewat Deadline", sorted.filter((task) => task.due && task.due < today.day), "Tidak ada task yang terlambat.", "overdue"],
      ["Hari ini", sorted.filter((task) => task.due === today.day), "Tidak ada Deadline hari ini.", "due"],
      ["Sedang dikerjakan", sorted.filter((task) => today.statuses.find((item) => item.id === task.statusId)?.inProgress), "Belum ada task pada status pengerjaan. Atur penanda Dikerjakan lewat Kelola status di task board.", "progress"],
    ];
    actions.$("today-date").textContent = dateLabel(today.day) + " · WIB";
    actions.$("today-content").innerHTML = `<section class="today-focus" aria-labelledby="today-focus-heading"><header><div><span class="today-eyebrow">Tentukan yang utama</span><h2 id="today-focus-heading">Fokus hari ini <span>${focus.length}/3</span></h2></div><button class="small-button" data-action="openTodayFocus">${actions.icon("star")}Pilih fokus</button></header>${taskRows(focus, "Pilih hingga 3 task untuk difokuskan hari ini. Deadline task tetap sama.")}</section><div class="today-groups">${groups.map(([name, tasks, empty, key]) => `<section class="today-group" data-today-group="${key}"><header><h2>${name}</h2><span class="today-count">${tasks.length}</span></header>${taskRows(tasks, empty)}</section>`).join("")}</div>`;
    actions.$("today-content").setAttribute("aria-busy", "false");
  }

  async function refreshToday() {
    if (state.current !== "today") return;
    const sequence = ++request;
    try {
      const result = await actions.api("today");
      if (sequence !== request || state.current !== "today") return;
      today = result.today;
      actions.$("today-error").textContent = "";
      paint();
    } catch (error) {
      if (sequence === request && state.current === "today") {
        actions.$("today-error").textContent = error.message;
        actions.$("today-content").setAttribute("aria-busy", "false");
        if (!today) actions.$("today-content").innerHTML = '<button class="small-button" data-action="refreshToday">Coba lagi</button>';
      }
    }
  }

  function renderToday() {
    today = null;
    actions.trackOutline([]);
    actions.$("main").innerHTML = `<header class="workspace-heading"><div><p class="today-eyebrow" id="today-date">Hari ini · WIB</p><h1>Hari ini</h1><p class="lead">Mulai dari yang penting. Satu langkah setiap kali.</p></div><div class="heading-actions"><button class="small-button" data-action="navigate" data-arg="tasks">Task board</button><button class="small-button primary" data-action="createTodayTask">${actions.icon("plus")}Task baru</button></div></header><p class="delete-error" id="today-error" role="alert"></p><div id="today-content" aria-busy="true"><p role="status">Memuat pekerjaan hari ini…</p></div>`;
    return refreshToday();
  }

  async function openTodayFocus() {
    if (state.toolBusy || state.current !== "today") return;
    const navigation = state.navigationSequence;
    try {
      const result = await actions.api("today");
      if (state.current !== "today" || navigation !== state.navigationSequence || state.toolBusy) return;
      today = result.today;
      paint();
      actions.tool("Pilih fokus hari ini", `<form data-submit="saveTodayFocus" class="today-focus-picker"><p class="edit-hint">Maksimal 3 task · ${esc(dateLabel(today.day))} WIB. Pilihan tersinkron antarperangkat dan dimulai lagi setiap hari.</p><label class="field-label" for="today-focus-search">Cari task</label><input class="text-input" id="today-focus-search" type="search" placeholder="Cari judul task…" autocomplete="off"><p id="today-focus-count" role="status"></p><div class="today-focus-options">${today.tasks.map((task) => `<label class="today-focus-option"><input type="checkbox" name="focus" value="${esc(task.id)}" ${today.focusIds.includes(task.id) ? "checked" : ""}><span>${esc(task.title)}<small>T-${String(task.number).padStart(3, "0")}${task.due ? " · Deadline " + esc(dateLabel(task.due)) : ""}</small></span></label>`).join("") || '<p class="today-empty">Belum ada task aktif.</p>'}</div><p class="edit-hint" id="today-focus-no-match" hidden>Tidak ada task yang cocok.</p><div class="tool-actions"><button type="button" class="small-button" data-action="closeDialog" data-arg="tool-dialog">Batal</button><button type="button" class="small-button" data-action="openTodayFocus">Muat ulang pilihan</button><button class="small-button primary" type="submit">Simpan fokus</button></div></form>`);
      const form = actions.$("tool-body").querySelector("form");
      form.dataset.focusDay = today.day;
      form.dataset.focusToken = today.token || "";
      const update = () => {
        const inputs = [...form.querySelectorAll('input[name="focus"]')];
        const count = inputs.filter((input) => input.checked).length;
        actions.$("today-focus-count").textContent = `${count}/3 task dipilih`;
        for (const input of inputs) input.disabled = !input.checked && count >= 3;
      };
      form.addEventListener("change", update);
      actions.$("today-focus-search").addEventListener("input", (event) => {
        const query = event.target.value.trim().toLocaleLowerCase();
        let count = 0;
        for (const label of form.querySelectorAll(".today-focus-option")) {
          label.hidden = !label.textContent.toLocaleLowerCase().includes(query);
          if (!label.hidden) count++;
        }
        actions.$("today-focus-no-match").hidden = count > 0;
      });
      update();
      actions.$("today-focus-search").focus();
    } catch (error) {
      actions.notify(error.message);
    }
  }

  async function saveTodayFocus(event) {
    event.preventDefault();
    const ids = [...event.target.querySelectorAll('input[name="focus"]:checked')].map((input) => input.value);
    if (ids.length > 3) {
      actions.$("tool-error").textContent = "Pilih maksimal 3 task.";
      return;
    }
    const body = { day: event.target.dataset.focusDay, token: event.target.dataset.focusToken || null, ids };
    await actions.toolAction(() => actions.api("today", body), (result) => {
      today = result.today;
      actions.$("tool-dialog").close();
      paint();
      actions.notify("Fokus hari ini disimpan.");
    });
    event.target.dispatchEvent(new Event("change"));
  }
  return { renderToday, refreshToday, openTodayFocus, saveTodayFocus,
    createTodayTask: () => actions.openBoardTaskFromDocument({}) };
}
