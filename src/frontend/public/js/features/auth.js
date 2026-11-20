export function createFeature({ state, actions }) {
  async function authenticate(event) {
    event.preventDefault();
    const form = event.target,
      submit = form.querySelector("[type=submit]");
    const feedback = form.querySelector("[role=alert]");
    feedback.textContent = "";
    submit.disabled = true;
    try {
      await actions.api("verify", {
        code: form.querySelector("[name=code]").value,
      });
      if (state.boot.mode === "workspace") {
        actions.$("auth-dialog").close();
        form.reset();
        actions.notify("Sesi aktif kembali. Kamu dapat melanjutkan.");
      } else location.reload();
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  }

  async function logout() {
    if (!actions.canLeave()) return;
    actions.setBusy(true);
    try {
      await actions.api("logout", {});
      state.editing = false;
      actions.setBusy(false);
      location.replace(actions.appUrl("/"));
    } catch (error) {
      actions.notify(error.message);
    } finally {
      actions.setBusy(false);
    }
  }

  function renderAccessPage() {
    actions.$("access-page").hidden = false;
    const theme = `<label class="theme-setting" for="visitor-theme">${actions.icon("theme")}<span>Tampilan</span><select id="visitor-theme" data-change="setTheme" data-input-value="true"><option value="system">Sistem</option><option value="light">Terang</option><option value="dark">Gelap</option></select></label>`;
    const toolbar = `<header class="public-topbar"><a class="public-brand" href="${actions.escape(actions.appUrl("/"))}">${actions.icon("book")}MD Previewer</a>${theme}</header>`;
    if (state.boot.mode === "public") {
      document.title = state.boot.document.title + " · MD Previewer";
      actions.$("access-page").innerHTML =
        toolbar +
        `<main class="public-document"><div class="visitor-meta">${actions.icon("globe")}Publik · Hanya baca</div><h1>${actions.escape(state.boot.document.title)}</h1><article class="prose">${state.boot.document.html}</article><footer class="page-footer"><span>MD Previewer</span><span>${actions.escape(actions.dateLabel(state.boot.document.modified))}</span></footer></main>`;
    } else if (state.boot.mode === "login") {
      actions.$("access-page").innerHTML =
        toolbar +
        `<main class="login-page"><div class="page-icon">${actions.icon("lock")}</div><p class="page-kicker">Personal workspace</p><h1>Ruang untuk catatanmu.</h1><p class="lead">Masuk untuk membuka workspace dan mengelola dokumen privat.</p><form class="login-form" data-submit="authenticate">${state.loginFields}</form></main>`;
    } else {
      actions.$("access-page").innerHTML =
        toolbar +
        `<main class="login-page"><div class="page-icon">${actions.icon("lock")}</div><h1>${actions.escape(state.boot.message || "Halaman tidak tersedia")}</h1><p class="lead">${actions.escape(state.boot.description || "Periksa alamat halaman atau kembali ke workspace.")}</p><a class="small-button" href="${actions.escape(actions.appUrl("/"))}">Buka workspace</a></main>`;
    }
    actions.$("visitor-theme").value = state.themePreference;
  }
  return { authenticate, logout, renderAccessPage };
}
