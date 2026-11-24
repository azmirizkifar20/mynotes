export function createFeature({ state, actions }) {
  let selected = null;
  const editable = () => state.boot.mode === "workspace" && !state.saving && !state.navigationPending &&
    !state.toolBusy && state.draftState?.id === state.current &&
    state.draftState.resolved && !state.draftState.conflict;
  const imageMarkup = (src, alt, width, title = "") =>
    `<img src="${actions.escape(src)}" alt="${actions.escape(alt)}" width="${width}"${title ? ` title="${actions.escape(title)}"` : ""}>`;

  function changed() {
    state.liveEditorTouched = true;
    actions.changeDocumentContent(state.liveEditor.getValue());
    actions.refreshLiveOutline();
  }

  async function uploadDocumentImage(file, event) {
    const page = state.pages.find((item) => item.id === state.current);
    if (page?.type !== "doc")
      return actions.notify("Buka dokumen Markdown untuk menyisipkan gambar.");
    if (!editable() || (!state.editing && !state.liveEditorReady))
      return actions.notify("Tunggu editor siap atau selesaikan proses yang berjalan.");
    if (!/\.(png|jpe?g|gif|webp)$/i.test(file.name) || file.size > 5 * 1024 * 1024)
      return actions.notify("Gunakan PNG, JPEG, GIF, atau WebP, maksimal 5 MB.");
    const generation = state.liveEditorGeneration;
    const source = actions.$("markdown-editor");
    const offsets = source && [source.selectionStart, source.selectionEnd];
    const editor = actions.$("live-editor")?.querySelector('.vditor-ir [contenteditable="true"]');
    let range = null;
    if (editor) {
      const caret = event.type === "drop" && document.caretRangeFromPoint?.(event.clientX, event.clientY);
      const selection = document.getSelection();
      const candidate = caret && editor.contains(caret.startContainer) ? caret :
        selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (candidate && editor.contains(candidate.startContainer) && editor.contains(candidate.endContainer))
        range = candidate.cloneRange();
      else { range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); }
      range.collapse(true);
      // Insert beside rendered HTML, never into its preview or hidden source markers.
      const element = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
      const block = element?.closest('[data-type="html-block"], [data-type="img"], .vditor-ir__marker--pre');
      if (block && editor.contains(block)) { range.setStartAfter(block); range.collapse(true); }
    }
    state.toolBusy = state.imageUploading = true;
    actions.syncEditorLock();
    actions.$("document-save-state").textContent = "Mengupload gambar…";
    try {
      const data = new FormData();
      data.append("filePath", page.path);
      data.append("file", file);
      const result = await actions.api("images/upload", data);
      if (state.current !== page.id || generation !== state.liveEditorGeneration ||
          !state.draftState?.resolved || state.draftState.conflict)
        throw new Error("Gambar sudah diupload, tetapi dokumen berubah. Lokasi: docs" + result.path);
      state.imageUploading = false;
      actions.syncEditorLock();
      const markup = imageMarkup(result.filename, file.name, 640);
      if (source) {
        source.setRangeText("\n\n" + markup + "\n\n", ...offsets, "end");
        actions.changeDocumentContent(source.value);
        source.focus();
      } else {
        editor.focus();
        const selection = document.getSelection();
        selection.removeAllRanges(); selection.addRange(range);
        state.liveEditor.insertMD(markup);
        changed();
      }
      actions.notify("Gambar ditambahkan. Klik gambar di tab Dokumen untuk mengubah ukuran.");
    } catch (error) {
      actions.notify(error.message);
      actions.$("document-save-state").textContent = "Upload gambar gagal.";
    } finally {
      state.toolBusy = state.imageUploading = false;
      actions.syncEditorLock();
    }
  }

  function openImageSize(image) {
    if (!editable() || !state.liveEditorReady || state.editing) return;
    const wrapper = image.closest('[data-type="img"], [data-type="html-block"], [data-type="html-inline"]');
    if (!wrapper) return;
    selected = { image, wrapper, id: state.current, generation: state.liveEditorGeneration };
    const width = Math.max(32, Math.min(4000, Number(image.getAttribute("width")) || Math.round(image.getBoundingClientRect().width) || 640));
    actions.tool("Ukuran gambar", `<form data-submit="resizeDocumentImage"><div class="image-size-preview"><img src="${actions.escape(image.getAttribute("src"))}" alt="${actions.escape(image.alt)}" width="${width}" id="image-size-preview"></div><label class="field-label" for="image-size-width">Lebar gambar (px)</label><div class="image-size-controls"><input type="range" min="32" max="4000" value="${width}" id="image-size-range" aria-label="Lebar gambar"><input class="text-input" type="number" min="32" max="4000" step="1" required value="${width}" id="image-size-width"></div><p class="edit-hint">Proporsi gambar tetap terjaga. Perubahan ukuran ikut tersimpan otomatis setelah diterapkan.</p><div class="tool-row"><button type="button" class="small-button" data-action="closeDialog" data-arg="tool-dialog">Batal</button><button class="small-button primary" type="submit">Terapkan ukuran</button></div></form>`);
    for (const id of ["image-size-width", "image-size-range"])
      actions.$(id).addEventListener("input", (event) => {
        const value = Number(event.target.value);
        if (!Number.isInteger(value) || value < 32 || value > 4000) return;
        actions.$(id === "image-size-width" ? "image-size-range" : "image-size-width").value = value;
        actions.$("image-size-preview").width = value;
      });
    actions.$("image-size-width").focus();
  }

  function resizeDocumentImage(event) {
    event.preventDefault();
    const width = Number(actions.$("image-size-width").value);
    if (!Number.isInteger(width) || width < 32 || width > 4000) return;
    if (!editable() || !selected?.image.isConnected || selected.id !== state.current ||
        selected.generation !== state.liveEditorGeneration)
      return actions.$("tool-error").textContent = "Dokumen berubah. Tutup dialog dan pilih gambar kembali.";
    const { image, wrapper } = selected;
    if (wrapper.dataset.type === "img") {
      const range = document.createRange(); range.selectNode(wrapper);
      actions.$("tool-dialog").close();
      state.liveEditor.focus();
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      state.liveEditor.insertMD(imageMarkup(image.getAttribute("src"), image.alt, width, image.title));
    } else {
      const code = wrapper.querySelector('code[data-type="html-block"], code[data-type="html-inline"]');
      if (!code) return actions.$("tool-error").textContent = "Ubah ukuran gambar ini melalui tab Markdown.";
      const template = document.createElement("template");
      template.innerHTML = code.textContent;
      const index = [...wrapper.querySelectorAll(".vditor-ir__preview img")].indexOf(image);
      const target = template.content.querySelectorAll("img")[index];
      if (!target) return actions.$("tool-error").textContent = "Sumber gambar tidak ditemukan. Gunakan tab Markdown.";
      target.setAttribute("width", width);
      target.removeAttribute("height");
      target.style.removeProperty("width"); target.style.removeProperty("height");
      if (!target.getAttribute("style")) target.removeAttribute("style");
      actions.$("tool-dialog").close();
      code.textContent = template.innerHTML;
      state.liveEditor.setValue(state.liveEditor.getValue());
    }
    changed();
    selected = null;
    actions.$("tool-dialog").close();
    state.liveEditor.focus();
  }

  function decorateEditorImages() {
    actions.$("live-editor")?.querySelectorAll(".vditor-ir img").forEach((image) => {
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", "Ubah ukuran gambar: " + (image.alt || "gambar"));
    });
  }

  function bindDocumentImages() {
    document.addEventListener("paste", (event) => {
      if (state.boot.mode !== "workspace" ||
          !event.target.closest?.('#markdown-editor, #live-editor .vditor-ir [contenteditable="true"]') ||
          document.querySelector("dialog[open]")) return;
      let files = [...(event.clipboardData?.items || [])]
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile()).filter(Boolean);
      if (!files.length)
        files = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith("image/"));
      if (!files.length) return;
      event.preventDefault(); event.stopPropagation();
      if (files.length !== 1)
        return actions.notify("Tempel satu gambar setiap kali upload.");
      const file = files[0];
      const extension = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }[file.type];
      if (!extension)
        return actions.notify("Gunakan gambar PNG, JPEG, GIF, atau WebP, maksimal 5 MB.");
      actions.uploadDocumentImage(
        /\.(png|jpe?g|gif|webp)$/i.test(file.name) ? file :
          new File([file], "clipboard." + extension, { type: file.type }),
        event,
      );
    }, true);
    for (const type of ["click", "keydown"])
      document.addEventListener(type, (event) => {
        const image = event.target.closest?.("#live-editor .vditor-ir img");
        if (!image || (type === "keydown" && !["Enter", " "].includes(event.key))) return;
        event.preventDefault(); event.stopPropagation();
        openImageSize(image);
      }, true);
  }
  return { uploadDocumentImage, resizeDocumentImage, decorateEditorImages, bindDocumentImages };
}
