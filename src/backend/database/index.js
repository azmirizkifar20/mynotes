module.exports = {
  ...require("./connection"),
  ...require("./initialize"),
  ...require("./audit"),
  ...require("../modules/documents/service"),
  ...require("../modules/documents/trash"),
  ...require("../modules/workspace/service"),
};
