import app from "./application";
import db from "./database";
import mirror from "./modules/documents/mirror";
import attachments from "./modules/task-board/attachment-storage";
import { port as PORT, host as HOST } from "./config/env";
export async function start() {
  await db.initialize();
  await db.ready();
  await mirror.sync();
  mirror.start();
  attachments.start();
  const server = app.listen(Number(PORT), HOST, () =>
    console.log("Ruangku ready on " + HOST + ":" + PORT),
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
  return server;
}
export function startupFailed(error: Error & { code?: string }) {
  console.error("Startup failed:", error.code || error.message);
  db.pool.end().finally(() => {
    process.exitCode = 1;
  });
}
