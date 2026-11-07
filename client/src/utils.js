export const cx = (...clases) => clases.filter(Boolean).join(' ');

const ZONA_POR_DEFECTO = 'America/Argentina/Salta';

export function fecha(valor, { hora = false } = {}) {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: hora ? undefined : 'numeric',
    hour: hora ? '2-digit' : undefined,
    minute: hora ? '2-digit' : undefined,
    hour12: false,
    timeZone: ZONA_POR_DEFECTO,
  }).format(d);
}

export function fechaLarga(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeStyle: 'short', timeZone: ZONA_POR_DEFECTO }).format(d);
}

/** "AAAA-MM-DD" de hoy (o de hace N días) en la zona del sitio. */
export function diaIso(restarDias = 0) {
  const d = new Date(Date.now() - restarDias * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_POR_DEFECTO }).format(d);
}

export const iniciales = (nombre = '') =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';

export function slugDe(texto = '') {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ── Validaciones del lado del navegador (el servidor valida de nuevo todo) ──
export const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const validar = {
  texto(valor, nombre, { min = 1, max = 255 } = {}) {
    const v = String(valor ?? '').trim();
    if (v.length < min) return min <= 1 ? `${nombre} es obligatorio.` : `${nombre} tiene que tener al menos ${min} caracteres.`;
    if (v.length > max) return `${nombre} no puede superar los ${max} caracteres.`;
    return '';
  },
  email(valor) {
    const v = String(valor ?? '').trim();
    if (!v) return 'El email es obligatorio.';
    if (!RE_EMAIL.test(v)) return 'Ese email no parece válido.';
    return '';
  },
  telefono(valor) {
    const v = String(valor ?? '').trim();
    if (!v) return '';
    if (!/^[0-9+()\-\s.]{6,25}$/.test(v)) return 'El teléfono sólo puede tener números, espacios, + ( ) y guiones.';
    return '';
  },
  password(valor) {
    const v = String(valor ?? '');
    if (v.length < 8) return 'La contraseña tiene que tener al menos 8 caracteres.';
    if (v.length > 200) return 'La contraseña es demasiado larga.';
    return '';
  },
  urlHttps(valor, nombre, { obligatorio = false } = {}) {
    const v = String(valor ?? '').trim();
    if (!v) return obligatorio ? `${nombre} es obligatorio.` : '';
    try {
      const u = new URL(v);
      if (u.protocol !== 'https:') return `${nombre} tiene que empezar con https://`;
    } catch (_) {
      return `${nombre} no es un link válido.`;
    }
    return '';
  },
};

/** Devuelve el primer error de un objeto { campo: mensaje } o '' si no hay ninguno. */
export const hayErrores = (errores) => Object.values(errores).some(Boolean);
