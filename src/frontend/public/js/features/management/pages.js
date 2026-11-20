export function createFeature({ state, actions }) {
  async function renderManagementPage(view) {
    const page = state.managementPages[view],
      sequence = state.navigationSequence;
    actions.$("outline").innerHTML = "";
    actions.$("main").innerHTML =
      `<div class="page-icon">${actions.icon(page.icon)}</div><p class="page-kicker">Pengelolaan</p><h1>${page.title}</h1><p class="lead">${page.description}</p><section class="management-content" id="management-content"><p role="status">Memuat…</p></section><p class="delete-error" id="management-error" role="alert"></p>`;
    try {
      const data = await actions.api(view);
      if (state.current !== view || sequence !== state.navigationSequence)
        return;
      if (view === "trash")
        actions.$("management-content").innerHTML =
          data.items
            .map(
              (item) =>
                `<section class="tool-row"><div><strong>${actions.escape(item.path.split("/").pop())}</strong><small>docs${actions.escape(item.path)} · ${actions.escape(actions.dateLabel(item.deleted_at))}</small></div><div class="tool-actions"><button class="small-button" data-action="restoreTrashed" data-arg="${item.id}">Pulihkan</button><button class="small-button danger" data-action="confirmPurge" data-arg="${item.id}">Hapus permanen</button></div></section>`,
            )
            .join("") || '<p class="empty">Sampah kosong.</p>';
      else if (view === "templates") {
        state.availableTemplates = data.items;
        actions.$("management-content").innerHTML =
          '<button class="small-button primary" data-action="editTemplate">Template baru</button>' +
          (data.items
            .map(
              (item) =>
                `<section class="tool-row"><strong>${actions.escape(item.name)}</strong><div class="tool-actions"><button class="small-button" data-action="useTemplate" data-arg="${item.id}">Gunakan</button><button class="small-button" data-action="editTemplate" data-arg="${item.id}">Edit</button><button class="small-button danger" data-action="confirmTemplateDelete" data-arg="${item.id}">Hapus</button></div></section>`,
            )
            .join("") || '<p class="empty">Belum ada template.</p>');
      } else
        actions.$("management-content").innerHTML =
          data.items
            .map(
              (item) =>
                `<section class="tool-row"><div><strong>${actions.escape(item.action)}</strong><p>${actions.escape(item.detail)}</p><small>${actions.escape(new Date(item.created_at).toLocaleString("id-ID"))}</small></div></section>`,
            )
            .join("") || '<p class="empty">Belum ada aktivitas.</p>';
    } catch (error) {
      if (state.current !== view || sequence !== state.navigationSequence)
        return;
      actions.$("management-content").innerHTML =
        `<button class="small-button" data-action="navigate" data-arg="${view}" data-arg1="replace">Coba lagi</button>`;
      actions.$("management-error").textContent = error.message;
    }
  }

  function openTrash() {
    return actions.navigate("trash");
  }

  function openTemplates() {
    return actions.navigate("templates");
  }

  function openActivity() {
    return actions.navigate("activity");
  }
  return { renderManagementPage, openTrash, openTemplates, openActivity };
}
