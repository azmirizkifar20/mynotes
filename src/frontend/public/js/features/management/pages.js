export function createFeature({ state, actions }) {
  async function renderManagementPage(view) {
    if (view === "sticky") return actions.renderStickyNotes();
    if (view === "today") return actions.renderToday();
    if (view === "tasks") return actions.renderTaskBoard();
    if (view === "passkeys") return actions.renderPasskeys();
    const page = state.managementPages[view],
      sequence = state.navigationSequence;
    actions.$("outline").innerHTML = "";
    actions.$("main").innerHTML =
      `<header class="management-heading"><h1>${page.title}</h1><p class="lead">${page.description}</p></header><section class="management-content" id="management-content" aria-busy="true"><p role="status">Memuat…</p></section><p class="delete-error" id="management-error" role="alert"></p>`;
    try {
      const data = await actions.api(view);
      if (state.current !== view || sequence !== state.navigationSequence)
        return;
      if (view === "trash")
        actions.$("management-content").innerHTML =
          data.items
            .map(
              (item) =>
                `<section class="tool-row"><span class="management-symbol">${actions.icon("doc")}</span><div class="management-details"><strong>${actions.escape(item.path.split("/").pop())}</strong><small>docs${actions.escape(item.path)} · Dihapus ${actions.escape(actions.dateLabel(item.deleted_at))}</small></div><div class="tool-actions"><button class="small-button" data-action="restoreTrashed" data-arg="${item.id}">Pulihkan</button><button class="small-button danger" data-action="confirmPurge" data-arg="${item.id}">Hapus permanen</button></div></section>`,
            )
            .join("") || '<p class="empty">Sampah kosong.</p>';
      else if (view === "templates") {
        state.availableTemplates = data.items;
        actions.$("management-content").innerHTML =
          '<div class="management-toolbar"><p>Mulai dokumen dengan struktur yang sudah siap dipakai.</p><button class="small-button primary" data-action="editTemplate">' + actions.icon("plus") + 'Template baru</button></div>' +
          (data.items
            .map(
              (item) =>
                `<section class="tool-row"><span class="management-symbol">${actions.icon("doc")}</span><div class="management-details"><strong>${actions.escape(item.name)}</strong><small>${actions.escape((item.content || "").split("\n").filter(line => line.startsWith("## ")).map(line => line.slice(3)).join(" · "))}</small></div><div class="tool-actions"><button class="small-button" data-action="useTemplate" data-arg="${item.id}">Gunakan</button><button class="small-button" data-action="editTemplate" data-arg="${item.id}">Edit</button><button class="small-button danger" data-action="confirmTemplateDelete" data-arg="${item.id}" aria-label="Hapus template ${actions.escape(item.name)}">${actions.icon("trash")}</button></div></section>`,
            )
            .join("") || '<p class="empty">Belum ada template.</p>');
      } else {
        const groups = new Map();
        for (const item of data.items) {
          const day = actions.dateLabel(item.created_at);
          if (!groups.has(day)) groups.set(day, []);
          groups.get(day).push(item);
        }
        actions.$("management-content").innerHTML = [...groups].map(([day, items]) =>
          `<h2 class="activity-day">${actions.escape(day)}</h2><div class="activity-list">${items.map(item => `<section class="activity-item"><strong>${actions.escape(item.action)}</strong><p>${actions.escape(item.detail)}</p><time datetime="${actions.escape(item.created_at)}">${actions.escape(new Date(item.created_at).toLocaleTimeString("id-ID", {hour: "2-digit", minute: "2-digit"}))}</time></section>`).join("")}</div>`
        ).join("") || '<p class="empty">Belum ada aktivitas.</p>';
      }
      actions.$("management-content").setAttribute("aria-busy", "false");
    } catch (error) {
      if (state.current !== view || sequence !== state.navigationSequence)
        return;
      actions.$("management-content").innerHTML =
        `<button class="small-button" data-action="navigate" data-arg="${view}" data-arg1="replace">Coba lagi</button>`;
      actions.$("management-error").textContent = error.message;
      actions.$("management-content").setAttribute("aria-busy", "false");
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
