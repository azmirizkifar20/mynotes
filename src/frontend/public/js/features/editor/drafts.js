export function createFeature({ state, actions }) {
  let lastSaveError = null;
  async function loadDraft(page) {
    clearTimeout(state.draftTimer);
    const sequence = state.navigationSequence;
    const data = await actions.api("draft/read", { filePath: page.path });
    if (state.current !== page.id || sequence !== state.navigationSequence)
      return;
    state.draftState = {
      id: page.id,
      token: data.draft?.token || null,
      content: data.draft?.content ?? page.body,
      conflict: false,
      resolved: !data.draft || data.draft.content === page.body,
    };
    if (data.draft && data.draft.content !== page.body) {
      const stale = data.draft.base_revision !== page.revision;
      actions.tool(
        "Draft belum disimpan",
        `<p>${stale ? "Dokumen sudah berubah sejak draft ini dibuat. Salin atau unduh draft sebelum menggabungkannya dengan versi terbaru." : "Ada draft dari sesi sebelumnya. Pulihkan untuk melanjutkan tulisan."}</p><textarea class="editor tool-editor" id="recovery-content" readonly>${actions.escape(data.draft.content)}</textarea><div class="tool-actions"><button class="small-button" data-action="copyDraft">Salin draft</button><button class="small-button" data-action="downloadDraft">Unduh draft</button><button class="small-button danger" data-action="discardDraft">Buang draft</button>${stale ? "" : '<button class="small-button primary" data-action="recoverDraft">Lanjutkan draft</button>'}</div>`,
      );
    }
    actions.syncEditorLock();
    showSaveState(state.draftState.resolved ? "Semua perubahan tersimpan" : "Periksa draft sebelum mengedit");
  }

  function recoverDraft() {
    const page = state.pages.find((page) => page.id === state.current);
    if (!page || state.draftState?.id !== page.id) return;
    const content = state.draftState.content;
    state.draftState.resolved = true;
    state.documentBuffer = { id: page.id, content };
    actions.$("tool-dialog").close();
    actions.renderDoc(page);
    if (state.editing) actions.$("markdown-editor").focus();
    scheduleDraft();
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(actions.$("recovery-content").value);
      actions.notify("Draft disalin.");
    } catch {
      actions.$("recovery-content").focus();
      actions.$("recovery-content").select();
      actions.notify("Gunakan Ctrl+C untuk menyalin draft.");
    }
  }

  function downloadDraft() {
    const url = URL.createObjectURL(
      new Blob([actions.$("recovery-content").value], {
        type: "text/markdown;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "draft.md";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function discardDraft() {
    const page = state.pages.find((page) => page.id === state.current),
      token = state.draftState?.token;
    actions.toolAction(
      () => actions.api("draft/discard", { filePath: page.path, token }),
      () => {
        state.draftState = {
          id: page.id,
          token: null,
          content: page.body,
          conflict: false,
          resolved: true,
        };
        state.documentBuffer = { id: page.id, content: page.body };
        actions.$("tool-dialog").close();
        actions.renderDoc(page);
      },
    );
  }

  function showSaveState(message) {
    for (const id of ["save-state", "document-save-state"]) {
      const element = actions.$(id);
      actions.animateStatus(element, message);
    }
  }

  function scheduleDraft() {
    clearTimeout(state.draftTimer);
    showSaveState(
      state.draftRequest ? "Menyimpan…" : actions.isDirty()
        ? "Menunggu disimpan…"
        : "Semua perubahan tersimpan",
    );
    state.draftTimer = setTimeout(() => flushDraft().catch(() => {}), 1000);
  }

  async function flushDraft() {
    clearTimeout(state.draftTimer);
    if (state.draftRequest) {
      await state.draftRequest;
      return flushDraft();
    }
    const page = state.pages.find((page) => page.id === state.current);
    if (
      state.documentBuffer?.id !== state.current ||
      !page ||
      (!actions.isDirty() && !state.draftState?.token)
    )
      return;
    if (
      state.draftState?.id !== page.id ||
      state.draftState.conflict ||
      !state.draftState.resolved
    )
      throw new Error("Periksa draft atau versi dokumen sebelum melanjutkan.");
    const draft = state.draftState,
      content = actions.documentContent();
    showSaveState("Menyimpan…");
    state.draftRequest = (async () => {
      if (content !== draft.content) {
        const data = await actions.api("draft", {
          filePath: page.path,
          content,
          revision: page.revision,
          token: draft.token,
        });
        draft.token = data.token;
        draft.content = content;
      }
      const data = await actions.api("save", {
        filePath: page.path,
        content,
        revision: page.revision,
        draftToken: draft.token || undefined,
      });
      page.body = content;
      actions.refreshDocumentRelations?.(page);
      page.html = data.html;
      page.modified = data.modified;
      page.revision = data.revision;
      draft.token = null;
      lastSaveError = null;
      const revision = actions.$("document-revision");
      const modified = actions.$("document-modified");
      if (revision) revision.textContent = `${page.title}.md · Versi ${page.revision}`;
      if (modified) modified.textContent = actions.dateLabel(page.modified);
      showSaveState(actions.isDirty() ? "Menunggu disimpan…" : "Semua perubahan tersimpan");
      if (actions.isDirty()) scheduleDraft();
    })()
      .catch((error) => {
        if (error.status === 409) {
          draft.conflict = true;
          actions.syncEditorLock();
        }
        clearTimeout(state.draftTimer);
        showSaveState(
          error.status === 409
            ? "Konflik perubahan · salin tulisan sebelum memuat ulang"
            : "Belum tersimpan · tulisan tetap ada di editor",
        );
        if (!error.status || error.status >= 500)
          state.draftTimer = setTimeout(() => flushDraft().catch(() => {}), 5000);
        if (lastSaveError !== error.message) actions.notify(error.message);
        lastSaveError = error.message;
        throw error;
      })
      .finally(() => {
        state.draftRequest = null;
        actions.syncDocumentSave();
      });
    actions.syncDocumentSave();
    await state.draftRequest;
  }
  return {
    loadDraft,
    recoverDraft,
    copyDraft,
    downloadDraft,
    discardDraft,
    scheduleDraft,
    flushDraft,
  };
}
