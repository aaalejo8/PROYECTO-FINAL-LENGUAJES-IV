'use strict';
/**
 * Panel del administrador: CRUD completo de servicios, proyectos y demos, y subida de imágenes.
 * Todo con validación estricta del lado del servidor (el navegador valida también, pero no se confía en él)
 * y ejecutado con el token del admin (ctx.db): la base vuelve a exigir el rol con Row Level Security.
 */
const { ErrorHttp } = require('../errores');
const imagenes = require('../imagenes');
const supabase = require('../supabase');
const { soloAdmin } = require('../permisos');
const { limitar } = require('../seguridad');
const { texto, entero, booleano, opcion, url, imagen, slug, lista } = require('../validar');

// Íconos disponibles para los servicios (nombres de la librería de íconos del sitio)
const ICONOS = ['code', 'server', 'database', 'layout', 'smartphone', 'cloud', 'shield', 'zap', 'git-branch', 'message-square', 'globe', 'cpu'];
const TIPOS_DEMO = ['iframe', 'enlace'];

const idDe = (ctx) => entero(ctx.params.id, 'El id', { min: 1 });

function leerServicio(c) {
  return {
    titulo: texto(c.titulo, 'El título', { obligatorio: true, min: 3, max: 80 }),
    descripcion: texto(c.descripcion, 'La descripción', { obligatorio: true, min: 10, max: 600, multilinea: true }),
    icono: opcion(c.icono || 'code', 'El ícono', ICONOS),
    orden: entero(c.orden, 'El orden', { min: 0, max: 9999, porDefecto: 0 }),
    activo: booleano(c.activo, 'Activo', true),
  };
}

function leerProyecto(c) {
  const titulo = texto(c.titulo, 'El título', { obligatorio: true, min: 3, max: 100 });
  const enlace = slug(c.slug || titulo, 'El link');
  if (enlace.length < 3) throw new ErrorHttp(400, 'El link (slug) tiene que tener al menos 3 letras o números.');
  return {
    slug: enlace,
    titulo,
    resumen: texto(c.resumen, 'El resumen', { obligatorio: true, min: 10, max: 300 }),
    descripcion: texto(c.descripcion, 'La descripción', { obligatorio: true, min: 20, max: 5000, multilinea: true }),
    tecnologias: lista(c.tecnologias, 'Las tecnologías', { max: 12, largoItem: 30 }),
    imagen_url: imagen(c.imagen_url, 'La imagen') || null,
    repo_url: url(c.repo_url, 'El link del repositorio', { soloHttps: true }) || null,
    destacado: booleano(c.destacado, 'Destacado', false),
    orden: entero(c.orden, 'El orden', { min: 0, max: 9999, porDefecto: 0 }),
    activo: booleano(c.activo, 'Activo', true),
  };
}

function leerDemo(c) {
  return {
    titulo: texto(c.titulo, 'El título', { obligatorio: true, min: 3, max: 100 }),
    descripcion: texto(c.descripcion, 'La descripción', { max: 300 }) || null,
    tipo: opcion(c.tipo || 'enlace', 'El tipo de demo', TIPOS_DEMO),
    url: url(c.url, 'El link de la demo', { obligatorio: true, soloHttps: true }),
    orden: entero(c.orden, 'El orden', { min: 0, max: 9999, porDefecto: 0 }),
    activo: booleano(c.activo, 'Activa', true),
  };
}

const COL_SERVICIO = 'id, titulo, descripcion, icono, orden, activo, creado_en';
const COL_PROYECTO = 'id, slug, titulo, resumen, descripcion, tecnologias, imagen_url, repo_url, destacado, orden, activo, creado_en, actualizado_en';
const COL_DEMO = 'id, titulo, descripcion, tipo, url, orden, activo';
const SLUG_REPETIDO = { conflicto: 'Ya hay un proyecto con ese link (slug). Probá con otro.' };

const demosDe = (db, proyectoId) => supabase.datos(db.from('demos').select(COL_DEMO).eq('proyecto_id', proyectoId).order('orden').order('id'));

