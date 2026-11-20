export function createFeature({ state, actions }) {
  function setTheme(preference, persist = true) {
    if (!["system", "light", "dark"].includes(preference)) return;
    state.themePreference = preference;
    applyTheme();
    actions.$("theme-select").value = preference;
    if (actions.$("visitor-theme"))
      actions.$("visitor-theme").value = preference;
    try {
      localStorage.setItem("md-previewer-theme", preference);
    } catch {
      actions.notify(
        "Tema diganti. Browser ini tidak mengizinkan penyimpanan preferensi.",
      );
    }
    if (persist && state.boot.mode === "workspace")
      actions.savePreference({ action: "theme", value: preference });
  }

  function applyTheme() {
    document.documentElement.dataset.theme =
      state.themePreference === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : state.themePreference;
  }
  return { setTheme, applyTheme };
}
