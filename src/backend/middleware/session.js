const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const { pool } = require("../database/connection");
const env = require("../config/env");
module.exports = session({
  store: new PgSession({
    pool,
    schemaName: "mdpreview",
    tableName: "sessions",
  }),
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: false,
  name: "mdprev.sid",
  cookie: {
    httpOnly: true,
    secure: env.production || "auto",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  },
});
