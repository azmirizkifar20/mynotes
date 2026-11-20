const bcrypt = require("bcrypt");
const { accessCodeHash } = require("../../config/env");
module.exports = { verifyCode: (code) => bcrypt.compare(code, accessCodeHash) };
