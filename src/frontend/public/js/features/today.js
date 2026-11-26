export function createFeature({ state, actions }) {
  let today = null;
  let request = 0;
  let todoBusy = false, todoError = "", undo = null, undoTimer, undoExpired = false, pendingCreate = null;
  const esc = actions.escape;
  const dateLabel = (day) => new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta",
  }).format(new Date(day + "T12:00:00Z"));

  function paint() {
    if (!today || state.current !== "today" || !actions.$("today-content")) return;
    actions.$("today-date").textContent = dateLabel(today.day) + " · WIB";
    actions.renderTodayContent(actions.$("today-content"), {
      today: { ...today, todos: today.todos || [] }, busy: todoBusy, error: todoError, undo,
      createTodo, completeTodo, deleteTodo, undoDelete, dismissUndo,
      chooseFocus: openTodayFocus, openTask: (id) => actions.openRelatedTask(id),
      openBoard: () => actions.navigate("tasks"),
    });
    actions.$("today-content").setAttribute("aria-busy", "false");
  }

  function dismissUndo() { clearTimeout(undoTimer); undo = null; undoExpired = false; paint(); }
  async function mutateTodo(endpoint, body) {
    if (state.toolBusy || state.current !== "today" || !today) return false;
    const navigation = state.navigationSequence;
    ++request; todoBusy = true; state.toolBusy = true; todoError = ""; paint();
    try {
      const result = await actions.api("today/todos/" + endpoint, body);
      if (navigation !== state.navigationSequence || state.current !== "today") return false;
      today = { ...today, todos: result.todos };
      if (endpoint === "delete") {
        clearTimeout(undoTimer); undo = result.item; undoExpired = false;
        undoTimer = setTimeout(() => { undoExpired = true; if (!todoBusy) dismissUndo(); }, 12000);
      } else if (endpoint === "restore") dismissUndo();
      return true;
    } catch (error) {
      if (navigation === state.navigationSequence && state.current === "today") {
        todoError = error.message;
        if (error.status === 409) {
          try {
            const result = await actions.api("today");
            if (navigation === state.navigationSequence && state.current === "today") today = result.today;
          } catch (_) { /* Keep the existing list when conflict refresh fails. */ }
        }
      }
      return false;
    } finally {
      todoBusy = false; state.toolBusy = false;
      if (undoExpired) dismissUndo(); else paint();
    }
  }
  async function createTodo(text) {
    if (!pendingCreate || pendingCreate.text !== text) pendingCreate = { id: crypto.randomUUID(), text };
    const saved = await mutateTodo("create", pendingCreate);
    if (saved) pendingCreate = null;
    return saved;
  }
  const completeTodo = (todo, done) => mutateTodo("complete", { id: todo.id, revision: todo.revision, done });
  const deleteTodo = (todo) => mutateTodo("delete", { id: todo.id, revision: todo.revision });
  const undoDelete = () => undo ? mutateTodo("restore", undo) : Promise.resolve(false);

  async function refreshToday() {
    if (state.current !== "today" || todoBusy || state.toolBusy) return;
    const sequence = ++request;
    const navigation = state.navigationSequence;
    try {
      const result = await actions.api("today");
      if (sequence !== request || state.current !== "today" || navigation !== state.navigationSequence || todoBusy) return;
      today = result.today;
      actions.$("today-error").textContent = "";
      paint();
    } catch (error) {
      if (sequence === request && state.current === "today" && navigation === state.navigationSequence) {
        actions.$("today-error").textContent = error.message;
        actions.$("today-content").setAttribute("aria-busy", "false");
        if (!today) actions.$("today-content").innerHTML = '<button class="small-button" data-action="refreshToday">Coba lagi</button>';
      }
    }
  }

  function renderToday() {
    today = null; todoError = "";
    actions.destroyTodayView();
    actions.trackOutline([]);
    actions.$("main").innerHTML = `<section class="today-page"><header class="workspace-heading today-page-heading"><div><p class="today-eyebrow" id="today-date">Hari ini · WIB</p><h1>Hari ini</h1><p class="lead">Mulai dari yang penting. Satu langkah setiap kali.</p></div><div class="heading-actions"><button class="small-button" data-action="navigate" data-arg="tasks">Task board</button><button class="small-button primary" data-action="focusTodayTodo">${actions.icon("plus")}Tambah to-do</button></div></header><p class="delete-error" id="today-error" role="alert"></p><div id="today-content" aria-busy="true"><p role="status">Memuat pekerjaan hari ini…</p></div></section>`;
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
    focusTodayTodo: () => { actions.$("today-todo-input")?.scrollIntoView({ block: "center" }); actions.$("today-todo-input")?.focus(); },
    createTodayTask: () => actions.openBoardTaskFromDocument({}) };
}
