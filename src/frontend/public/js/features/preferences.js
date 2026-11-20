import { readPreference } from "../core/state.js";

export function createFeature({ state, actions }) {
  function persistNavigation() {
    try {
      localStorage.setItem("md-previewer-recent", JSON.stringify(state.recent));
      localStorage.setItem(
        "md-previewer-favorites",
        JSON.stringify([...state.favorites]),
      );
    } catch {}
  }

  function applyPreferences(preferences = {}) {
    state.recent = (preferences.recent || []).filter((id) =>
      state.pages.some((page) => page.id === id),
    );
    state.favorites.clear();
    (preferences.favorites || []).forEach((id) => state.favorites.add(id));
    if (preferences.theme && preferences.theme !== state.themePreference)
      actions.setTheme(preferences.theme, false);
    actions.renderFavorites();
    syncFavorite();
  }

  async function savePreference(body) {
    try {
      applyPreferences((await actions.api("preferences", body)).preferences);
    } catch (error) {
      actions.notify("Preferensi belum tersimpan: " + error.message);
    }
  }

  async function setFavorite(id, value) {
    try {
      applyPreferences(
        (await actions.api("preferences", { action: "favorite", id, value }))
          .preferences,
      );
      actions.$("favorite-button").focus({ preventScroll: true });
    } catch (error) {
      actions.notify(error.message);
    }
  }

  function removeFavorite(id) {
    setFavorite(id, false);
  }

  function syncFavorite() {
    const active = state.favorites.has(state.current);
    actions.$("favorite-button").classList.toggle("is-favorite", active);
    actions.$("favorite-button").setAttribute("aria-pressed", active);
    actions
      .$("favorite-button")
      .setAttribute(
        "aria-label",
        active ? "Hapus dari favorit" : "Tambah ke favorit",
      );
    actions.$("favorite-button").title = active
      ? "Hapus dari favorit"
      : "Tambah ke favorit";
  }

  function toggleFavorite() {
    if (state.current === "recent")
      return actions.notify("Buka halaman atau folder untuk menambah favorit.");
    setFavorite(state.current, !state.favorites.has(state.current));
  }

  function oldPreferencePath(id) {
    if (id === "home") return "/";
    if (!id.startsWith("p-"))
      return state.pages.find((page) => page.id === id)?.path;
    try {
      return new TextDecoder().decode(
        Uint8Array.from(
          atob(id.slice(2).replace(/-/g, "+").replace(/_/g, "/")),
          (char) => char.charCodeAt(0),
        ),
      );
    } catch {
      return null;
    }
  }

  async function importBrowserPreferences() {
    try {
      const favorites = readPreference("md-previewer-favorites")
        .map(oldPreferencePath)
        .filter(Boolean);
      const recent = readPreference("md-previewer-recent")
        .map(oldPreferencePath)
        .filter(Boolean);
      applyPreferences(
        (await actions.api("preferences/import", { favorites, recent }))
          .preferences,
      );
      actions.$("import-preferences").hidden = true;
      actions.notify("Favorit dan riwayat browser digabungkan ke workspace.");
    } catch (error) {
      actions.notify(error.message);
    }
  }
  return {
    persistNavigation,
    applyPreferences,
    savePreference,
    setFavorite,
    removeFavorite,
    syncFavorite,
    toggleFavorite,
    oldPreferencePath,
    importBrowserPreferences,
  };
}
