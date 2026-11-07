'use strict';
/**
 * Panel del administrador: usuarios registrados y equipo.
 *   visitante = se registró para ver proyectos y demos
 *   operador  = atiende las consultas
 *   admin     = administra todo
 *
 * El listado y los cambios de rol/nombre/estado van con el token del admin (RLS + trigger que
 * protege al último administrador). Lo que toca las cuentas de Supabase Auth (crear, cambiar
 * contraseña, bloquear el ingreso, borrar) necesita la API de administración de Auth, que sólo
 * funciona con la service_role: se usa recién DESPUÉS de verificar que quien pide es admin.
 */
const supabase = require('../supabase');
const { ErrorHttp } = require('../errores');
const { soloAdmin } = require('../permisos');
const { texto, booleano, email: validarEmail, opcion, validarPassword, paginacion, sinAcentos } = require('../validar');

const ROLES = ['admin', 'operador', 'visitante'];
const COLUMNAS = 'id, email, nombre, rol, activo, proveedor, avatar_url, creado_en, ultimo_acceso';
const BLOQUEO = '876000h'; // ~100 años: Supabase Auth rechaza el ingreso y la renovación del token

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function idDe(ctx) {
  const id = String(ctx.params.id || '');
  if (!RE_UUID.test(id)) throw new ErrorHttp(400, 'El id de usuario no es válido.');
  return id.toLowerCase();
}

const aplanar = ({ accesos, ...u }) => ({ ...u, con_google: u.proveedor === 'google', accesos: accesos?.[0]?.count ?? 0 });

async function errorDeAuth(promesa, mensaje) {
  const { data, error } = await promesa;
  if (error) {
    if (/already (been )?registered|already exists/i.test(error.message)) throw new ErrorHttp(409, 'Ya hay un usuario con ese email.');
    if (/at least one administrador|administrador activo/i.test(error.message)) throw new ErrorHttp(409, 'Tiene que quedar al menos un administrador activo.');
    console.error('[Auth admin]', error.message);
    throw new ErrorHttp(502, mensaje);
  }
  return data;
}

