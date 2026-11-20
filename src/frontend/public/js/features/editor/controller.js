export function createFeature({ state, actions }) {
  function isDirty() {
    return (
      state.documentBuffer?.id === state.current &&
      actions.documentContent() !==
        (state.pages.find((p) => p.id === state.current)?.body || "")
    );
  }

  function setBusy(value) {
    if (value) state.navigationSequence++;
    state.saving = value;
    actions.syncEditorLock();
  }

  function toggleWidth() {
    const on = document.body.classList.toggle("full-width");
    actions.$("width-button").setAttribute("aria-pressed", on);
  }

  function renderDoc(page) {
    actions.destroyLiveEditor();
    if (state.documentBuffer?.id !== page.id)
      state.documentBuffer = { id: page.id, content: page.body || "" };
    actions.$("main").innerHTML =
      actions.header(page) +
      `<div class="doc-toolbar"><div class="tabs"><button class="tab ${!state.editing ? "selected" : ""}" data-action="setEditing" data-value-type="boolean" data-arg="false">${actions.icon("book")}Dokumen</button><button class="tab ${state.editing ? "selected" : ""}" data-action="setEditing" data-value-type="boolean" data-arg="true">${actions.icon("code")}Markdown</button></div><div class="tool-actions"><button class="small-button" data-action="openHistory">${actions.icon("clock")}Riwayat</button><button class="small-button" data-action="downloadDoc">${actions.icon("upload")}Unduh .md</button><button class="small-button primary" id="save-document" data-action="saveDoc" disabled>${actions.icon("check")}Simpan</button></div></div>${state.editing ? `<label class="field-label" for="markdown-editor">Konten Markdown</label><textarea class="editor" id="markdown-editor" spellcheck="false">${actions.escape(actions.documentContent())}</textarea>` : `<div id="live-editor" aria-label="Konten dokumen, dapat diedit langsung" aria-busy="true"><article class="prose">${page.html || ""}</article></div>`}<p class="edit-hint">${state.editing ? "Edit sumber Markdown." : "Klik teks untuk mengedit langsung. Format akan dirender saat kamu mengetik."} Draft tersimpan otomatis dan tetap privat. Tekan Simpan atau Ctrl+S untuk memperbarui dokumen.</p><footer class="page-footer"><span>${actions.escape(page.title)}.md · Versi ${page.revision}</span><span>${actions.escape(actions.dateLabel(page.modified))}</span></footer>`;
    actions.$("outline").innerHTML =
      '<div class="outline-title">DI HALAMAN INI</div>';
    decorateHeadings(document.querySelector("#main .prose"), true);
    if (state.editing) {
      actions
        .$("outline")
        .insertAdjacentHTML(
          "beforeend",
          '<span class="subtle">Mode edit Markdown</span>',
        );
      actions
        .$("markdown-editor")
        .addEventListener("input", (event) =>
          actions.changeDocumentContent(event.target.value),
        );
    } else {
      actions.mountLiveEditor(page);
    }
    actions.syncEditorLock();
    actions
      .$("outline")
      .insertAdjacentHTML(
        "beforeend",
        '<div class="outline-help"><kbd>Ctrl</kbd> + <kbd>K</kbd> untuk cari</div>',
      );
  }

  async function setEditing(value) {
    if (
      value === state.editing ||
      state.saving ||
      state.navigationPending ||
      state.draftRequest ||
      state.toolBusy
    )
      return;
    const page = state.pages.find((p) => p.id === state.current);
    actions.documentContent();
    if (
      state.draftState?.id !== page.id ||
      !state.draftState.resolved ||
      state.draftState.conflict
    ) {
      try {
        await actions.loadDraft(page);
      } catch (error) {
        return actions.notify(error.message);
      }
      if (
        state.current !== page.id ||
        !state.draftState?.resolved ||
        state.draftState.conflict
      )
        return;
    }
    state.editing = value;
    renderDoc(state.pages.find((p) => p.id === state.current));
    if (state.editing) actions.$("markdown-editor").focus();
  }

  async function saveDoc() {
    if (
      state.saving ||
      !isDirty() ||
      state.draftState?.conflict ||
      !state.draftState?.resolved
    )
      return;
    const page = state.pages.find((p) => p.id === state.current);
    const content = actions.documentContent();
    setBusy(true);
    actions.$("save-document").disabled = true;
    actions.$("save-state").textContent = "Menyimpan…";
    try {
      await actions.flushDraft();
      const data = await actions.api("save", {
        filePath: page.path,
        content,
        revision: page.revision,
        draftToken: state.draftState?.token || undefined,
      });
      page.body = content;
      page.html = data.html;
      page.modified = data.modified;
      page.revision = data.revision;
      state.draftState = {
        id: page.id,
        token: null,
        content,
        conflict: false,
        resolved: true,
      };
      renderDoc(page);
      actions.$("save-state").textContent = "";
      actions.notify("Perubahan disimpan.");
    } catch (error) {
      actions.$("save-state").textContent = "Gagal menyimpan";
      actions.notify(error.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadDoc() {
    const page = state.pages.find((p) => p.id === state.current);
    const url = URL.createObjectURL(
      new Blob([page.body || ""], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = page.title + ".md";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function decorateHeadings(container, withOutline = false) {
    container
      ?.querySelectorAll("h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]")
      .forEach((heading) => {
        if (withOutline) {
          const link = document.createElement("a");
          link.href = "#" + heading.id;
          link.textContent = heading.textContent;
          actions.$("outline").append(link);
        }
        const button = document.createElement("button");
        button.className = "heading-link";
        button.type = "button";
        button.textContent = "#";
        button.setAttribute(
          "aria-label",
          "Salin link ke bagian " + heading.textContent,
        );
        button.addEventListener("click", async () => {
          const url = new URL(location.href);
          url.hash = heading.id;
          try {
            await navigator.clipboard.writeText(url.href);
            actions.notify(
              "Link bagian disalin. Akses mengikuti pengaturan file.",
            );
          } catch {
            actions.tool(
              "Link bagian",
              '<input class="text-input" readonly value="' +
                actions.escape(url.href) +
                '" data-action="selectText"><p class="edit-hint">Pilih dan salin alamat ini.</p>',
            );
          }
        });
        heading.append(button);
      });
  }

  function scrollToHash() {
    if (!location.hash) return;
    try {
      const target = document.getElementById(
        decodeURIComponent(location.hash.slice(1)),
      );
      if (target) target.scrollIntoView();
      else
        [...actions.$("outline").querySelectorAll("a")]
          .find((link) => link.getAttribute("href") === location.hash)
          ?.click();
    } catch {}
  }
  return {
    isDirty,
    setBusy,
    toggleWidth,
    renderDoc,
    setEditing,
    saveDoc,
    downloadDoc,
    decorateHeadings,
    scrollToHash,
  };
}
