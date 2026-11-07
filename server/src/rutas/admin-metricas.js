'use strict';
/**
 * Panel del administrador: contadores y gráficos.
 * Consultas parametrizadas: ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&agrupar=day|week|month&tipo=general|cotizacion|asesoria
 */
const metricas = require('../metricas');
const { soloAdmin } = require('../permisos');

module.exports = function registrar(router) {
  router.get('/api/admin/metricas/resumen', ...soloAdmin, (ctx) => metricas.resumen(ctx.db));

  router.get('/api/admin/metricas/series', ...soloAdmin, async (ctx) => {
    const parametros = metricas.leerParametros(ctx.query);
    return { ...parametros, puntos: await metricas.series(ctx.db, parametros) };
  });

  router.get('/api/admin/metricas/consultas', ...soloAdmin, async (ctx) => {
    // Estos totales no se agrupan por período, así que el límite de "180 días agrupando por día" no corre
    const parametros = metricas.leerParametros({ ...ctx.query, agrupar: 'month' });
    return { desde: parametros.desde, hasta: parametros.hasta, tipo: parametros.tipo, ...(await metricas.consultasPorTipoYEstado(ctx.db, parametros)) };
  });
};
