export function createFeature({ state, actions }) {
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
    actions.$("save-state").textContent = "Draft dipulihkan";
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

  function scheduleDraft() {
    clearTimeout(state.draftTimer);
    actions.$("save-state").textContent = actions.isDirty()
      ? "Draft menunggu disimpan…"
      : "";
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
    if (content === draft.content) return;
    state.draftRequest = actions
      .api("draft", {
        filePath: page.path,
        content,
        revision: page.revision,
        token: draft.token,
      })
      .then((data) => {
        draft.token = data.token;
        draft.content = content;
        if (state.draftState === draft)
          actions.$("save-state").textContent = actions.isDirty()
            ? "Draft tersimpan · belum dipublikasikan"
            : "";
      })
      .catch((error) => {
        if (error.status === 409) {
          draft.conflict = true;
          actions.syncEditorLock();
        }
        actions.$("save-state").textContent = "Draft belum tersimpan";
        actions.notify(error.message);
        throw error;
      })
      .finally(() => {
        state.draftRequest = null;
      });
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
