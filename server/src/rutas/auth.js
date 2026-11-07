'use strict';
/**
 * Registro, ingreso y cuenta, sobre Supabase Auth.
 *
 *   · Registro e ingreso con email pasan por este servidor: así se validan los campos, se limitan
 *     los intentos por IP/email y se registra el acceso para las métricas. Supabase Auth guarda
 *     las contraseñas (bcrypt) y emite la sesión (access + refresh token).
 *   · Google (OAuth) lo hace el navegador directo con Supabase; al volver, llama a /api/auth/acceso.
 *   · Cerrar sesión: el navegador llama a supabase.auth.signOut(), que revoca el refresh token.
 */
const config = require('../config');
const supabase = require('../supabase');
const { ErrorHttp } = require('../errores');
const { limitar, crearBloqueoPorFallos } = require('../seguridad');
const { requiereUsuario, datosUsuario, sesionDelToken } = require('../permisos');
const { texto, email: validarEmail, validarPassword, opcion } = require('../validar');

const METODOS = ['password', 'google', 'registro', 'otro'];

/**
 * Cuenta un ACCESO AUTENTICADO = una sesión nueva de Supabase Auth.
 * Se guarda con el token del propio usuario (RLS: sólo puede registrar los suyos) y la clave
 * única (usuario, sesión) hace que repetir el aviso no sume dos veces.
 */
async function registrarAcceso({ token, usuarioId, metodo }) {
  const sesionId = sesionDelToken(token);
  if (sesionId) {
    const { error } = await supabase
      .deUsuario(token)
      .from('accesos')
      .upsert({ usuario_id: usuarioId, sesion_id: sesionId, metodo }, { onConflict: 'usuario_id,sesion_id', ignoreDuplicates: true });
    if (error) console.error('[Accesos] No pude registrar el acceso:', error.message);
  }
  await supabase.admin.from('perfiles').update({ ultimo_acceso: new Date().toISOString() }).eq('id', usuarioId);
}

/** Perfil del usuario recién autenticado, leído con SU token (RLS: cada uno ve el suyo). */
async function perfilDe(token, id) {
  return supabase.datos(supabase.deUsuario(token).from('perfiles').select('id, email, nombre, rol, activo, avatar_url').eq('id', id).maybeSingle());
}

const sesionPublica = (s) => ({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at });

