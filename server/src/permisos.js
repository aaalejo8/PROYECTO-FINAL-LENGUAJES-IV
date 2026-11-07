'use strict';
/**
 * Autenticación con Supabase Auth y control de roles.
 *
 * El navegador manda el access token de Supabase en "Authorization: Bearer ...".
 * En cada pedido:
 *   1. Supabase Auth valida el token (firma, vencimiento, sesión no revocada).
 *   2. Se lee el perfil (rol y si está activo) desde la base: si el admin desactiva a alguien,
 *      pierde el acceso al instante aunque su token no haya vencido.
 *   3. ctx.db queda como un cliente de Supabase que actúa CON ESE USUARIO, así la base vuelve
 *      a verificar los permisos con Row Level Security (doble control: servidor + base).
 */
const { ErrorHttp } = require('./errores');
const supabase = require('./supabase');

const datosUsuario = (p) => ({ id: p.id, email: p.email, nombre: p.nombre, rol: p.rol, avatar_url: p.avatar_url || null });

/** Lee el id de sesión de Supabase del token (ya validado por Auth). */
function sesionDelToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.session_id === 'string' ? payload.session_id : null;
  } catch (_) {
    return null;
  }
}

async function cargarUsuario(ctx) {
  const cabecera = ctx.req.headers.authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : '';
  if (!token || token.length > 4096 || token.split('.').length !== 3) return null;

  // Mínimo privilegio: para validar el token y leer el propio perfil alcanza la clave pública
  // (RLS deja que cada usuario lea su perfil). No se usa la service_role.
  const { data, error } = await supabase.publico.auth.getUser(token);
  if (error || !data?.user) return null;

  const db = supabase.deUsuario(token);
  const { data: perfil, error: errorPerfil } = await db
    .from('perfiles')
    .select('id, email, nombre, rol, activo, avatar_url')
    .eq('id', data.user.id)
    .maybeSingle();
  if (errorPerfil) throw supabase.traducir(errorPerfil);
  if (!perfil || !perfil.activo) return null;

  ctx.token = token;
  ctx.sesionId = sesionDelToken(token);
  ctx.proveedor = data.user.app_metadata?.provider || 'email';
  ctx.db = db;
  return perfil;
}

/** Exige una sesión válida (cualquier rol). */
async function requiereUsuario(ctx) {
  const usuario = await cargarUsuario(ctx);
  if (!usuario) {
    const conToken = String(ctx.req.headers.authorization || '').startsWith('Bearer ');
    throw new ErrorHttp(401, conToken ? 'Tu sesión venció. Volvé a ingresar.' : 'Necesitás iniciar sesión para ver esto.');
  }
  ctx.usuario = usuario;
}

/** Si hay sesión válida la carga en ctx.usuario; si no, sigue como visitante anónimo. */
async function usuarioOpcional(ctx) {
  ctx.usuario = await cargarUsuario(ctx).catch(() => null);
}

/** Exige que el usuario tenga uno de esos roles. Va después de requiereUsuario. */
const requiereRol =
  (...roles) =>
  (ctx) => {
    if (!ctx.usuario || !roles.includes(ctx.usuario.rol)) {
      throw new ErrorHttp(403, 'No tenés permiso para hacer esto.');
    }
  };

/** Operador y administrador: bandeja de consultas. */
const soloStaff = [requiereUsuario, requiereRol('admin', 'operador')];
/** Sólo el administrador: contenido, usuarios y métricas. */
const soloAdmin = [requiereUsuario, requiereRol('admin')];

module.exports = { requiereUsuario, usuarioOpcional, requiereRol, soloStaff, soloAdmin, datosUsuario, sesionDelToken };
