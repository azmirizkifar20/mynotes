const { asyncRoute } = require("../../rendering/http");
const sticky = require("./service");

module.exports = function register(api) {
  api.get("/sticky-notes", asyncRoute(async (req, res) =>
    res.json({ success: true, board: await sticky.list() }),
  ));
  api.post("/sticky-notes", asyncRoute(async (req, res) =>
    res.json({ success: true, board: await sticky.save(req.body, req.ip) }),
  ));
};
