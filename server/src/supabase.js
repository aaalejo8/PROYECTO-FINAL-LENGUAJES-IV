'use strict';
/**
 * Clientes de Supabase del servidor.
 *
 *   · publico          → clave pública (anon/publishable). Lo que puede ver cualquier visitante.
 *   · deUsuario(token) → clave pública + el token del usuario: la base aplica Row Level Security
 *                        con SU identidad y SU rol. Es el que se usa en casi todas las rutas.
 *   · admin            → clave service_role. Saltea RLS, por eso sólo se usa para lo que ningún
 *                        usuario debería poder hacer directo (guardar consultas, contar visitas,
 *                        administrar cuentas de Supabase Auth). NUNCA sale del servidor.
 */
const { createClient } = require('@supabase/supabase-js');
const config = require('./config');
const { ErrorHttp } = require('./errores');

const opciones = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

const publico = createClient(config.supabase.url, config.supabase.anonKey, opciones);
const admin = createClient(config.supabase.url, config.supabase.serviceKey, opciones);

/** Cliente que actúa como el usuario dueño del token (RLS con su rol). */
function deUsuario(token) {
  return createClient(config.supabase.url, config.supabase.anonKey, {
    ...opciones,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** Cliente "limpio" para operaciones de Auth que crean una sesión (registro / login). */
const paraAuth = () => createClient(config.supabase.url, config.supabase.anonKey, opciones);

/**
 * Traduce los errores de PostgREST / PostgreSQL a errores HTTP con mensajes para el usuario.
 * Los mensajes que levantan nuestras funciones (RAISE ... P0001 / 22023 / 42501) se muestran tal cual.
 */
function traducir(error, { conflicto = 'Ese registro ya existe.', noEncontrado } = {}) {
  if (!error) return null;
  if (error instanceof ErrorHttp) return error;
  const codigo = error.code || '';
  if (codigo === '23505') return new ErrorHttp(409, conflicto);
  if (codigo === 'P0001' || codigo === '22023') return new ErrorHttp(codigo === 'P0001' ? 409 : 400, error.message);
  if (codigo === '42501' || /row-level security/i.test(error.message || '')) {
    return new ErrorHttp(403, codigo === '42501' && error.message && !/row-level|permission denied/i.test(error.message) ? error.message : 'No tenés permiso para hacer esto.');
  }
  if (codigo === '23514' || codigo === '22P02' || codigo === '23502') return new ErrorHttp(400, 'Algún dato no es válido. Revisá el formulario.');
  if (codigo === '23503') return new ErrorHttp(409, 'Ese registro está relacionado con otros datos.');
  if (codigo === 'PGRST116' && noEncontrado) return new ErrorHttp(404, noEncontrado);
  console.error('[Supabase]', codigo, error.message, error.details || '');
  return new ErrorHttp(502, 'No pudimos comunicarnos con la base de datos. Probá de nuevo en unos minutos.');
}

/**
 * Espera la respuesta de Supabase y devuelve `data`, o lanza el ErrorHttp correspondiente.
 *   const fila = await datos(db.from('x').select().eq('id', 1).single(), { noEncontrado: 'No existe.' })
 */
async function datos(promesa, opcionesError = {}) {
  const r = await promesa;
  if (r.error) throw traducir(r.error, opcionesError);
  if (opcionesError.noEncontrado && (r.data === null || (Array.isArray(r.data) && r.data.length === 0))) {
    throw new ErrorHttp(404, opcionesError.noEncontrado);
  }
  return r.data;
}

/** Igual que `datos` pero devuelve también el total (para consultas con { count: 'exact' }). */
async function conTotal(promesa) {
  const r = await promesa;
  if (r.error) throw traducir(r.error);
  return { items: r.data || [], total: r.count ?? 0 };
}

module.exports = { publico, admin, deUsuario, paraAuth, traducir, datos, conTotal };
