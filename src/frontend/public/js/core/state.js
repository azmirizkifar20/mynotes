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
      pages.some((p) => p.id === id && ["doc", "pdf"].includes(p.type)),
    ),
    favorites: new Set(
      readPreference("md-previewer-favorites").filter((id) =>
        pages.some((p) => p.id === id),
      ),
    ),
    toastTimer: null,
    loginFields: '<p role="status">Memuat metode masuk…</p>',
    authStatus: null,
    authBusy: false,
    authCancel: null,
    authPopup: null,
    authFragmentsRead: false,
    authBridgeToken: null,
    authRecoveryToken: null,
    passkeySetupReady: false,
    draftState: null,
    draftTimer: null,
    draftRequest: null,
    toolBusy: false,
    taskBoardDirty: false,
    searchSequence: 0,
    searchTimer: null,
    availableTemplates: [],
    selectedVersion: null,
    managementPages: {
      tasks: {
        title: "Task board",
        icon: "board",
        description: "Dari catatan jadi tindakan. Satu papan untuk pekerjaanmu.",
      },
      passkeys: {
        title: "Keamanan",
        icon: "lock",
        description:
          "Kelola passkey untuk masuk ke workspace dari kedua alamat.",
      },
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
    imageUploading: false,
    liveEditorTouched: false,
    liveEditorGeneration: 0,
  };
}
