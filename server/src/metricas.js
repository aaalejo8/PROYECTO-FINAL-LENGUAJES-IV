'use strict';
/**
 * Métricas del sitio: contadores de visitas y de accesos de usuarios registrados, y consultas
 * parametrizadas (rango de fechas, agrupación y tipo de consulta) para los gráficos del panel.
 *
 * Las consultas SQL viven en la base como funciones (supabase/migrations/..._funciones.sql) y se
 * llaman por RPC con parámetros tipados: nunca se concatena lo que manda el usuario. Se validan
 * acá (mensajes claros) y otra vez en la base (que además verifica que quien llama sea admin).
 *
 * Definiciones (para no contar de más):
 *   · Visita:  una sesión de navegación. El sitio la avisa una vez por pestaña y la base ignora
 *              otra visita del mismo visitante en los 30 minutos siguientes. Se descartan bots.
 *   · Visitante único: hash diario de IP + navegador (no se guarda la IP).
 *   · Acceso autenticado: una sesión nueva de Supabase Auth (login, registro, Google). Recargar
 *              la página o renovar el token no suma: la clave es (usuario, sesión).
 *   · Usuario registrado: perfil con rol "visitante" (cuentas creadas para ver proyectos y demos).
 */
const crypto = require('crypto');
const config = require('./config');
const supabase = require('./supabase');
const { ErrorHttp } = require('./errores');
const { fecha, opcion } = require('./validar');

const AGRUPACIONES = ['day', 'week', 'month'];
const TIPOS = ['general', 'cotizacion', 'asesoria'];
const DIA_MS = 86_400_000;
const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|preview|curl|wget|python-requests|axios|node-fetch|undici/i;

// ───────────────────────────── Registro ─────────────────────────────

const hashVisitante = ({ ip, agente, dia }) =>
  crypto.createHash('sha256').update(`${config.secretoVisitas}|${dia}|${ip}|${agente || ''}`).digest('hex').slice(0, 16);

/** Cuenta una visita (con service_role: el navegador no puede escribir en la tabla visitas). */
async function registrarVisita({ ruta, ip, agente, usuarioId }) {
  if (!agente || BOTS.test(agente)) return false;
  const limpia = String(ruta || '/').slice(0, 200);
  const rutaSegura = limpia.startsWith('/') ? limpia.replace(/[\u0000-\u001f\u007f]/g, '') : '/';
  const dia = hoy();
  const contada = await supabase.datos(
    supabase.admin.rpc('registrar_visita', { p_ruta: rutaSegura, p_hash: hashVisitante({ ip, agente, dia }), p_usuario: usuarioId ?? null })
  );
  return contada === true;
}

// ───────────────────────────── Fechas ─────────────────────────────

/** Hoy (AAAA-MM-DD) en la zona horaria del sitio. */
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: config.zona }).format(new Date());
const sumarDias = (iso, dias) => new Date(Date.parse(`${iso}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA_MS);

/**
 * Lee y valida ?desde=&hasta=&agrupar=&tipo= (por defecto: últimos 30 días, agrupado por día, todos los tipos).
 * Se limita el rango para que una consulta nunca sea pesada.
 */
function leerParametros(q) {
  const hasta = fecha(q.hasta, 'La fecha "hasta"', { porDefecto: hoy() });
  const desde = fecha(q.desde, 'La fecha "desde"', { porDefecto: sumarDias(hasta, -29) });
  const agrupar = q.agrupar ? opcion(String(q.agrupar), 'La agrupación', AGRUPACIONES) : 'day';
  const tipo = q.tipo ? opcion(String(q.tipo), 'El tipo de consulta', TIPOS) : null;
  const dias = diasEntre(desde, hasta);
  if (dias < 0) throw new ErrorHttp(400, 'La fecha "desde" no puede ser posterior a "hasta".');
  if (dias > 730) throw new ErrorHttp(400, 'El rango máximo es de 2 años.');
  if (agrupar === 'day' && dias > 180) throw new ErrorHttp(400, 'Para más de 180 días agrupá por semana o por mes.');
  return { desde, hasta, agrupar, tipo };
}

// ───────────────────────────── Consultas (RPC) ─────────────────────────────

const resumen = (db) => supabase.datos(db.rpc('metricas_resumen', { p_zona: config.zona }));

const series = (db, { desde, hasta, agrupar, tipo }) =>
  supabase.datos(db.rpc('metricas_series', { p_desde: desde, p_hasta: hasta, p_agrupar: agrupar, p_zona: config.zona, p_tipo: tipo }));

const consultasPorTipoYEstado = (db, { desde, hasta, tipo }) =>
  supabase.datos(db.rpc('metricas_consultas', { p_desde: desde, p_hasta: hasta, p_zona: config.zona, p_tipo: tipo }));

module.exports = { AGRUPACIONES, registrarVisita, hashVisitante, leerParametros, resumen, series, consultasPorTipoYEstado, hoy, sumarDias, diasEntre };
