export function createFeature({ state, actions }) {
  function notify(message) {
    actions.$("toast").textContent = message;
    actions.$("toast").hidden = false;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(
      () => (actions.$("toast").hidden = true),
      3300,
    );
  }
  return { notify };
}
