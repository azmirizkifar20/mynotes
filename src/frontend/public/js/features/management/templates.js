export function createFeature({ state, actions }) {
  async function loadTemplates() {
    state.availableTemplates = (await actions.api("templates")).items;
    return state.availableTemplates;
  }

  function editTemplate(id = "") {
    const item = state.availableTemplates.find((item) => item.id === id);
    actions.$("management-error").textContent = "";
    actions.$("management-content").innerHTML =
      `<h2>${item ? "Edit template" : "Template baru"}</h2><form data-submit="saveTemplate" data-arg="${id}"><label class="field-label" for="template-name">Nama template</label><input class="text-input" id="template-name" required maxlength="100" value="${actions.escape(item?.name || "")}"><label class="field-label" for="template-content">Isi Markdown</label><textarea class="editor tool-editor" id="template-content" required>${actions.escape(item?.content || "# Judul\n\n")}</textarea><div class="tool-actions"><button type="button" class="small-button" data-action="openTemplates">Batal</button><button type="submit" class="small-button primary">Simpan template</button></div></form>`;
    actions.$("template-name").focus();
  }

  function saveTemplate(event, id) {
    event.preventDefault();
    const body = {
      id: id || undefined,
      name: actions.$("template-name").value,
      content: actions.$("template-content").value,
    };
    actions.toolAction(
      () => actions.api("templates/save", body),
      () => actions.updateAfterMutation("Template berhasil disimpan."),
    );
  }

  function confirmTemplateDelete(id) {
    actions.tool(
      "Hapus template?",
      '<p>Dokumen yang sudah dibuat dari template ini tetap tersimpan.</p><div class="tool-actions"><button class="small-button" data-action="openTemplates">Batal</button><button class="small-button destructive" data-action="deleteTemplate" data-arg="' +
        id +
        '">Hapus template</button></div>',
    );
  }

  function deleteTemplate(id) {
    actions.toolAction(
      () => actions.api("templates/delete", { id, confirm: true }),
      () => actions.updateAfterMutation("Template dihapus."),
    );
  }

  async function prepareTemplatePicker() {
    const select = actions.$("new-template");
    select.innerHTML = '<option value="">Halaman kosong</option>';
    select.disabled = true;
    try {
      await loadTemplates();
      const selected = select.value;
      select.innerHTML =
        '<option value="">Halaman kosong</option>' +
        state.availableTemplates
          .map(
            (item) =>
              `<option value="${item.id}">${actions.escape(item.name)}</option>`,
          )
          .join("");
      select.value = selected;
    } catch {
      actions.notify(
        "Template belum dapat dimuat. Halaman kosong tetap tersedia.",
      );
    } finally {
      select.disabled = false;
    }
  }

  function useTemplate(id) {
    actions.$("tool-dialog").close();
    actions.openCreate("doc");
    const select = actions.$("new-template");
    select.innerHTML =
      '<option value="">Halaman kosong</option>' +
      state.availableTemplates
        .map(
          (item) =>
            `<option value="${item.id}">${actions.escape(item.name)}</option>`,
        )
        .join("");
    select.value = id;
  }

  function documentInitialContent(name) {
    return (
      state.availableTemplates.find(
        (item) => item.id === actions.$("new-template").value,
      )?.content || "# " + name.replace(/\.md$/i, "") + "\n\n"
    );
  }
  return {
    loadTemplates,
    editTemplate,
    saveTemplate,
    confirmTemplateDelete,
    deleteTemplate,
    prepareTemplatePicker,
    useTemplate,
    documentInitialContent,
  };
}
