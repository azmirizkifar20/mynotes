export function createFeature({ state, actions }) {
  let stopOutlineTracking = () => {};

  function trackOutline(headings = [], outline = actions.$("outline")) {
    stopOutlineTracking();
    stopOutlineTracking = () => {};
    if (!outline) return;
    const links = [...outline.querySelectorAll("a")];
    const entries = [...headings]
      .map((heading, index) => ({ heading, link: links[index] }))
      .filter((entry) => entry.heading && entry.link);
    if (!entries.length) return;
    let active,
      frame = null,
      clickedAt = null;
    const readingTop = () =>
      Math.max(0, document.querySelector(".topbar, .public-topbar")?.getBoundingClientRect().bottom || 0) + 16;
    function activate(entry) {
      if (active === entry) return;
      active?.link.removeAttribute("aria-current");
      active = entry;
      active.link.setAttribute("aria-current", "location");
      const item = active.link.getBoundingClientRect();
      const bounds = outline.getBoundingClientRect();
      if (item.top < bounds.top) outline.scrollTop += item.top - bounds.top;
      else if (item.bottom > bounds.bottom)
        outline.scrollTop += item.bottom - bounds.bottom;
    }
    function update() {
      frame = null;
      if (clickedAt === window.scrollY) return;
      clickedAt = null;
      let current = entries[0];
      const top = readingTop();
      for (const entry of entries) {
        if (entry.heading.getBoundingClientRect().top > top + 1) break;
        current = entry;
      }
      if (
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
      )
        current = entries.at(-1);
      activate(current);
    }
    function schedule() {
      if (frame === null) frame = requestAnimationFrame(update);
    }
    function resize() {
      clickedAt = null;
      schedule();
    }
    function click(event) {
      if (
        event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
      ) return;
      const link = event.target.closest("a");
      const entry = entries.find((item) => item.link === link);
      if (!entry) return;
      event.preventDefault();
      window.scrollTo({
        top: window.scrollY + entry.heading.getBoundingClientRect().top - readingTop(),
        behavior: "instant",
      });
      // Keep the clicked section selected when scrolling is clamped at the page bottom.
      clickedAt = window.scrollY;
      activate(entry);
      history.replaceState(
        history.state,
        "",
        location.pathname + location.search + entry.link.getAttribute("href"),
      );
    }
    outline.addEventListener("click", click);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize);
    stopOutlineTracking = () => {
      outline.removeEventListener("click", click);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
      if (frame !== null) cancelAnimationFrame(frame);
      active?.link.removeAttribute("aria-current");
    };
    update();
  }

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
      `<div class="doc-toolbar"><div class="tabs"><button class="tab ${!state.editing ? "selected" : ""}" data-action="setEditing" data-value-type="boolean" data-arg="false">${actions.icon("book")}Dokumen</button><button class="tab ${state.editing ? "selected" : ""}" data-action="setEditing" data-value-type="boolean" data-arg="true">${actions.icon("code")}Markdown</button></div><div class="tool-actions"><button class="small-button" data-action="openHistory">${actions.icon("clock")}Riwayat</button><button class="small-button" data-action="downloadDoc">${actions.icon("upload")}Unduh .md</button><button class="small-button primary" id="save-document" data-action="saveDoc" disabled>${actions.icon("check")}Simpan</button></div></div>${state.editing ? `<label class="field-label" for="markdown-editor">Konten Markdown</label><textarea class="editor" id="markdown-editor" spellcheck="false">${actions.escape(actions.documentContent())}</textarea>` : `<div id="live-editor" aria-label="Konten dokumen, dapat diedit langsung" aria-busy="true"><article class="prose">${page.html || ""}</article></div>`}<p class="edit-hint">${state.editing ? "Edit sumber Markdown." : "Klik teks untuk mengedit langsung. Format akan dirender saat kamu mengetik."} Perubahan tersimpan otomatis setelah berhenti mengetik. File publik ikut diperbarui. <span id="document-save-state" role="status" aria-live="polite"></span></p><footer class="page-footer"><span id="document-revision">${actions.escape(page.title)}.md · Versi ${page.revision}</span><span id="document-modified">${actions.escape(actions.dateLabel(page.modified))}</span></footer>`;
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
    if (actions.$("document-rename-form")?.hidden === false)
      return actions.notify("Simpan atau batalkan perubahan nama terlebih dahulu.");
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
    setBusy(true);
    actions.$("save-document").disabled = true;
    try {
      await actions.flushDraft();
      actions.notify("Perubahan disimpan.");
    } catch {
      // The shared autosave flow keeps the content and displays the failure.
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

  function decorateHeadings(container, withOutline = false, outline = actions.$("outline")) {
    const headings = container?.querySelectorAll(
      "h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]",
    ) || [];
    headings.forEach((heading) => {
      if (withOutline) {
        const link = document.createElement("a");
        link.href = "#" + heading.id;
        link.textContent = heading.textContent;
        outline.append(link);
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
    if (withOutline) trackOutline(headings, outline);
    return headings.length;
  }

  function scrollToHash() {
    if (!location.hash) return;
    try {
      const target = document.getElementById(
        decodeURIComponent(location.hash.slice(1)),
      );
      if (target) target.scrollIntoView();
      else
        [...(actions.$("public-outline") || actions.$("outline")).querySelectorAll("a")]
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
    trackOutline,
    scrollToHash,
  };
}
