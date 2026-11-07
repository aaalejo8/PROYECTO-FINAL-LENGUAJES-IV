'use strict';
/** Arma el router con todas las rutas de la API. Lo usan el servidor local (index.js) y la función de Vercel (api/index.js). */
const { crearRouter } = require('./http');

module.exports = function crearRutas() {
  const router = crearRouter();
  require('./rutas/publico')(router);
  require('./rutas/auth')(router);
  require('./rutas/proyectos')(router);
  require('./rutas/admin-contenido')(router);
  require('./rutas/admin-consultas')(router);
  require('./rutas/admin-usuarios')(router);
  require('./rutas/admin-metricas')(router);
  return router;
};
