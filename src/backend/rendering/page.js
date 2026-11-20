function renderPage(res, bootstrap, status = 200) {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "same-origin");
  return res.status(status).render("layout", {
    bootstrap: JSON.stringify({
      ...bootstrap,
      basePath: res.locals.basePath,
      editorVersion: res.app.locals.editorVersion,
    }).replace(/</g, "\\u003c"),
  });
}
module.exports = renderPage;
