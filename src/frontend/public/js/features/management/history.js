export function createFeature({ state, actions }) {
  async function openHistory() {
    const page = state.pages.find((page) => page.id === state.current);
    if (page?.type !== "doc" || !actions.canLeave()) return;
    actions.tool("Riwayat versi", '<p role="status">Memuat versi…</p>');
    state.selectedVersion = null;
    try {
      const data = await actions.api("history", { filePath: page.path });
      actions.tool(
        "Riwayat versi",
        `<p class="edit-hint">${actions.escape(page.title)} · Versi aktif ${data.revision}. Pemulihan membuat versi baru dan mempertahankan pengaturan akses.</p><div class="version-list">${data.items.map((item) => `<button class="small-button" data-action="previewVersion" data-value-type="number" data-arg="${item.revision}">Versi ${item.revision} · ${actions.escape(new Date(item.saved_at).toLocaleString("id-ID"))}</button>`).join("")}</div><label class="field-label" for="version-content">Isi versi terpilih</label><textarea id="version-content" class="editor tool-editor" readonly></textarea><p id="version-status" role="status">Pilih versi untuk melihat isinya.</p><button class="small-button primary" id="restore-version" data-action="restoreVersion" hidden>Pulihkan versi ini</button>`,
      );
    } catch (error) {
      actions.$("tool-error").textContent = error.message;
    }
  }

  async function previewVersion(version) {
    const page = state.pages.find((page) => page.id === state.current);
    await actions.toolAction(
      () => actions.api("history/preview", { filePath: page.path, version }),
      (data) => {
        state.selectedVersion = version;
        actions.$("version-content").value = data.content;
        actions.$("version-status").textContent =
          "Versi " +
          version +
          " · " +
          new Date(data.savedAt).toLocaleString("id-ID");
        actions.$("restore-version").hidden = version === page.revision;
      },
    );
  }

  function restoreVersion() {
    const page = state.pages.find((page) => page.id === state.current);
    if (!state.selectedVersion || !page) return;
    actions.toolAction(
      () =>
        actions.api("history/restore", {
          filePath: page.path,
          version: state.selectedVersion,
          revision: page.revision,
        }),
      () => actions.updateAfterMutation("Versi dipulihkan sebagai versi baru."),
    );
  }
  return { openHistory, previewVersion, restoreVersion };
}
