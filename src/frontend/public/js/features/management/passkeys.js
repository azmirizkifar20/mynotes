export function createFeature({ state, actions }) {
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
      `<div class="security-page"><header class="security-heading"><div class="page-icon">${actions.icon("lock")}</div><div><p class="page-kicker">Pengelolaan</p><h1>Keamanan</h1></div></header><p class="lead">Kelola passkey untuk masuk ke workspace dari kedua alamat.</p><div id="passkey-content" aria-busy="true"><p class="security-loading" role="status">Memuat passkey…</p></div><p id="security-error" class="form-error" role="alert"></p></div>`;
    try {
      const data = await actions.api("passkeys");
      if (state.current !== "passkeys" || sequence !== state.navigationSequence)
        return;
      const canonical = location.origin + state.basePath === data.authURL;
      actions.$("passkey-content").innerHTML =
        `<div class="security-verification"><div><strong>Verifikasi sebelum mengubah</strong><p>Perubahan passkey memerlukan verifikasi dalam 5 menit terakhir.</p></div><button type="button" class="small-button" data-action="reauthenticate">${actions.icon("lock")}Verifikasi ulang</button></div><section class="security-section" aria-labelledby="add-passkey-title"><div class="security-section-heading"><h2 id="add-passkey-title">Tambah passkey</h2><p>Siapkan akses dari HP atau perangkat cadangan.</p></div><div>` +
        (canonical
          ? '<form data-submit="addPasskey" class="passkey-add"><label class="field-label" for="new-passkey-name">Nama perangkat</label><div class="passkey-controls"><input id="new-passkey-name" class="text-input" name="name" required maxlength="80" placeholder="Misalnya: HP pribadi" autocomplete="off" aria-describedby="passkey-add-hint"><button class="small-button primary" type="submit">Tambah passkey</button></div><p id="passkey-add-hint" class="security-hint">Untuk HP, pilih perangkat lain pada dialog browser, lalu scan kode QR.</p></form>'
          : '<p class="security-hint">Penambahan passkey dilakukan di pusat login.</p><a class="small-button primary" href="' +
            actions.escape(data.authURL + "/?view=passkeys") +
            '" target="_blank" rel="noopener">Tambah di pusat login ↗</a>') +
        `</div></section><section class="security-section" aria-labelledby="registered-passkeys-title"><div class="security-section-heading"><h2 id="registered-passkeys-title">Perangkat terdaftar <span class="passkey-count">${data.items.length}</span></h2><p>Ubah nama agar mudah dikenali. Cabut passkey yang tidak dipakai lagi.</p></div><div class="passkey-list">` +
        (data.items.map((key, index) => {
          const id = actions.escape(key.id);
          return `<article class="passkey-device"><div class="passkey-device-heading"><label class="field-label" for="passkey-name-${index}">Nama perangkat</label>${key.current ? '<span class="passkey-current">Sesi ini</span>' : ''}</div><form data-submit="renamePasskey" data-arg="${id}"><div class="passkey-controls"><input id="passkey-name-${index}" class="text-input" name="name" required maxlength="80" value="${actions.escape(key.name)}" autocomplete="off"><div class="passkey-row-actions"><button class="small-button" type="submit">Simpan nama</button><button type="button" class="small-button danger" data-action="confirmRevokePasskey" data-arg="${id}" aria-label="Cabut passkey ${actions.escape(key.name)}">Cabut</button></div></div></form><div class="passkey-meta"><span>Dibuat ${actions.escape(actions.dateLabel(key.created_at))}</span>${key.last_used_at ? `<span>Terakhir dipakai ${actions.escape(actions.dateLabel(key.last_used_at))}</span>` : ''}${key.backed_up ? '<span>Dicadangkan oleh penyedia passkey</span>' : ''}</div></article>`;
        }).join('') || '<p class="security-hint">Belum ada passkey terdaftar.</p>') +
        '</div></section><footer class="security-recovery"><strong>Pemulihan akses</strong><p>Jika semua perangkat hilang, ikuti panduan pemulihan melalui terminal server di README.</p></footer>';
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
    return mutate(form, () => actions.api("passkeys/rename", { id, name }));
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
    confirmRevokePasskey,
    revokePasskey,
  };
}
