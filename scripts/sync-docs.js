const db = require("../src/backend/database");
const mirror = require("../src/backend/modules/documents/mirror");
mirror
  .sync()
  .then((count) =>
    console.log("Document mirror synchronized:", count, "entries."),
  )
  .catch((error) => {
    console.error("Mirror sync failed:", error.code || error.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
