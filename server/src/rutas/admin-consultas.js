'use strict';
/** Panel del operador: bandeja de consultas, seguimiento y respuestas por correo. Pueden usarlo el operador y el administrador. */
const consultas = require('../consultas');
const { soloStaff } = require('../permisos');
const { limitar } = require('../seguridad');
const { entero, texto, opcion, paginacion } = require('../validar');

module.exports = function registrar(router) {
  const limiteRespuestas = limitar({ ventanaMs: 10 * 60_000, max: 40, mensaje: 'Enviaste muchas respuestas seguidas. Esperá unos minutos.' });
  const idDe = (ctx) => entero(ctx.params.id, 'El id', { min: 1 });

  router.get('/api/admin/consultas/resumen', ...soloStaff, (ctx) => consultas.resumen(ctx.db));

  router.get('/api/admin/consultas', ...soloStaff, async (ctx) => {
    const { pagina, limite, desde } = paginacion(ctx.query, { limitePorDefecto: 20, limiteMaximo: 100 });
    const { items, total } = await consultas.listar(ctx.db, {
      estado: String(ctx.query.estado || ''),
      tipo: String(ctx.query.tipo || ''),
      q: String(ctx.query.q || ''),
      desde,
      limite,
    });
    return { items, total, pagina, paginas: Math.max(1, Math.ceil(total / limite)) };
  });

  router.get('/api/admin/consultas/:id', ...soloStaff, (ctx) => consultas.obtener(ctx.db, idDe(ctx)));

  router.patch('/api/admin/consultas/:id/estado', ...soloStaff, async (ctx) => {
    const id = idDe(ctx);
    const cuerpo = await ctx.json();
    return consultas.cambiarEstado(ctx.db, id, opcion(cuerpo.estado, 'El estado', consultas.ESTADOS), ctx.usuario);
  });

  router.patch('/api/admin/consultas/:id/notas', ...soloStaff, async (ctx) => {
    const id = idDe(ctx);
    const cuerpo = await ctx.json();
    return consultas.guardarNotas(ctx.db, id, texto(cuerpo.notas_internas, 'Las notas', { max: 3000, multilinea: true }));
  });

  router.post('/api/admin/consultas/:id/responder', ...soloStaff, limiteRespuestas, async (ctx) => {
    const id = idDe(ctx);
    const respuesta = await consultas.responder(ctx.db, id, await ctx.json(), ctx.usuario);
    ctx.estado = 201;
    return respuesta;
  });
};
