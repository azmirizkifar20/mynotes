const DAY = 24 * 60 * 60 * 1000;
const WIB = 7 * 60 * 60 * 1000;

function nextMidnight(now) {
  return Math.floor((now + WIB) / DAY) * DAY + DAY - WIB;
}

function sessionDeadline(session, now = Date.now()) {
  const issued = session.authIssuedAt ?? session.authAt;
  if (!Number.isFinite(issued) || issued <= 0 || issued > now) return 0;
  const deadline = nextMidnight(issued);
  if (session.authExpiresAt !== undefined && session.authExpiresAt !== deadline) return 0;
  return deadline > now ? deadline : 0;
}

function boundCookie(session, deadline) {
  session.cookie.maxAge = deadline - Date.now();
  const touch = session.touch;
  // express-session touches again at response time; keep the calendar deadline absolute.
  Object.defineProperty(session, "touch", { configurable: true, value() {
    touch.call(this);
    this.cookie.expires = new Date(deadline);
    return this;
  } });
}

module.exports = { nextMidnight, sessionDeadline, boundCookie };
