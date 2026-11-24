const { asyncRoute } = require("../../rendering/http");
const board = require("./service");

module.exports = function register(api) {
  api.get("/task-board/documents/:id/open", asyncRoute(async (req, res) => {
    const path = await board.mentionedDocument(req.params.id);
    res.redirect(302, req.baseUrl.replace(/\/api$/, "") + path.split("/").map(encodeURIComponent).join("/"));
  }));
  api.get("/task-board/documents", asyncRoute(async (req, res) =>
    res.json({ success: true, items: await board.suggestDocuments(req.query.q) }),
  ));
  api.get("/task-board", asyncRoute(async (req, res) =>
    res.json({ success: true, board: await board.list() }),
  ));
  for (const [path, mutation] of [
    ["tasks/save", board.saveTask], ["tasks/delete", board.removeTask],
    ["tasks/archive", board.archiveTask], ["tasks/restore", board.restoreTask],
    ["statuses/save", board.saveStatuses],
    ["tags/save", board.saveTags],
  ]) api.post("/task-board/" + path, asyncRoute(async (req, res) =>
    res.json({ success: true, ...await mutation(req.body, req.ip) }),
  ));
};
