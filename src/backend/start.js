const app = require("./app");
const db = require("./database");
const mirror = require("./modules/documents/mirror");
const attachments = require("./modules/task-board/attachment-storage");
const { port: PORT, host: HOST } = require("./config/env");
async function start() {
  await db.initialize();
  await db.ready();
  await mirror.sync();
  mirror.start();
  attachments.start();
  const server = app.listen(PORT, HOST, () =>
    console.log("MD Previewer ready on " + HOST + ":" + PORT),
  );
  async function stop() {
    attachments.stop();
    server.close(async () => {
      await db.pool.end();
      process.exit(0);
    });
  }
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
start().catch((error) => {
  console.error("Startup failed:", error.code || error.message);
  db.pool.end().finally(() => {
    process.exitCode = 1;
  });
});
