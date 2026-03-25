function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    req.negocioId = req.session.negocioId != null ? req.session.negocioId : 1;
    return next();
  }
  res.redirect('/login');
}

function requireGuest(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = {
  requireAuth,
  requireGuest
};
