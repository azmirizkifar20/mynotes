export function createFeature({ state, actions }) {
  let credentials = [];
  function openPasskeys() {
    return actions.navigate("passkeys");
  }
  function reauthenticate() {
    actions.$("auth-dialog").showModal();
  }
  async function renderPasskeys() {
    const sequence = state.navigationSequence;
    actions.$("outline").innerHTML = "";
    actions.$("main").innerHTML =
      `<div class="security-page"><header class="management-heading"><h1>Keamanan</h1><p class="lead">Kelola passkey dan perangkat yang dapat mengakses workspace.</p></header><div id="passkey-content" aria-busy="true"><p class="security-loading" role="status">Memuat passkey…</p></div><p id="security-error" class="form-error" role="alert"></p></div>`;
    try {
      const data = await actions.api("passkeys");
      if (state.current !== "passkeys" || sequence !== state.navigationSequence)
        return;
      const canonical = location.origin + state.basePath === data.authURL;
      credentials = data.items;
      const devices = data.items.map(key => `<article class="passkey-device"><div class="passkey-device-heading"><strong>${actions.escape(key.name)}</strong>${key.current ? '<span class="passkey-current">Sesi ini</span>' : ''}</div><div class="passkey-meta"><span>Dibuat ${actions.escape(actions.dateLabel(key.created_at))}</span>${key.last_used_at ? `<span>Terakhir dipakai ${actions.escape(actions.dateLabel(key.last_used_at))}</span>` : ''}${key.backed_up ? '<span>Dicadangkan oleh penyedia passkey</span>' : ''}</div><div class="tool-actions"><button class="small-button" data-action="editPasskeyName" data-arg="${actions.escape(key.id)}">Ganti nama</button><button class="small-button danger" data-action="confirmRevokePasskey" data-arg="${actions.escape(key.id)}" aria-label="Cabut passkey ${actions.escape(key.name)}">Cabut</button></div></article>`).join('') || '<p class="security-hint">Belum ada passkey terdaftar.</p>';
      actions.$("passkey-content").innerHTML =
        `<div class="security-grid"><div><section class="security-panel"><h2>Passkey workspace</h2><p>Satu passkey untuk kedua alamat workspace.</p><div class="security-verification"><div><strong>Verifikasi untuk mengubah passkey</strong><p>Penambahan, perubahan nama, dan pencabutan memerlukan verifikasi dalam 5 menit terakhir.</p></div></div><button type="button" class="small-button" data-action="reauthenticate">${actions.icon("lock")}Verifikasi ulang</button><div class="passkey-list">${devices}</div></section><section class="security-panel security-section" aria-labelledby="add-passkey-title"><div class="security-section-heading"><h2 id="add-passkey-title">Tambahkan perangkat</h2><p>Daftarkan perangkat cadangan sebelum mencabut passkey lama.</p></div><div>` +
        (canonical
          ? '<form data-submit="addPasskey" class="passkey-add"><label class="field-label" for="new-passkey-name">Nama perangkat</label><div class="passkey-controls"><input id="new-passkey-name" class="text-input" name="name" required maxlength="80" placeholder="Misalnya: HP pribadi" autocomplete="off" aria-describedby="passkey-add-hint"><button class="small-button primary" type="submit">Tambah passkey</button></div><p id="passkey-add-hint" class="security-hint">Untuk HP, pilih perangkat lain pada dialog browser, lalu scan kode QR.</p></form>'
          : '<p class="security-hint">Penambahan passkey dilakukan di pusat login.</p><a class="small-button primary" href="' +
            actions.escape(data.authURL + "/?view=passkeys") +
            '" target="_blank" rel="noopener">Tambah di pusat login ↗</a>') +
        `</div></section></div><aside class="security-panel security-aside"><div><h3>Login terpusat</h3><p>Passkey terdaftar pada <strong>itsazmi.com</strong>. Login dari domain lama diteruskan lalu kembali ke alamat awal.</p><h3>Durasi sesi</h3><p>Sesi berakhir saat berganti hari, pukul 00.00 WIB. Setelah itu masuk lagi menggunakan passkey.</p></div><div><h3>Perangkat lain</h3><p>Gunakan passkey tersinkron atau pilihan perangkat lain pada browser, lalu tambah passkey setelah masuk.</p><footer class="security-recovery"><h3>Pemulihan</h3><p>Jika seluruh perangkat hilang, jalankan pemulihan dari terminal server sesuai README.</p></footer></div></aside></div>`;
      actions.$("passkey-content").setAttribute("aria-busy", "false");
    } catch (error) {
      if (state.current !== "passkeys" || sequence !== state.navigationSequence)
        return;
      actions.$("passkey-content").innerHTML =
        '<p class="security-hint">Daftar passkey belum dapat dimuat.</p><button class="small-button" data-action="openPasskeys">Coba lagi</button>';
      actions.$("passkey-content").setAttribute("aria-busy", "false");
      actions.$("security-error").textContent = error.message;
    }
  }
  async function mutate(form, operation) {
    if (state.saving || state.authBusy) return;
    actions.setBusy(true);
    const buttons = [...form.querySelectorAll("button,input")];
    buttons.forEach((button) => {
      button.disabled = true;
    });
    actions.$("security-error").textContent = "";
    try {
      await operation();
      await renderPasskeys();
    } catch (error) {
      actions.$("security-error").textContent = error.message;
    } finally {
      actions.setBusy(false);
      buttons.forEach((button) => {
        button.disabled = false;
      });
    }
  }
  async function addPasskey(event) {
    event.preventDefault();
    const form = event.target,
      name = form.querySelector("[name=name]").value;
    return mutate(form, () => actions.registerPasskey(name));
  }
  async function renamePasskey(event, id) {
    event.preventDefault();
    const form = event.target,
      name = form.querySelector("[name=name]").value;
    return actions.toolAction(async () => {
      await actions.api("passkeys/rename", { id, name });
    }, async () => {
      actions.$("tool-dialog").close();
      await renderPasskeys();
    });
  }
  function editPasskeyName(id) {
    const key = credentials.find(key => key.id === id);
    if (!key) return;
    actions.tool("Ganti nama passkey", `<form data-submit="renamePasskey" data-arg="${actions.escape(id)}"><label class="field-label" for="passkey-name">Nama perangkat</label><input id="passkey-name" class="text-input" name="name" value="${actions.escape(key.name)}" required maxlength="80" autocomplete="off"><div class="tool-actions"><button class="small-button" type="button" data-action="closeDialog" data-arg="tool-dialog">Batal</button><button class="small-button primary" type="submit">Simpan nama</button></div></form>`);
  }
  function confirmRevokePasskey(id) {
    actions.tool(
      "Cabut passkey?",
      '<p>Perangkat dengan passkey ini tidak dapat masuk lagi. Sesi yang memakainya juga akan berakhir. Passkey terakhir tidak dapat dicabut.</p><div class="tool-actions"><button class="small-button" data-action="closeDialog" data-arg="tool-dialog">Batal</button><button class="small-button danger" data-action="revokePasskey" data-arg="' +
        actions.escape(id) +
        '">Cabut passkey</button></div>',
    );
  }
  function revokePasskey(id) {
    return actions.toolAction(
      () => actions.api("passkeys/delete", { id, confirm: true }),
      async (data) => {
        actions.$("tool-dialog").close();
        if (data.loggedOut) location.reload();
        else await renderPasskeys();
      },
    );
  }
  return {
    openPasskeys,
    reauthenticate,
    renderPasskeys,
    addPasskey,
    renamePasskey,
    editPasskeyName,
    confirmRevokePasskey,
    revokePasskey,
  };
}
