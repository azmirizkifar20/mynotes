const db = require("../../database");
const { validPath } = require("../documents/paths");
const { uuid, asyncRoute } = require("../../rendering/http");
module.exports = function register(api, { documentData }) {
  api.get(
    "/workspace",
    asyncRoute(async (req, res) =>
      res.json({
        success: true,
        pages: await db.workspace(),
        preferences: await db.preferences(),
      }),
    ),
  );
  api.get(
    "/preferences",
    asyncRoute(async (req, res) =>
      res.json({ success: true, preferences: await db.preferences() }),
    ),
  );
  api.post(
    "/preferences",
    asyncRoute(async (req, res) => {
      const { action } = req.body;
      if (action === "theme") {
        if (!["system", "light", "dark"].includes(req.body.value))
          throw db.fail(400, "Tema tidak valid.");
        await db.query(
          "INSERT INTO mdpreview.settings(key,value) VALUES('theme',$1) ON CONFLICT(key) DO UPDATE SET value=$1",
          [JSON.stringify(req.body.value)],
        );
      } else if (action === "favorite" || action === "opened") {
        const id = req.body.id === "home" ? db.ROOT_ID : req.body.id;
        if (
          !uuid(id) ||
          (action === "favorite" && typeof req.body.value !== "boolean")
        )
          throw db.fail(400, "Preferensi tidak valid.");
        if (action === "favorite")
          await db.query(
            "UPDATE mdpreview.entries SET favorite=$2 WHERE id=$1 AND deleted_at IS NULL",
            [id, req.body.value],
          );
        else
          await db.query(
            "UPDATE mdpreview.entries SET opened_at=now() WHERE id=$1 AND kind IN ('doc','pdf') AND deleted_at IS NULL",
            [id],
          );
      } else throw db.fail(400, "Aksi preferensi tidak valid.");
      res.json({ success: true, preferences: await db.preferences() });
    }),
  );
  api.post(
    "/preferences/import",
    asyncRoute(async (req, res) => {
      const favorites = req.body.favorites,
        recent = req.body.recent;
      if (
        !Array.isArray(favorites) ||
        !Array.isArray(recent) ||
        favorites.length > 1000 ||
        recent.length > 1000 ||
        ![...favorites, ...recent].every(validPath)
      )
        throw db.fail(400, "Preferensi browser tidak valid.");
      await db.transaction(async (client) => {
        if (
          (
            await client.query(
              "SELECT 1 FROM mdpreview.settings WHERE key='preferences_imported'",
            )
          ).rowCount
        )
          return;
        await client.query(
          "UPDATE mdpreview.entries SET favorite=true WHERE path=ANY($1::text[]) AND deleted_at IS NULL",
          [favorites],
        );
        for (const [index, key] of recent.entries())
          await client.query(
            "UPDATE mdpreview.entries SET opened_at=now()-($2::integer * interval '1 second') WHERE path=$1 AND deleted_at IS NULL AND kind IN ('doc','pdf')",
            [key, index],
          );
        await client.query(
          "INSERT INTO mdpreview.settings VALUES('preferences_imported','true')",
        );
      });
      res.json({ success: true, preferences: await db.preferences() });
    }),
  );
};
