const path = require("node:path");

function validPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.length > 2000 ||
    /[\\\x00-\x1f]/.test(value)
  )
    return false;
  if (value === "/") return true;
  const parts = value.split("/").slice(1);
  return (
    !["api", "static", "share", "media", "mynotes"].includes(
      parts[0].toLowerCase(),
    ) &&
    parts.every(
      (part) =>
        part &&
        Buffer.byteLength(part) <= 255 &&
        !part.startsWith(".") &&
        !/[<>:"|?*]/.test(part) &&
        !/[. ]$/.test(part) &&
        !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part),
    )
  );
}
const parentPath = (key) => path.posix.dirname(key);
const hiddenFromListing = (key) => /^\/(steering|superpowers)(\/|$)/i.test(key);
module.exports = { validPath, parentPath, hiddenFromListing };
