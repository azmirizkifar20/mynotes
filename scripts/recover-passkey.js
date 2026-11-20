const { randomBytes } = require("node:crypto");
const { initialize, pool, query } = require("../src/backend/database");
const { hash } = require("../src/backend/modules/auth/store");
const { authURL } = require("../src/backend/modules/auth/config");
const { audit } = require("../src/backend/database/audit");
async function main() {
  await initialize();
  const token = randomBytes(32).toString("hex");
  await query(
    "INSERT INTO mdpreview.settings(key,value) VALUES('auth_recovery',$1) ON CONFLICT(key) DO UPDATE SET value=$1",
    [
      JSON.stringify({
        hash: hash(token),
        expires: Date.now() + 15 * 60 * 1000,
      }),
    ],
  );
  await audit("PASSKEY_RECOVERY", "Token pemulihan diterbitkan melalui CLI");
  console.log(
    "Buka URL privat ini untuk mendaftarkan passkey pengganti (sekali pakai, berlaku 15 menit):",
  );
  console.log(authURL + "/?auth=1#recovery=" + token);
  console.log(
    "Jangan bagikan URL ini. Passkey dan dokumen yang ada tetap tersimpan.",
  );
}
main()
  .catch((error) => {
    console.error("Pemulihan gagal:", error.code || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
