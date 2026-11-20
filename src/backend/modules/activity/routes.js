const db = require("../../database");
const { asyncRoute } = require("../../rendering/http");
module.exports = function register(api, { documentData }) {
  api.get(
    "/activity",
    asyncRoute(async (req, res) =>
      res.json({
        success: true,
        items: (
          await db.query(
            "SELECT action,detail,created_at FROM mdpreview.audit ORDER BY id DESC LIMIT 100",
          )
        ).rows,
      }),
    ),
  );
};
