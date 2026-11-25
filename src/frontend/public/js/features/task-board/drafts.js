export function createFeature({ state, actions, getBody, applyBody, getKey, getRevision, onChanged }) {
  const { $ } = actions;
  const drafts = new Map();
  let active = null, timer = null, queue = Promise.resolve(), loaded = false, loadSequence = 0;

  function serialize(work) {
    const next = queue.then(work);
    queue = next.catch(() => {});
    return next;
  }
  function status(message, session = active) {
    if (session !== active) return;
    const element = $("board-draft-status");
    actions.animateStatus(element, message);
  }
  function stopTimer() { clearTimeout(timer); timer = null; }
  function snapshot(session) { return { ...structuredClone(getBody()), revision: session.revision }; }
  function renderRecovery() {
    const element = $("board-draft-recovery"), saved = active && drafts.get(active.key);
    if (!element) return;
    const visible = active && !active.archived && !active.selected && (saved || active.conflict);
    element.hidden = !visible;
    element.innerHTML = visible ? `<p>${saved ? "Ada draft task yang belum diterapkan ke papan. Pulihkan untuk melanjutkan, atau buang draft." : "Draft bersama sudah tidak tersedia. Isi form tetap ada dan dapat digunakan untuk melanjutkan."}</p><div class="dialog-actions">${saved ? `<button type="button" data-action="recoverBoardTaskDraft" ${state.toolBusy ? "disabled" : ""}>Pulihkan draft</button>` : ""}<button type="button" data-action="discardBoardTaskDraft" ${state.toolBusy ? "disabled" : ""}>${saved ? "Buang draft" : "Lanjutkan dengan isi form"}</button></div>` : "";
  }
  async function loadPreferences() {
    const sequence = ++loadSequence;
    return serialize(async () => {
      const result = await actions.api("task-board/preferences");
      if (sequence !== loadSequence) return result;
      const selected = active?.selected && drafts.get(active.key);
      drafts.clear();
      for (const draft of result.drafts || []) drafts.set(draft.key, draft);
      loaded = true;
      if (selected && drafts.get(active.key)?.token !== selected.token) {
        active.conflict = true; active.selected = false;
        status("Draft berubah di sesi lain. Isi form tetap ada. Pulihkan atau buang draft bersama sebelum melanjutkan.");
      }
      if (active && !active.selected) {
        active.blocked = active.conflict || drafts.has(active.key);
        renderRecovery();
      }
      return result;
    });
  }
  function open(taskArchived = false) {
    stopTimer();
    const session = { key: getKey() || "new", revision: getRevision(), archived: taskArchived, selected: false, blocked: true, conflict: false, pending: null, savedBody: null };
    active = session;
    status(taskArchived ? "" : "Memeriksa draft…");
    renderRecovery();
    session.ready = queue.then(() => {
      if (session !== active) return;
      session.blocked = !loaded || drafts.has(session.key);
      renderRecovery();
      status(taskArchived ? "Hanya baca" : !loaded ? "Draft belum dapat diperiksa. Muat ulang papan sebelum menyimpan." : session.blocked ? "Pilih Pulihkan atau Buang draft sebelum menyimpan perubahan baru." : "Belum ada perubahan", session);
      if (session.pending && !session.blocked) schedule();
    });
    return session.ready;
  }
  function schedule() {
    stopTimer();
    timer = setTimeout(() => { timer = null; flush().catch(() => {}); }, 800);
  }
  function changed() {
    const session = active;
    if (!session || session.archived || session.key !== (getKey() || "new")) return;
    session.pending = snapshot(session);
    if (JSON.stringify(session.pending) === session.savedBody) session.pending = null;
    if (session.blocked || session.conflict) return;
    status("Perubahan menunggu penyimpanan draft.", session);
    schedule();
  }
  async function conflict(session) {
    session.conflict = true; session.blocked = true; session.selected = false;
    try {
      const result = await actions.api("task-board/preferences");
      const current = (result.drafts || []).find((draft) => draft.key === session.key);
      if (current) drafts.set(session.key, current);
      else drafts.delete(session.key);
    } catch { /* Keep the known token until the shared draft can be read again. */ }
    if (session === active) renderRecovery();
    status("Draft berubah di sesi lain. Isi form tetap ada. Pulihkan atau buang draft bersama sebelum melanjutkan; muat ulang papan jika draft sudah tidak tersedia.", session);
  }
  async function flush(keepalive = false) {
    stopTimer();
    const session = active;
    if (!session || session.archived) return;
    await session.ready;
    return serialize(async () => {
      if (session !== active || session.key !== (getKey() || "new")) return;
      if (session.blocked || session.conflict) {
        throw new Error(session.conflict ? "Draft berubah di sesi lain. Pulihkan atau buang draft sebelum menyimpan." : "Periksa, pulihkan, atau buang draft yang ada sebelum menyimpan.");
      }
      const body = session.pending;
      if (!body) return;
      status("Menyimpan draft…", session);
      try {
        const token = session.selected ? drafts.get(session.key)?.token || null : null;
        const payload = { key: session.key, body, token };
        // Browser keepalive requests share a 64 KiB quota; large drafts use the ordinary save path.
        const result = await actions.api("task-board/drafts/save", payload, keepalive && new Blob([JSON.stringify(payload)]).size < 60000);
        drafts.set(session.key, result.draft);
        session.selected = true; session.savedBody = JSON.stringify(body);
        if (session.pending === body) session.pending = null;
        if (session === active) renderRecovery();
        status(session.pending ? "Ada perubahan baru yang belum tersimpan ke draft." : "Draft tersimpan. Tekan Simpan untuk menerapkannya ke papan.", session);
      } catch (error) {
        if (error.status === 409) await conflict(session);
        else status(`Draft belum tersimpan: ${error.message} Isi form tetap ada.`, session);
        throw error;
      }
    });
  }
  function recover() {
    const session = active, saved = session && drafts.get(session.key);
    if (!saved || session.archived || state.toolBusy || session.selected) return;
    stopTimer();
    const stale = saved.body.revision !== getRevision();
    session.revision = saved.body.revision;
    session.selected = true; session.blocked = false; session.conflict = false;
    applyBody(structuredClone(saved.body));
    session.pending = null; session.savedBody = JSON.stringify(saved.body);
    onChanged(stale);
    renderRecovery();
    status(stale ? "Draft dipulihkan dari revisi lama. Muat ulang papan dan periksa perubahan sebelum menyimpan; isi form tetap dipertahankan." : "Draft dipulihkan ke form. Tekan Simpan untuk menerapkannya ke papan.", session);
  }
  async function discard() {
    stopTimer();
    const session = active;
    if (!session || session.archived || state.toolBusy) return;
    await session.ready;
    return serialize(async () => {
      if (session !== active) return;
      if (!loaded) throw new Error("Draft belum dapat diperiksa. Muat ulang papan sebelum membuang draft.");
      const saved = drafts.get(session.key);
      try {
        if (saved) await actions.api("task-board/drafts/discard", { key: session.key, token: saved.token });
        if (drafts.get(session.key)?.token === saved?.token) drafts.delete(session.key);
        if (session !== active) return;
        session.selected = false; session.blocked = false; session.conflict = false;
        session.pending = state.taskBoardDirty ? snapshot(session) : null; session.savedBody = null;
        renderRecovery();
        status(session.pending ? "Draft bersama dibuang. Perubahan pada form akan disimpan sebagai draft baru." : "Draft dibuang. Isi form tetap ada; perubahan berikutnya akan membuat draft baru.", session);
        if (session.pending) schedule();
      } catch (error) {
        if (error.status === 409) await conflict(session);
        else status(`Draft belum dibuang: ${error.message}`, session);
        throw error;
      }
    });
  }
  function rebase() {
    const session = active;
    if (!session || session.archived || session.key !== (getKey() || "new")) return;
    stopTimer();
    session.revision = getRevision();
    if (state.taskBoardDirty) {
      session.pending = snapshot(session);
      if (!session.blocked && !session.conflict) schedule();
    }
  }
  function draftFields() {
    const saved = active?.selected && drafts.get(active.key);
    return saved && !active.conflict && active.key === (getKey() || "new") ? { draftKey: saved.key, draftToken: saved.token } : {};
  }
  function published(fields = draftFields()) {
    if (fields.draftKey && drafts.get(fields.draftKey)?.token === fields.draftToken) drafts.delete(fields.draftKey);
    if (active && (!fields.draftKey || active.key === fields.draftKey)) {
      stopTimer(); active = null; renderRecovery(); status("");
    }
  }
  function bind() {
    $("board-task-dialog").addEventListener("close", () => { flush().catch(() => {}); });
    window.addEventListener("pagehide", () => { flush(true).catch(() => {}); });
  }
  return { loadPreferences, open, changed, flush, discard, rebase, published, renderRecovery, recover, bind, draftFields };
}
