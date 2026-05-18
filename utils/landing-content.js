/**
 * Contenido por defecto de la landing (Mario Personal Trainer, Estepona) y fusión con lo guardado en BD.
 * Los campos que no existan en BD se rellenan con estos valores (SEO incluido).
 */

const DEFAULT_LANDING = {
  hero_title: 'Entrenamiento personal dedicado a tu salud y rendimiento',
  hero_subtitle:
    'Soy Mario, entrenador personal en Estepona. Trabajo contigo con un plan adaptado a tu nivel y a tus metas: pérdida de grasa, fuerza, salud y rendimiento deportivo.\n\nReserva tu entreno online y recibirás confirmación por email.',
  hero_image_url: '',
  about_title: 'Nuestra forma de trabajar',
  about_text:
    'Cada persona es distinta. Por eso diseño sesiones personalizadas, con seguimiento cercano y objetivos claros. Ya sea tu primera vez en el gimnasio o quieras dar un salto de rendimiento, te acompaño paso a paso en Global Salud (Estepona).',
  about_image_url: '/images/foto-mario.png',
  cta_text: 'Reservar entreno',
  contact_address_line1: 'C/ Eslovenia, 5',
  contact_address_line2: '29680 Estepona, Málaga',
  maps_query: 'C/ Eslovenia, 5, 29680 Estepona, Málaga',
  sections: [
    { title: 'Entrenamiento personal', text: 'Sesiones 1 a 1 adaptadas a tu nivel, técnica y objetivos reales.' },
    { title: 'Pérdida de grasa', text: 'Plan de fuerza y hábitos para mejorar tu composición corporal de forma sostenible.' },
    { title: 'Fuerza y rendimiento', text: 'Progresión en cargas y movimientos para rendir mejor dentro y fuera del gimnasio.' }
  ],
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
      const v = s[k];
      if (k === 'about_image_url' && (v === '' || v == null)) continue;
      out[k] = v;
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
