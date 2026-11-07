'use strict';
/**
 * Rutas públicas: lo que usa cualquier visitante (portfolio, formulario de contacto, métricas y APIs externas).
 */
const config = require('../config');
const consultas = require('../consultas');
const metricas = require('../metricas');
const externas = require('../externas');
const supabase = require('../supabase');
const { limitar } = require('../seguridad');
const { usuarioOpcional } = require('../permisos');

module.exports = function registrar(router) {
  const limiteContacto = limitar({
    ventanaMs: 15 * 60_000,
    max: 5,
    mensaje: 'Enviaste varias consultas seguidas. Esperá unos minutos y probá de nuevo.',
  });
  const limiteVisitas = limitar({ ventanaMs: 10 * 60_000, max: 60 });
  const limiteExternas = limitar({ ventanaMs: 10 * 60_000, max: 90 });

  /** Datos generales y qué opciones están activadas (Google, correo real). */
  router.get('/api/sitio', () => ({
    nombre: config.sitio.nombre,
    google: config.google,
    correo_simulado: config.correo.simulado,
  }));

  /**
   * Todo el contenido de la página de inicio en un solo pedido, con la clave PÚBLICA (RLS de anónimo).
   * Los proyectos salen SIN el detalle: la descripción completa y las demos están en
   * /api/proyectos/:slug y la base sólo se las entrega a usuarios autenticados.
   */
  router.get('/api/portfolio', usuarioOpcional, async (ctx) => {
    const db = supabase.publico;
    const [perfil, tecnologias, experiencia, servicios, proyectos] = await Promise.all([
      supabase.datos(db.from('perfil_sitio').select('nombre, titular, bio, ubicacion, email_publico, github_usuario, linkedin_url, disponible, anios_experiencia, foto_url').eq('id', 1).maybeSingle()),
      supabase.datos(db.from('tecnologias').select('id, nombre, categoria, nivel').order('orden').order('id')),
      supabase.datos(db.from('experiencia').select('id, puesto, organizacion, desde, hasta, descripcion').order('orden').order('id')),
      supabase.datos(db.from('servicios').select('id, titulo, descripcion, icono').eq('activo', true).order('orden').order('id')),
      supabase.datos(db.rpc('proyectos_publicos')),
    ]);
    return { perfil: perfil || null, tecnologias, experiencia, servicios, proyectos, acceso: Boolean(ctx.usuario) };
  });

  /** Formulario de contacto: lo puede usar cualquiera (con o sin cuenta). */
  router.post('/api/contacto', limiteContacto, usuarioOpcional, async (ctx) => {
    const resultado = await consultas.crear(await ctx.json(), ctx.usuario);
    ctx.estado = 201;
    return resultado;
  });

  /** Contador de visitas: el sitio lo avisa una vez por sesión de navegación. */
  router.post('/api/visitas', limiteVisitas, usuarioOpcional, async (ctx) => {
    const cuerpo = await ctx.json();
    await metricas.registrarVisita({
      ruta: typeof cuerpo.ruta === 'string' ? cuerpo.ruta : '/',
      ip: ctx.ip,
      agente: String(ctx.req.headers['user-agent'] || '').slice(0, 300),
      usuarioId: ctx.usuario?.id,
    });
  });

  // ── APIs externas (con copia en el servidor) ──

  router.get('/api/github', limiteExternas, async () => {
    const perfil = await supabase.datos(supabase.publico.from('perfil_sitio').select('github_usuario').eq('id', 1).maybeSingle());
    return externas.github(perfil?.github_usuario);
  });

  router.get('/api/clima', limiteExternas, () => externas.clima());
};
