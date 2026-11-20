function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res
    .status(401)
    .json({ success: false, message: "Sesi tidak valid, silakan login ulang" });
}
module.exports = requireAuth;
