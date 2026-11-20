export function readPreference(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}
export function createState(boot) {
  const pages = boot.pages || [];
  let themePreference = "system";
  try {
    const saved = localStorage.getItem("md-previewer-theme");
    if (["system", "light", "dark"].includes(saved)) themePreference = saved;
  } catch {}
  return {
    boot,
    basePath: boot.basePath || "",
    pages,
    themePreference,
    current: "home",
    filter: "all",
    editing: false,
    createType: "doc",
    sharingId: null,
    navigationSequence: 0,
    navigationPending: 0,
    saving: false,
    manageId: null,
    activeUrl: location.pathname + location.search,
    deletion: null,
    pendingUpload: null,
    fileDragDepth: 0,
    recent: readPreference("md-previewer-recent").filter((id) =>
      pages.some((p) => p.id === id && p.type === "doc"),
    ),
    favorites: new Set(
      readPreference("md-previewer-favorites").filter((id) =>
        pages.some((p) => p.id === id),
      ),
    ),
    toastTimer: null,
    loginFields: `<label class="field-label" for="access-code">Kode akses</label><input class="text-input" id="access-code" name="code" type="password" required autocomplete="current-password" placeholder="Masukkan kode akses"><p class="form-error" role="alert"></p><button class="small-button primary" type="submit">Buka workspace</button>`,
    draftState: null,
    draftTimer: null,
    draftRequest: null,
    toolBusy: false,
    searchSequence: 0,
    searchTimer: null,
    availableTemplates: [],
    selectedVersion: null,
    managementPages: {
      trash: {
        title: "Sampah",
        icon: "trash",
        description:
          "Pulihkan item yang dihapus atau hapus secara permanen. File di sini tidak dapat dibuka melalui link publik.",
      },
      templates: {
        title: "Template",
        icon: "doc",
        description: "Kelola template untuk membuat dokumen baru.",
      },
      activity: {
        title: "Aktivitas",
        icon: "clock",
        description: "Riwayat perubahan dan aktivitas di workspace.",
      },
    },
    documentBuffer: null,
    liveEditor: null,
    liveEditorReady: false,
    liveEditorTouched: false,
    liveEditorGeneration: 0,
  };
}
