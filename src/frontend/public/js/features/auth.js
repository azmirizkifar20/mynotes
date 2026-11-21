export function createFeature({ state, actions }) {
  const isCanonical = () =>
    location.origin + state.basePath === state.boot.authURL;
  function fields() {
    const feedback = '<p class="form-error" role="alert"></p>';
    if (!state.authStatus)
      return (
        '<p role="status">Memuat metode masuk…</p><button type="button" class="small-button" data-action="initializeAuth">Coba lagi</button>' +
        feedback
      );
    if (!isCanonical())
      return (
        '<button class="small-button primary" type="submit">' +
        actions.icon("lock") +
        'Masuk dengan passkey</button><p class="access-description">Verifikasi di itsazmi.com. Halaman ini dan tulisanmu tetap terbuka.</p>' +
        feedback
      );
    if (state.passkeySetupReady)
      return (
        '<label class="field-label">Nama passkey<input class="text-input" name="passkeyName" required maxlength="80" value="Perangkat pribadi" autocomplete="off"></label>' +
        feedback +
        '<button class="small-button primary" type="submit">Daftarkan passkey</button>'
      );
    if (!state.authStatus.registered || state.authRecoveryToken)
      return (
        (state.authRecoveryToken
          ? "<p>Token pemulihan siap digunakan. Lanjutkan untuk menambahkan passkey pengganti.</p>"
          : '<p>Daftarkan passkey pertama dengan kode akses yang sekarang. Setelah selesai, login memakai passkey.</p><label class="field-label">Kode akses<input class="text-input" name="code" type="password" required autocomplete="current-password"></label>') +
        feedback +
        '<button class="small-button primary" type="submit">Lanjutkan pendaftaran</button>'
      );
    return (
      '<button class="small-button primary" type="submit">' +
      actions.icon("lock") +
      'Masuk dengan passkey</button><p class="access-description">Gunakan sidik jari, wajah, PIN perangkat, atau security key.</p>' +
      feedback
    );
  }
  function renderAuthFields() {
    const destination = state.authStatus?.destination;
    state.loginFields = (destination
      ? '<p class="auth-destination">Setujui login untuk: ' + actions.escape(destination) + '</p>'
      : '') + fields();
    const login = actions.$("access-page").querySelector(".login-form");
    if (login) login.innerHTML = state.loginFields;
    actions.$("auth-fields").innerHTML = state.loginFields;
  }
  async function initializeAuth() {
    if (state.boot.mode === "login" && !state.authFragmentsRead) {
      state.authFragmentsRead = true;
      const fragment = new URLSearchParams(location.hash.slice(1));
      for (const [key, field] of [
        ["bridge", "authBridgeToken"],
        ["recovery", "authRecoveryToken"],
      ]) {
        const value = fragment.get(key);
        if (value && /^[a-f0-9]{64}$/.test(value)) state[field] = value;
      }
      if (state.authBridgeToken || state.authRecoveryToken)
        history.replaceState(null, "", location.pathname + location.search);
    }
    try {
      if (state.authBridgeToken && !window.opener)
        throw new Error("Mulai login dari tombol pada halaman asal, bukan dari tautan yang dibagikan.");
      state.authStatus = await actions.api(
        "auth/status",
        state.authBridgeToken ? { bridgeToken: state.authBridgeToken } : {},
      );
      renderAuthFields();
    } catch (error) {
      renderAuthFields();
      const form = actions.$("access-page").querySelector(".login-form");
      const feedback = form?.querySelector("[role=alert]");
      if (feedback) feedback.textContent = error.message;
    }
  }
  function completeLogin(result = {}) {
    state.authRecoveryToken = null;
    state.passkeySetupReady = false;
    if (state.authBridgeToken) {
      if (!window.opener || !result.completion || !state.authStatus.destination)
        throw new Error("Jendela asal tidak tersedia. Mulai login kembali dari halaman asal.");
      window.opener.postMessage({
        type: "mdpreview:passkey",
        token: state.authBridgeToken,
        completion: result.completion,
      }, new URL(state.authStatus.destination).origin);
      actions.$("access-page").innerHTML =
        '<main class="login-page"><div class="page-icon">' +
        actions.icon("lock") +
        '</div><h1>Login disetujui.</h1><p class="lead">Kembali ke halaman asal untuk melanjutkan. Jendela ini bisa ditutup.</p><button type="button" class="small-button" data-action="closeAuthWindow">Tutup jendela</button></main>';
    } else if (state.boot.mode === "workspace") {
      actions.$("auth-dialog").close();
      actions.notify("Sesi aktif kembali. Tulisanmu tetap ada di editor.");
      if (actions.isDirty() && state.draftState?.resolved && !state.draftState.conflict)
        actions.scheduleDraft();
    } else location.reload();
  }
  async function bridgeLogin() {
    const popup = window.open(
      "about:blank",
      "_blank",
      "popup,width=520,height=720",
    );
    if (!popup)
      throw new Error(
        "Izinkan pop-up untuk membuka pusat login, lalu coba lagi.",
      );
    state.authPopup = popup;
    let cleanup = () => {};
    try {
      const bridge = await actions.api("auth/bridge/start", {});
      const completed = new Promise((resolve, reject) => {
        const receive = (event) => {
          if (event.origin !== new URL(state.boot.authURL).origin ||
              event.source !== popup || event.data?.type !== "mdpreview:passkey" ||
              event.data.token !== bridge.token ||
              typeof event.data.completion !== "string" ||
              !/^[a-f0-9]{64}$/.test(event.data.completion)) return;
          resolve(event.data.completion);
        };
        const timer = setTimeout(() => reject(new Error("Waktu login habis. Coba lagi.")), 300000);
        state.authCancel = () => reject(new Error("Login dibatalkan."));
        window.addEventListener("message", receive);
        cleanup = () => {
          clearTimeout(timer);
          window.removeEventListener("message", receive);
          state.authCancel = null;
        };
      });
      popup.location.replace(bridge.url);
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "small-button auth-cancel";
      cancel.dataset.action = "cancelAuthentication";
      cancel.textContent = "Batalkan login";
      const fields = actions.$("auth-dialog").open
        ? actions.$("auth-fields")
        : actions.$("access-page").querySelector(".login-form");
      fields.append(cancel);
      await actions.api("auth/bridge/claim", {
        token: bridge.token,
        completion: await completed,
      });
    } finally {
      cleanup();
      popup.close();
      state.authPopup = null;
      document
        .querySelectorAll(".auth-cancel")
        .forEach((button) => button.remove());
    }
  }
  function cancelAuthentication() {
    state.authCancel?.();
    state.authPopup?.close();
  }
  function closeAuthWindow() {
    window.close();
  }
  async function passkeyBrowser() {
    if (!window.isSecureContext || !window.PublicKeyCredential)
      throw new Error(
        "Passkey memerlukan browser yang mendukung WebAuthn pada HTTPS.",
      );
    return import(
      actions.appUrl(
        "/static/passkeys/" + state.boot.passkeyBrowserVersion + "/index.js",
      )
    );
  }
  function passkeyError(error) {
    return error.name === "NotAllowedError" ||
      error.code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY" ||
      error.code === "ERROR_CEREMONY_ABORTED"
      ? "Verifikasi dibatalkan atau waktunya habis. Coba lagi."
      : error.message || "Passkey belum dapat digunakan. Coba lagi.";
  }
  async function authenticate(event) {
    event.preventDefault();
    if (state.authBusy) return;
    state.authBusy = true;
    const form = event.target,
      submit = form.querySelector("[type=submit]"),
      feedback = form.querySelector("[role=alert]");
    feedback.textContent = "";
    if (submit) submit.disabled = true;
    try {
      if (!isCanonical()) {
        await bridgeLogin();
        completeLogin();
        return;
      }
      if (!state.authStatus)
        throw new Error("Metode masuk belum dimuat. Coba lagi.");
      if (
        (!state.authStatus.registered || state.authRecoveryToken) &&
        !state.passkeySetupReady
      ) {
        await actions.api(
          "auth/setup",
          state.authRecoveryToken
            ? { recoveryToken: state.authRecoveryToken }
            : { code: form.querySelector("[name=code]").value },
        );
        state.passkeySetupReady = true;
        renderAuthFields();
        return;
      }
      let result;
      if (state.passkeySetupReady) {
        result = await registerPasskey(form.querySelector("[name=passkeyName]").value);
      } else {
        const browser = await passkeyBrowser();
        const data = await actions.api("auth/login/options", {
          bridgeToken: state.authBridgeToken,
        });
        const response = await browser.startAuthentication({
          optionsJSON: data.options,
        });
        result = await actions.api("auth/login/verify", {
          challengeId: data.challengeId,
          response,
        });
      }
      completeLogin(result);
    } catch (error) {
      feedback.textContent = passkeyError(error);
    } finally {
      state.authBusy = false;
      if (submit) submit.disabled = false;
    }
  }
  async function registerPasskey(name) {
    const browser = await passkeyBrowser();
    const data = await actions.api("auth/register/options", {
      name,
      bridgeToken: state.authBridgeToken,
    });
    const response = await browser.startRegistration({
      optionsJSON: data.options,
    });
    return actions.api("auth/register/verify", {
      challengeId: data.challengeId,
      response,
    });
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
        `<div class="public-layout"><aside class="outline public-outline" id="public-outline" aria-label="Daftar isi dokumen"><div class="outline-title">DI HALAMAN INI</div></aside><main class="public-document"><div class="visitor-meta">${actions.icon("globe")}Publik · Hanya baca</div><h1>${actions.escape(state.boot.document.title)}</h1><article class="prose">${state.boot.document.html}</article><footer class="page-footer"><span>MD Previewer</span><span>${actions.escape(actions.dateLabel(state.boot.document.modified))}</span></footer></main></div>`;
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

  return {
    authenticate,
    logout,
    renderAccessPage,
    initializeAuth,
    registerPasskey,
    cancelAuthentication,
    closeAuthWindow,
  };
}
