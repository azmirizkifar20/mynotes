import { pdfPreview } from "./pdf.js";

export function createFeature({ state, actions }) {
  function accessLabel(page) {
    return `${actions.icon(page.visibility === "public" ? "globe" : "lock")}${page.visibility === "public" ? "Publik" : "Privat"}`;
  }

  async function openShare(id) {
    const page = state.pages.find(
      (page) => page.id === id && ["doc", "pdf"].includes(page.type),
    );
    if (!page) return;
    try {
      const data = await actions.api("share", { filePath: page.path });
      page.visibility = data.visibility;
      page.sharePath = data.sharePath;
      state.sharingId = id;
      updateShareDialog();
      actions.$("share-dialog").showModal();
    } catch (error) {
      actions.notify(error.message);
    }
  }

  function updateShareDialog() {
    const page = state.pages.find((page) => page.id === state.sharingId);
    const publicAccess = page.visibility === "public";
    actions.$("share-filename").textContent = page.title;
    actions.$("share-access").value = page.visibility;
    actions.$("share-description").textContent = publicAccess
      ? "Siapa pun yang punya link dapat membaca file ini tanpa masuk. Pengunjung tidak dapat mengedit."
      : "File ini privat. Pengguna harus masuk untuk membukanya. Link publik dinonaktifkan, termasuk link yang sebelumnya dibagikan.";
    actions.$("share-link").value =
      publicAccess && page.sharePath
        ? new URL(page.sharePath, location.origin).href
        : "";
    actions.$("share-link").placeholder = publicAccess
      ? ""
      : "Tidak ada link publik aktif";
    actions.$("share-link").disabled = !publicAccess;
    actions.$("copy-share").disabled = !publicAccess;
  }

  async function setAccess(visibility) {
    if (!["public", "private"].includes(visibility)) return;
    const page = state.pages.find(
      (page) => page.id === state.sharingId && ["doc", "pdf"].includes(page.type),
    );
    if (!page) return;
    actions.$("share-access").disabled = true;
    actions.$("copy-share").disabled = true;
    try {
      const data = await actions.api("share", {
        filePath: page.path,
        visibility,
      });
      page.visibility = data.visibility;
      page.sharePath = data.sharePath;
      if (actions.$("entries")) actions.renderEntries();
      if (state.current === page.id && actions.$("file-access")) {
        actions.$("file-access").innerHTML = accessLabel(page);
        actions
          .$("file-access")
          .classList.toggle("public-access", visibility === "public");
      }
      actions.notify(
        visibility === "public"
          ? "File dapat dibaca melalui link publik."
          : "File menjadi privat. Akses publik ditutup.",
      );
    } catch (error) {
      actions.notify(error.message);
    } finally {
      actions.$("share-access").disabled = false;
      updateShareDialog();
    }
  }

  async function copyShareLink() {
    const page = state.pages.find((page) => page.id === state.sharingId);
    if (page?.visibility !== "public") return;
    try {
      await navigator.clipboard.writeText(actions.$("share-link").value);
      actions.notify("Link publik disalin.");
    } catch {
      actions.$("share-link").focus();
      actions.$("share-link").select();
      actions.notify(
        "Link dipilih. Gunakan menu Salin atau Ctrl+C untuk menyalinnya.",
      );
    }
  }

  async function previewPublicAccess() {
    const page = state.pages.find((page) => page.id === state.sharingId);
    if (!page) return;
    try {
      const data =
        page.visibility === "public"
          ? await actions.api("document", { filePath: page.path })
          : null;
      actions.$("visitor-content").innerHTML = data
        ? `<div class="visitor-meta">${actions.icon("globe")}Publik · Hanya baca</div><h1>${actions.escape(page.title)}</h1>${data.type === "pdf" ? pdfPreview(data.pdfUrl, page.title, actions.escape) : `<article class="prose">${data.html}</article>`}`
        : `<div class="visitor-blocked">${actions.icon("lock")}<h2>File ini privat</h2><p>Link publik sudah tidak dapat digunakan. Masuk dengan akses workspace untuk membaca file ini.</p></div>`;
      actions.$("share-dialog").close();
      actions.$("visitor-dialog").showModal();
    } catch (error) {
      actions.notify(error.message);
    }
  }
  return {
    accessLabel,
    openShare,
    updateShareDialog,
    setAccess,
    copyShareLink,
    previewPublicAccess,
  };
}
