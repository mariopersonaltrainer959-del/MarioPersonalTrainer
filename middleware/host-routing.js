const { adminHostConfigured, isAdminHost, getAdminHostname } = require('../utils/site-hosts');

/**
 * Con ADMIN_HOST definido:
 * - Sitio público: solo landing, APIs públicas, feedback, reservas (sin /login ni /dashboard).
 * - Host admin: / redirige a /login; login y panel solo aquí.
 */
function hostRouting(req, res, next) {
  if (!adminHostConfigured()) {
    return next();
  }

  const admin = isAdminHost(req);
  const path = req.path || '';
  const method = req.method || 'GET';

  if (admin) {
    if (path === '/' || path === '') {
      return res.redirect(302, '/login');
    }
    return next();
  }

  // Sitio público: no exponer panel ni login en el dominio principal
  const staffPaths = ['/login', '/setup', '/reset-password'];
  const isStaffPath =
    staffPaths.includes(path) ||
    path.startsWith('/dashboard') ||
    path.startsWith('/api/setup') ||
    path === '/api/check-users';

  if (!isStaffPath) {
    return next();
  }

  if (method === 'POST' && (path === '/login' || path.startsWith('/api/setup'))) {
    return res.status(403).json({
      error: 'Usa el subdominio de administración (panel) para esta acción.'
    });
  }

  const proto = (req.get('x-forwarded-proto') || 'https').split(',')[0].trim();
  const host = getAdminHostname();
  const tail = req.originalUrl || path;
  return res.redirect(302, `${proto}://${host}${tail}`);
}

module.exports = { hostRouting };
