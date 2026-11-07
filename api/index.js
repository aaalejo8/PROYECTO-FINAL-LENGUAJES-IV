'use strict';
/**
 * Función serverless de Vercel: atiende TODA la API (/api/...) con el mismo código del servidor local.
 * vercel.json reenvía cada /api/* acá; el sitio compilado (client/dist) lo sirve directamente la CDN de Vercel.
 * En local se sigue usando server/src/index.js (npm run dev / npm run iniciar).
 */
const config = require('../server/src/config');
config.validar();

const { crearManejador } = require('../server/src/http');
const crearRutas = require('../server/src/app');

const atender = crearManejador(crearRutas());

module.exports = (req, res) => atender(req, res);
