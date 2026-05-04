/**
 * Dominio público (landing + reservas) vs subdominio admin (login y panel).
 * Activo solo si existe ADMIN_HOST (hostname del panel, ej. admin.marioentrenadorpersonal.pro).
 */

function adminHostConfigured() {
  return !!(process.env.ADMIN_HOST && String(process.env.ADMIN_HOST).trim());
}

function normalizeHost(host) {
  if (!host) return '';
  return String(host).split(':')[0].trim().toLowerCase();
}

function getAdminHostname() {
  return normalizeHost(process.env.ADMIN_HOST);
}

function isAdminHost(req) {
  if (!adminHostConfigured()) return true;
  return normalizeHost(req.hostname) === getAdminHostname();
}

/**
 * Base URL para OAuth Google Calendar (debe coincidir con el redirect registrado en Google Cloud).
 * Con panel en subdominio admin: https://admin.tudominio.com
 */
function getOAuthRedirectBase() {
  const explicit = (process.env.ADMIN_BASE_URL || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const ah = getAdminHostname();
  if (ah) return `https://${ah}`;
  return (process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * URL del sitio público (enlaces en emails a clientes: feedback, etc.).
 * Si usas ADMIN_HOST tipo admin.ejemplo.com y no defines PUBLIC_SITE_URL, se asume https://ejemplo.com
 */
function getPublicSiteBaseUrl() {
  const pub = (process.env.PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (pub) return pub;
  const fe = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  if (fe) return fe;
  const ah = getAdminHostname();
  if (ah && ah.startsWith('admin.')) {
    return `https://${ah.slice('admin.'.length)}`;
  }
  return (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

module.exports = {
  adminHostConfigured,
  isAdminHost,
  getAdminHostname,
  getOAuthRedirectBase,
  getPublicSiteBaseUrl
};
