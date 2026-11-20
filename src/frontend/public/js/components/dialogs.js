export function createFeature({ state, actions }) {
  function tool(title, content) {
    actions.$("tool-title").textContent = title;
    actions.$("tool-body").innerHTML = content;
    actions.$("tool-error").textContent = "";
    if (!actions.$("tool-dialog").open) actions.$("tool-dialog").showModal();
  }

  async function toolAction(work, after) {
    if (state.toolBusy) return;
    const scope = actions.$("tool-dialog").open
      ? actions.$("tool-dialog")
      : actions.$("management-content");
    const errorElement = actions.$(
      scope === actions.$("tool-dialog") ? "tool-error" : "management-error",
    );
    state.toolBusy = true;
    errorElement.textContent = "";
    scope
      .querySelectorAll("button,input,select,textarea")
      .forEach((control) => (control.disabled = true));
    try {
      const result = await work();
      if (after) await after(result);
    } catch (error) {
      errorElement.textContent = error.message;
    } finally {
      state.toolBusy = false;
      scope
        .querySelectorAll("button,input,select,textarea")
        .forEach((control) => (control.disabled = false));
      actions.$("version-content")?.setAttribute("readonly", "");
    }
  }

  async function updateAfterMutation(message) {
    actions.$("tool-dialog").close();
    actions.notify(message);
    try {
      state.editing = false;
      state.draftState = null;
      await actions.refreshWorkspace();
      await actions.navigate(
        Object.hasOwn(state.managementPages, state.current) ||
          state.pages.some((page) => page.id === state.current)
          ? state.current
          : "home",
        "replace",
        true,
      );
    } catch {
      actions.notify(message + " Muat ulang halaman untuk memperbarui daftar.");
    }
  }
  return { tool, toolAction, updateAfterMutation };
}
