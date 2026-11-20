module.exports = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (
    req.get("origin") &&
    req.get("origin") !== `${req.protocol}://${req.get("host")}`
  ) {
    return res
      .status(403)
      .json({ success: false, message: "Asal request tidak diizinkan" });
  }
  next();
};
