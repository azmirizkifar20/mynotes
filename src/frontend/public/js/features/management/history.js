export function createFeature({ state, actions }) {
  function versionDiff(current, selected) {
    // shortcut: bounded line lookahead groups distant moves as removal/addition; use a diff library if exact move matching is needed.
    const limit = 300000;
    const before = current.slice(0, limit).split("\n");
    const after = selected.slice(0, limit).split("\n");
    const rows = [];
    let left = 0, right = 0, added = 0, removed = 0;
    function row(kind, text) {
      if (kind === "+") added++;
      if (kind === "−") removed++;
      rows.push(`<div class="version-diff-line ${kind === "+" ? "added" : kind === "−" ? "removed" : ""}"><span aria-label="${kind === "+" ? "Ditambahkan" : kind === "−" ? "Dihapus" : "Tetap"}">${kind}</span><code>${actions.escape(text)}</code></div>`);
    }
    while ((left < before.length || right < after.length) && rows.length < 5000) {
      if (left < before.length && right < after.length && before[left] === after[right]) {
        row(" ", before[left++]); right++; continue;
      }
      let skipBefore = -1, skipAfter = -1;
      for (let step = 1; step <= 40; step++) {
        if (left + step < before.length && right < after.length && before[left + step] === after[right]) { skipBefore = step; break; }
        if (right + step < after.length && left < before.length && after[right + step] === before[left]) { skipAfter = step; break; }
      }
      if (skipBefore !== -1) while (skipBefore-- && rows.length < 5000) row("−", before[left++]);
      else if (skipAfter !== -1) while (skipAfter-- && rows.length < 5000) row("+", after[right++]);
      else {
        if (left < before.length) row("−", before[left++]);
        if (right < after.length && rows.length < 5000) row("+", after[right++]);
      }
    }
    const truncated = current.length > limit || selected.length > limit || left < before.length || right < after.length;
    return `<p class="edit-hint">Jika dipulihkan: +${added} baris ditambahkan, −${removed} baris dihapus${truncated ? " pada bagian yang ditampilkan" : ""}. Tanda +/− menunjukkan perubahan dari versi aktif ke versi terpilih.</p>${truncated ? '<p class="edit-hint" role="status">Pratinjau dibatasi 300.000 karakter per versi dan 5.000 baris. Isi lengkap versi terpilih tetap tersedia di bawah.</p>' : ""}<div class="version-diff" role="region" aria-label="Perubahan dari versi aktif ke versi terpilih" tabindex="0">${rows.join("")}</div>`;
  }

  async function openHistory() {
    const page = state.pages.find((page) => page.id === state.current);
    if (page?.type !== "doc" || !actions.canLeave()) return;
    actions.tool("Riwayat versi", '<p role="status">Memuat versi…</p>');
    state.selectedVersion = null;
    state.selectedVersionRevision = null;
    try {
      const data = await actions.api("history", { filePath: page.path });
      actions.tool(
        "Riwayat versi",
        `<p class="edit-hint">${actions.escape(page.title)} · Versi aktif ${data.revision}. Pemulihan membuat versi baru dan mempertahankan pengaturan akses.</p><div class="version-list">${data.items.map((item) => `<button class="small-button" data-action="previewVersion" data-value-type="number" data-arg="${item.revision}">Versi ${item.revision} · ${actions.escape(new Date(item.saved_at).toLocaleString("id-ID"))}</button>`).join("")}</div><div id="version-diff"></div><details><summary>Isi lengkap versi terpilih</summary><label class="field-label" for="version-content">Isi versi terpilih</label><textarea id="version-content" class="editor tool-editor" readonly></textarea></details><p id="version-status" role="status">Pilih versi untuk melihat perubahannya.</p><button class="small-button primary" id="restore-version" data-action="restoreVersion" hidden>Pulihkan versi ini</button>`,
      );
    } catch (error) {
      actions.$("tool-error").textContent = error.message;
    }
  }

  async function previewVersion(version) {
    const page = state.pages.find((page) => page.id === state.current);
    await actions.toolAction(
      async () => {
        const data = await actions.api("history/preview", { filePath: page.path, version });
        if (typeof data.currentContent !== "string") {
          const current = await actions.api("raw", { filePath: page.path });
          data.currentContent = current.content;
        }
        if (typeof data.currentContent !== "string") throw new Error("Versi aktif tidak dapat dimuat untuk perbandingan.");
        return data;
      },
      (data) => {
        state.selectedVersion = version;
        state.selectedVersionRevision = data.currentRevision ?? page.revision;
        actions.$("version-content").value = data.content;
        actions.$("version-diff").innerHTML = versionDiff(data.currentContent, data.content);
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
          revision: state.selectedVersionRevision,
        }),
      () => actions.updateAfterMutation("Versi dipulihkan sebagai versi baru."),
    );
  }
  return { openHistory, previewVersion, restoreVersion };
}