module.exports = function registrar(router) {
  // Frena a quien prueba contraseñas: se cuentan los intentos FALLIDOS por IP y por email.
  const bloqueoPorIp = crearBloqueoPorFallos({ ventanaMs: 15 * 60_000, max: 20, mensaje: 'Demasiados intentos de ingreso. Esperá unos minutos.' });
  const bloqueoPorEmail = crearBloqueoPorFallos({ ventanaMs: 15 * 60_000, max: 8, mensaje: 'Demasiados intentos con este email. Esperá unos minutos.' });
  const limiteGeneral = limitar({ ventanaMs: 15 * 60_000, max: 100, mensaje: 'Demasiados intentos. Esperá unos minutos.' });
  const limiteRegistro = limitar({ ventanaMs: 60 * 60_000, max: 10, mensaje: 'Se crearon varias cuentas desde tu conexión. Esperá un rato y probá de nuevo.' });

  // ── Registro: crea un usuario en Supabase Auth; el trigger de la base le arma el perfil "visitante" ──
  router.post('/api/auth/registro', limiteRegistro, async (ctx) => {
    const cuerpo = await ctx.json();
    const nombre = texto(cuerpo.nombre, 'El nombre', { obligatorio: true, min: 2, max: 100 });
    const mail = validarEmail(cuerpo.email, 'El email', { obligatorio: true });
    const password = validarPassword(cuerpo.password);

    const { data, error } = await supabase.paraAuth().auth.signUp({
      email: mail,
      password,
      options: { data: { nombre }, emailRedirectTo: `${config.urlPublica}/auth/callback` },
    });
    if (error) {
      const codigo = error.code || '';
      if (codigo === 'user_already_exists' || /already registered/i.test(error.message)) {
        throw new ErrorHttp(409, 'Ya hay una cuenta con ese email. Ingresá con tu contraseña o con Google.');
      }
      if (codigo === 'weak_password') throw new ErrorHttp(400, 'La contraseña es muy débil. Usá al menos 8 caracteres combinando letras y números.');
      if (error.status === 429 || /rate limit/i.test(error.message)) throw new ErrorHttp(429, 'Se hicieron muchos registros seguidos. Esperá unos minutos.');
      if (codigo === 'signup_disabled') throw new ErrorHttp(403, 'El registro de cuentas está desactivado.');
      if (codigo === 'email_address_invalid') throw new ErrorHttp(400, 'El email no parece válido.');
      console.error('[Auth] Registro falló:', codigo, error.message);
      throw new ErrorHttp(502, 'No pudimos crear la cuenta. Probá de nuevo en unos minutos.');
    }

    ctx.estado = 201;
    // Con "Confirm email" activado en Supabase no hay sesión hasta que la persona confirma el correo
    if (!data.session) {
      return { confirmar: true, mensaje: `Te enviamos un correo a ${mail}. Abrí el link para confirmar tu cuenta y después ingresá.` };
    }
    const perfil = await perfilDe(data.session.access_token, data.user.id);
    await registrarAcceso({ token: data.session.access_token, usuarioId: data.user.id, metodo: 'registro' });
    return { sesion: sesionPublica(data.session), usuario: datosUsuario(perfil) };
  });

  // ── Ingreso con email y contraseña (todos los roles) ──
  router.post('/api/auth/login', limiteGeneral, async (ctx) => {
    const cuerpo = await ctx.json();
    const mail = validarEmail(cuerpo.email, 'El email', { obligatorio: true });
    const password = typeof cuerpo.password === 'string' ? cuerpo.password.slice(0, 200) : '';
    if (!password) throw new ErrorHttp(400, 'Ingresá tu contraseña.');
    bloqueoPorIp.verificar(ctx, ctx.ip);
    bloqueoPorEmail.verificar(ctx, mail);

    const cliente = supabase.paraAuth();
    const { data, error } = await cliente.auth.signInWithPassword({ email: mail, password });
    if (error) {
      const codigo = error.code || '';
      if (codigo === 'email_not_confirmed') throw new ErrorHttp(403, 'Todavía no confirmaste tu email. Revisá tu correo (y la carpeta de spam).');
      if (codigo === 'user_banned') throw new ErrorHttp(403, 'Esta cuenta está desactivada. Escribinos si creés que es un error.');
      if (codigo === 'invalid_credentials' || error.status === 400) {
        bloqueoPorIp.fallo(ctx.ip);
        bloqueoPorEmail.fallo(mail);
        throw new ErrorHttp(401, 'Email o contraseña incorrectos.');
      }
      if (error.status === 429) throw new ErrorHttp(429, 'Demasiados intentos. Esperá unos minutos.');
      console.error('[Auth] Ingreso falló:', codigo, error.message);
      throw new ErrorHttp(502, 'No pudimos iniciar la sesión. Probá de nuevo en unos minutos.');
    }

    const perfil = await perfilDe(data.session.access_token, data.user.id);
    if (!perfil || !perfil.activo) {
      await cliente.auth.signOut().catch(() => {});
      throw new ErrorHttp(403, 'Esta cuenta está desactivada. Escribinos si creés que es un error.');
    }
    bloqueoPorEmail.exito(mail);
    await registrarAcceso({ token: data.session.access_token, usuarioId: perfil.id, metodo: 'password' });
    return { sesion: sesionPublica(data.session), usuario: datosUsuario(perfil) };
  });

  // ── Vuelta de Google o del link de confirmación: el navegador ya tiene sesión y avisa ──
  router.post('/api/auth/acceso', requiereUsuario, limiteGeneral, async (ctx) => {
    const cuerpo = await ctx.json();
    const metodo = ctx.proveedor === 'google' ? 'google' : opcion(cuerpo.metodo || 'otro', 'El método', METODOS);
    await registrarAcceso({ token: ctx.token, usuarioId: ctx.usuario.id, metodo });
    return datosUsuario(ctx.usuario);
  });

  router.get('/api/auth/yo', requiereUsuario, (ctx) => datosUsuario(ctx.usuario));
};

module.exports.registrarAcceso = registrarAcceso;