module.exports = function registrar(router) {
  const limiteSubidas = limitar({ ventanaMs: 10 * 60_000, max: 60, mensaje: 'Subiste muchas imágenes seguidas. Esperá unos minutos.' });

  // ───────────── Servicios ─────────────

  router.get('/api/admin/servicios', ...soloAdmin, async (ctx) => {
    const items = await supabase.datos(ctx.db.from('servicios').select(COL_SERVICIO).order('orden').order('id'));
    return { items, iconos: ICONOS };
  });

  router.get('/api/admin/servicios/:id', ...soloAdmin, (ctx) =>
    supabase.datos(ctx.db.from('servicios').select(COL_SERVICIO).eq('id', idDe(ctx)).maybeSingle(), { noEncontrado: 'Servicio no encontrado.' })
  );

  router.post('/api/admin/servicios', ...soloAdmin, async (ctx) => {
    const d = leerServicio(await ctx.json());
    const fila = await supabase.datos(ctx.db.from('servicios').insert(d).select(COL_SERVICIO).single());
    ctx.estado = 201;
    return fila;
  });

  router.put('/api/admin/servicios/:id', ...soloAdmin, async (ctx) => {
    const d = leerServicio(await ctx.json());
    const filas = await supabase.datos(ctx.db.from('servicios').update(d).eq('id', idDe(ctx)).select(COL_SERVICIO), { noEncontrado: 'Servicio no encontrado.' });
    return filas[0];
  });

  router.delete('/api/admin/servicios/:id', ...soloAdmin, async (ctx) => {
    await supabase.datos(ctx.db.from('servicios').delete().eq('id', idDe(ctx)).select('id'), { noEncontrado: 'Servicio no encontrado.' });
    return { ok: true };
  });

  // ───────────── Proyectos ─────────────

  router.get('/api/admin/proyectos', ...soloAdmin, async (ctx) => {
    const filas = await supabase.datos(ctx.db.from('proyectos').select(`${COL_PROYECTO}, demos (count)`).order('orden').order('id'));
    return { items: filas.map(({ demos, ...p }) => ({ ...p, cantidad_demos: demos?.[0]?.count ?? 0 })) };
  });

  router.get('/api/admin/proyectos/:id', ...soloAdmin, async (ctx) => {
    const id = idDe(ctx);
    const proyecto = await supabase.datos(ctx.db.from('proyectos').select(COL_PROYECTO).eq('id', id).maybeSingle(), { noEncontrado: 'Proyecto no encontrado.' });
    return { ...proyecto, demos: await demosDe(ctx.db, id) };
  });

  router.post('/api/admin/proyectos', ...soloAdmin, async (ctx) => {
    const d = leerProyecto(await ctx.json());
    const fila = await supabase.datos(ctx.db.from('proyectos').insert(d).select(COL_PROYECTO).single(), SLUG_REPETIDO);
    ctx.estado = 201;
    return { ...fila, demos: [] };
  });

  router.put('/api/admin/proyectos/:id', ...soloAdmin, async (ctx) => {
    const id = idDe(ctx);
    const d = leerProyecto(await ctx.json());
    const anterior = await supabase.datos(ctx.db.from('proyectos').select('imagen_url').eq('id', id).maybeSingle(), { noEncontrado: 'Proyecto no encontrado.' });
    const filas = await supabase.datos(ctx.db.from('proyectos').update(d).eq('id', id).select(COL_PROYECTO), { ...SLUG_REPETIDO, noEncontrado: 'Proyecto no encontrado.' });
    if (anterior.imagen_url !== d.imagen_url) await imagenes.borrarSiHuerfana(ctx.db, anterior.imagen_url);
    return { ...filas[0], demos: await demosDe(ctx.db, id) };
  });

  router.delete('/api/admin/proyectos/:id', ...soloAdmin, async (ctx) => {
    const filas = await supabase.datos(ctx.db.from('proyectos').delete().eq('id', idDe(ctx)).select('imagen_url'), { noEncontrado: 'Proyecto no encontrado.' });
    await imagenes.borrarSiHuerfana(ctx.db, filas[0].imagen_url);
    return { ok: true };
  });

  // ───────────── Demos de un proyecto ─────────────

  router.get('/api/admin/proyectos/:id/demos', ...soloAdmin, (ctx) => demosDe(ctx.db, idDe(ctx)).then((items) => ({ items })));

  router.post('/api/admin/proyectos/:id/demos', ...soloAdmin, async (ctx) => {
    const proyectoId = idDe(ctx);
    const d = leerDemo(await ctx.json());
    await supabase.datos(ctx.db.from('proyectos').select('id').eq('id', proyectoId).maybeSingle(), { noEncontrado: 'Proyecto no encontrado.' });
    const fila = await supabase.datos(ctx.db.from('demos').insert({ ...d, proyecto_id: proyectoId }).select(COL_DEMO).single());
    ctx.estado = 201;
    return fila;
  });

  router.put('/api/admin/demos/:id', ...soloAdmin, async (ctx) => {
    const d = leerDemo(await ctx.json());
    const filas = await supabase.datos(ctx.db.from('demos').update(d).eq('id', idDe(ctx)).select(COL_DEMO), { noEncontrado: 'Demo no encontrada.' });
    return filas[0];
  });

  router.delete('/api/admin/demos/:id', ...soloAdmin, async (ctx) => {
    await supabase.datos(ctx.db.from('demos').delete().eq('id', idDe(ctx)).select('id'), { noEncontrado: 'Demo no encontrada.' });
    return { ok: true };
  });

  // ───────────── Imágenes (Supabase Storage) ─────────────
  // El panel achica la foto en el navegador y la manda como archivo directo (no multipart).
  router.post('/api/admin/imagenes', ...soloAdmin, limiteSubidas, async (ctx) => {
    const direccion = await imagenes.guardarSubida(ctx);
    ctx.estado = 201;
    return { url: direccion };
  });
};
