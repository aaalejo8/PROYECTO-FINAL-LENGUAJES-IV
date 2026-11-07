'use strict';
/**
 * Detalle de un proyecto y sus demos interactivas.
 * Sólo para usuarios registrados: sin sesión el servidor responde 401, y además la base
 * (RLS) no le devuelve filas de proyectos/demos a la clave pública. No alcanza con ocultarlo en pantalla.
 */
const supabase = require('../supabase');
const { requiereUsuario } = require('../permisos');
const { slug } = require('../validar');

module.exports = function registrar(router) {
  router.get('/api/proyectos/:slug', requiereUsuario, async (ctx) => {
    const noEncontrado = 'Ese proyecto no existe o ya no está disponible.';
    const buscado = slug(ctx.params.slug, 'El proyecto');
    const proyecto = await supabase.datos(
      ctx.db
        .from('proyectos')
        .select('id, slug, titulo, resumen, descripcion, tecnologias, imagen_url, repo_url, destacado, creado_en, demos (id, titulo, descripcion, tipo, url, orden, activo)')
        .eq('slug', buscado)
        .eq('activo', true)
        .maybeSingle(),
      { noEncontrado }
    );
    const demos = (proyecto.demos || [])
      .filter((d) => d.activo)
      .sort((a, b) => a.orden - b.orden || a.id - b.id)
      .map(({ orden, activo, ...d }) => d);
    return { ...proyecto, demos };
  });
};
