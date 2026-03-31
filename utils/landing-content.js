/**
 * Contenido por defecto de la landing (Mario Personal Trainer, Estepona) y fusión con lo guardado en BD.
 * Los campos que no existan en BD se rellenan con estos valores (SEO incluido).
 */

const DEFAULT_LANDING = {
  hero_title: 'Mario Personal Trainer | Entrenamiento personal en Estepona',
  hero_subtitle:
    'Planes de entrenamiento a medida y seguimiento personalizado en Estepona (Málaga). Reserva tu sesión online y avanza hacia tus objetivos de salud, fuerza y rendimiento.',
  hero_image_url: '',
  about_title: 'Entrenamiento personal en Estepona',
  about_text:
    'Soy Mario, entrenador personal en Estepona. Trabajo contigo con un plan adaptado a tu nivel y a tus metas: pérdida de grasa, ganancia muscular, salud o rendimiento deportivo. La primera sesión sirve para conocernos, valorar tu punto de partida y definir el camino. Reserva tu cita aquí y recibirás confirmación por email.',
  about_image_url: '',
  cta_text: 'Reservar sesión',
  sections: [],
  seo_meta_title: 'Mario Personal Trainer Estepona | Entrenamiento personal y reserva online',
  seo_meta_description:
    'Entrenador personal en Estepona (Málaga). Sesiones personalizadas: pérdida de peso, fuerza, salud y rendimiento. Reserva tu cita online de forma sencilla.',
  seo_keywords:
    'entrenador personal Estepona, personal trainer Estepona, entrenamiento Estepona, fitness Estepona, entrenador Estepona Costa del Sol',
  seo_canonical_url: '',
  seo_og_image_url: ''
};

function mergeLandingDefaults(stored) {
  const s = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  const out = { ...DEFAULT_LANDING };
  for (const k of Object.keys(DEFAULT_LANDING)) {
    if (Object.prototype.hasOwnProperty.call(s, k) && s[k] !== undefined) {
      out[k] = s[k];
    }
  }
  for (const k of Object.keys(s)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_LANDING, k)) {
      out[k] = s[k];
    }
  }
  if (!Array.isArray(out.sections)) out.sections = [];
  return out;
}

function mergeLandingDefaultsFromContentString(contentStr) {
  if (!contentStr) return { ...DEFAULT_LANDING };
  try {
    const parsed = typeof contentStr === 'string' ? JSON.parse(contentStr) : contentStr;
    return mergeLandingDefaults(parsed);
  } catch {
    return { ...DEFAULT_LANDING };
  }
}

module.exports = {
  DEFAULT_LANDING,
  mergeLandingDefaults,
  mergeLandingDefaultsFromContentString
};
