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
  name: "mdprev.sid",
  cookie: {
    httpOnly: true,
    secure: env.production,
    sameSite: "strict",
    maxAge: 30 * 60 * 1000,
  },
});
