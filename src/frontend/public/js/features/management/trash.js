export function createFeature({ state, actions }) {
  function restoreTrashed(id) {
    actions.toolAction(
      () => actions.api("trash/restore", { id }),
      () => actions.updateAfterMutation("Item berhasil dipulihkan."),
    );
  }

  function confirmPurge(id) {
    actions.tool(
      "Hapus permanen?",
      '<p>Isi file, riwayat versi, dan draft item ini akan dihapus. Tindakan ini tidak dapat dibatalkan.</p><div class="tool-actions"><button class="small-button" data-action="openTrash" autofocus>Batal</button><button class="small-button destructive" data-action="purgeTrashed" data-arg="' +
        id +
        '">Hapus permanen</button></div>',
    );
  }

  function purgeTrashed(id) {
    actions.toolAction(
      () => actions.api("trash/purge", { id, confirm: true }),
      () => actions.updateAfterMutation("Item dihapus permanen."),
    );
  }
  return { restoreTrashed, confirmPurge, purgeTrashed };
}
