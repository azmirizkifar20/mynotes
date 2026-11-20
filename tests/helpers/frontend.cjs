const path = require("node:path");
const { pathToFileURL } = require("node:url");
async function loadFrontend(files) {
  const entries = await Promise.all(
    Object.entries(files).map(async ([name, file]) => [
      name,
      await import(
        pathToFileURL(
          path.resolve(__dirname, "../../src/frontend/public/js", file),
        ).href
      ),
    ]),
  );
  return Object.fromEntries(entries);
}
module.exports = { loadFrontend };
