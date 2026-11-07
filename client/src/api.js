/**
 * Todas las llamadas al servidor están acá.
 * Cada función devuelve los datos, o lanza un ErrorApi con un mensaje listo para mostrarle al usuario.
 * La sesión la guarda y renueva Supabase Auth (ver supabase.js); acá sólo se adjunta el token.
 */
import { supabase, tokenActual } from './supabase';

export class ErrorApi extends Error {
  constructor(mensaje, estado = 0, detalle = null) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.detalle = detalle;
  }
}

/**
 * auth: true  → exige sesión (si el servidor responde 401 se cierra la sesión)
 *       'opcional' → manda el token si existe, pero no pasa nada si falta o venció
 */
async function pedir(metodo, ruta, { cuerpo, crudo, tipo, auth = false, token, signal } = {}) {
  const headers = {};
  const guardado = token || (auth ? await tokenActual() : '');
  if (guardado) headers.Authorization = `Bearer ${guardado}`;
  let body;
  if (crudo) {
    body = crudo;
    headers['Content-Type'] = tipo;
  } else if (cuerpo !== undefined) {
    body = JSON.stringify(cuerpo);
    headers['Content-Type'] = 'application/json';
  }

  let respuesta;
  try {
    respuesta = await fetch(ruta, { method: metodo, headers, body, signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ErrorApi('No pudimos conectarnos. Revisá tu conexión a internet y probá de nuevo.');
  }

  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch (_) {
    /* respuesta que no es JSON */
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401 && auth === true && !token) {
      // La sesión ya no vale (vencida, revocada o cuenta desactivada): se cierra en este navegador
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      window.dispatchEvent(new Event('portfolio:sesion-vencida'));
    }
    throw new ErrorApi(datos?.error || 'Ocurrió un error. Probá de nuevo en unos minutos.', respuesta.status, datos?.detalle);
  }
  return datos;
}

const qs = (parametros = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(parametros)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  // ── Público ──
  sitio: () => pedir('GET', '/api/sitio'),
  portfolio: (signal) => pedir('GET', '/api/portfolio', { auth: 'opcional', signal }),
  github: () => pedir('GET', '/api/github'),
  clima: () => pedir('GET', '/api/clima'),
  contacto: (datos) => pedir('POST', '/api/contacto', { cuerpo: datos, auth: 'opcional' }),
  visita: (ruta) => pedir('POST', '/api/visitas', { cuerpo: { ruta }, auth: 'opcional' }),

  // ── Cuenta ──
  registro: (datos) => pedir('POST', '/api/auth/registro', { cuerpo: datos }),
  login: (datos) => pedir('POST', '/api/auth/login', { cuerpo: datos }),
  acceso: (metodo, token) => pedir('POST', '/api/auth/acceso', { cuerpo: { metodo }, ...(token ? { token } : { auth: true }) }),
  yo: (token) => pedir('GET', '/api/auth/yo', token ? { token } : { auth: true }),

  // ── Proyectos (sólo registrados) ──
  proyecto: (slug) => pedir('GET', `/api/proyectos/${encodeURIComponent(slug)}`, { auth: true }),

  // ── Panel: consultas (operador y administrador) ──
  consultas: {
    resumen: () => pedir('GET', '/api/admin/consultas/resumen', { auth: true }),
    listar: (filtros) => pedir('GET', `/api/admin/consultas${qs(filtros)}`, { auth: true }),
    obtener: (id) => pedir('GET', `/api/admin/consultas/${id}`, { auth: true }),
    estado: (id, estado) => pedir('PATCH', `/api/admin/consultas/${id}/estado`, { cuerpo: { estado }, auth: true }),
    notas: (id, notas_internas) => pedir('PATCH', `/api/admin/consultas/${id}/notas`, { cuerpo: { notas_internas }, auth: true }),
    responder: (id, datos) => pedir('POST', `/api/admin/consultas/${id}/responder`, { cuerpo: datos, auth: true }),
  },

  // ── Panel: administrador ──
  metricas: {
    resumen: () => pedir('GET', '/api/admin/metricas/resumen', { auth: true }),
    series: (p) => pedir('GET', `/api/admin/metricas/series${qs(p)}`, { auth: true }),
    consultas: (p) => pedir('GET', `/api/admin/metricas/consultas${qs(p)}`, { auth: true }),
  },
  servicios: {
    listar: () => pedir('GET', '/api/admin/servicios', { auth: true }),
    crear: (d) => pedir('POST', '/api/admin/servicios', { cuerpo: d, auth: true }),
    editar: (id, d) => pedir('PUT', `/api/admin/servicios/${id}`, { cuerpo: d, auth: true }),
    borrar: (id) => pedir('DELETE', `/api/admin/servicios/${id}`, { auth: true }),
  },
  proyectos: {
    listar: () => pedir('GET', '/api/admin/proyectos', { auth: true }),
    obtener: (id) => pedir('GET', `/api/admin/proyectos/${id}`, { auth: true }),
    crear: (d) => pedir('POST', '/api/admin/proyectos', { cuerpo: d, auth: true }),
    editar: (id, d) => pedir('PUT', `/api/admin/proyectos/${id}`, { cuerpo: d, auth: true }),
    borrar: (id) => pedir('DELETE', `/api/admin/proyectos/${id}`, { auth: true }),
    crearDemo: (proyectoId, d) => pedir('POST', `/api/admin/proyectos/${proyectoId}/demos`, { cuerpo: d, auth: true }),
    editarDemo: (id, d) => pedir('PUT', `/api/admin/demos/${id}`, { cuerpo: d, auth: true }),
    borrarDemo: (id) => pedir('DELETE', `/api/admin/demos/${id}`, { auth: true }),
  },
  subirImagen: (blob) => pedir('POST', '/api/admin/imagenes', { crudo: blob, tipo: blob.type, auth: true }),
  usuarios: {
    listar: (filtros) => pedir('GET', `/api/admin/usuarios${qs(filtros)}`, { auth: true }),
    obtener: (id) => pedir('GET', `/api/admin/usuarios/${id}`, { auth: true }),
    crear: (d) => pedir('POST', '/api/admin/usuarios', { cuerpo: d, auth: true }),
    editar: (id, d) => pedir('PATCH', `/api/admin/usuarios/${id}`, { cuerpo: d, auth: true }),
    borrar: (id) => pedir('DELETE', `/api/admin/usuarios/${id}`, { auth: true }),
  },
};
