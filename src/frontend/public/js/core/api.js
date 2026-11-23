export function createFeature({ state, actions }) {
  async function api(endpoint, body) {
    const options =
      body instanceof FormData
        ? { method: "POST", body }
        : body === undefined
          ? {}
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            };
    const response = await fetch(actions.appUrl("/api/" + endpoint), options);
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      if (
        response.status === 401 &&
        state.boot.mode === "workspace" &&
        !actions.$("auth-dialog").open
      )
        actions.$("auth-dialog").showModal();
      const error = new Error(result.message || "Request gagal. Coba lagi.");
      error.status = response.status;
      error.requiresConfirm = result.requiresConfirm;
      error.mentionImpact = result.mentionImpact;
      error.conflict = result.conflict;
      throw error;
    }
    return result;
  }
  return { api };
}