module.exports = function registrar(router) {
  router.get('/api/admin/usuarios', ...soloAdmin, async (ctx) => {
    const { pagina, limite, desde } = paginacion(ctx.query, { limitePorDefecto: 20, limiteMaximo: 100 });
    let consulta = ctx.db.from('perfiles').select(`${COLUMNAS}, accesos (count)`, { count: 'exact' });
    if (ROLES.includes(ctx.query.rol)) consulta = consulta.eq('rol', ctx.query.rol);
    if (ctx.query.estado === 'activos') consulta = consulta.eq('activo', true);
    if (ctx.query.estado === 'inactivos') consulta = consulta.eq('activo', false);
    for (const palabra of String(ctx.query.q || '').trim().split(/\s+/).filter(Boolean).slice(0, 4)) {
      consulta = consulta.ilike('busqueda', `%${sinAcentos(palabra.slice(0, 60)).replace(/[\\%_]/g, '\\$&')}%`);
    }
    const [{ items, total }, resumen] = await Promise.all([
      supabase.conTotal(consulta.order('activo', { ascending: false }).order('creado_en', { ascending: false }).range(desde, desde + limite - 1)),
      supabase.datos(ctx.db.rpc('usuarios_resumen')),
    ]);
    return { items: items.map(aplanar), total, pagina, paginas: Math.max(1, Math.ceil(total / limite)), resumen };
  });

  router.get('/api/admin/usuarios/:id', ...soloAdmin, async (ctx) => {
    const id = idDe(ctx);
    const u = await supabase.datos(ctx.db.from('perfiles').select(`${COLUMNAS}, accesos (count)`).eq('id', id).maybeSingle(), { noEncontrado: 'Usuario no encontrado.' });
    const ultimos = await supabase.datos(ctx.db.from('accesos').select('metodo, creado_en').eq('usuario_id', id).order('creado_en', { ascending: false }).limit(10));
    return { ...aplanar(u), ultimos_accesos: ultimos };
  });

  // Alta de un usuario (normalmente alguien del equipo) con email ya confirmado
  router.post('/api/admin/usuarios', ...soloAdmin, async (ctx) => {
    const cuerpo = await ctx.json();
    const mail = validarEmail(cuerpo.email, 'El email', { obligatorio: true });
    const nombre = texto(cuerpo.nombre, 'El nombre', { obligatorio: true, min: 2, max: 100 });
    const rol = opcion(cuerpo.rol || 'operador', 'El rol', ROLES);
    const password = validarPassword(cuerpo.password);

    const creado = await errorDeAuth(
      supabase.admin.auth.admin.createUser({ email: mail, password, email_confirm: true, user_metadata: { nombre } }),
      'No pude crear el usuario en Supabase Auth.'
    );
    // El trigger ya creó el perfil como "visitante": el admin le asigna el rol (RLS: sólo admin puede)
    const filas = await supabase.datos(ctx.db.from('perfiles').update({ rol, nombre }).eq('id', creado.user.id).select(COLUMNAS));
    ctx.estado = 201;
    return { ...filas[0], con_google: false, accesos: 0 };
  });

  router.patch('/api/admin/usuarios/:id', ...soloAdmin, async (ctx) => {
    const id = idDe(ctx);
    const cuerpo = await ctx.json();
    const cambios = {};
    if (cuerpo.nombre !== undefined) cambios.nombre = texto(cuerpo.nombre, 'El nombre', { obligatorio: true, min: 2, max: 100 });
    if (cuerpo.rol !== undefined) cambios.rol = opcion(cuerpo.rol, 'El rol', ROLES);
    if (cuerpo.activo !== undefined) cambios.activo = booleano(cuerpo.activo, 'Activo');
    const password = cuerpo.password !== undefined && cuerpo.password !== '' ? validarPassword(cuerpo.password) : null;
    if (Object.keys(cambios).length === 0 && !password) throw new ErrorHttp(400, 'No hay cambios para guardar.');

    if (id === ctx.usuario.id && ((cambios.rol && cambios.rol !== 'admin') || cambios.activo === false)) {
      throw new ErrorHttp(409, 'No podés quitarte el acceso de administrador a vos mismo.');
    }

    let fila;
    if (Object.keys(cambios).length) {
      // La base valida: RLS (sólo admin) + trigger (no dejar el sistema sin administradores)
      const filas = await supabase.datos(ctx.db.from('perfiles').update(cambios).eq('id', id).select(COLUMNAS), { noEncontrado: 'Usuario no encontrado.' });
      fila = filas[0];
    } else {
      fila = await supabase.datos(ctx.db.from('perfiles').select(COLUMNAS).eq('id', id).maybeSingle(), { noEncontrado: 'Usuario no encontrado.' });
    }

    const atributos = {};
    if (password) atributos.password = password;
    if (cambios.activo !== undefined) atributos.ban_duration = cambios.activo ? 'none' : BLOQUEO;
    if (cambios.nombre) atributos.user_metadata = { nombre: cambios.nombre };
    if (Object.keys(atributos).length) {
      await errorDeAuth(supabase.admin.auth.admin.updateUserById(id, atributos), 'Se guardó el perfil pero no pude actualizar la cuenta en Supabase Auth.');
    }
    return { ...fila, con_google: fila.proveedor === 'google' };
  });

  router.delete('/api/admin/usuarios/:id', ...soloAdmin, async (ctx) => {
    const id = idDe(ctx);
    if (id === ctx.usuario.id) throw new ErrorHttp(409, 'No podés borrar tu propio usuario.');
    const u = await supabase.datos(ctx.db.from('perfiles').select('id, rol, activo').eq('id', id).maybeSingle(), { noEncontrado: 'Usuario no encontrado.' });
    if (u.rol === 'admin' && u.activo) {
      const otros = await supabase.datos(ctx.db.from('perfiles').select('id').eq('rol', 'admin').eq('activo', true).neq('id', id).limit(1));
      if (!otros.length) throw new ErrorHttp(409, 'Tiene que quedar al menos un administrador activo.');
    }
    // Borra la cuenta de Auth; el perfil y sus accesos se borran en cascada. Sus consultas quedan (usuario_id = null).
    await errorDeAuth(supabase.admin.auth.admin.deleteUser(id), 'No pude borrar el usuario en Supabase Auth.');
    return { ok: true };
  });
};
