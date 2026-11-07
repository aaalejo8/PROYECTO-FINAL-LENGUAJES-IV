'use strict';
/**
 * Mini servidor HTTP sin dependencias: rutas, lectura de JSON, archivos estáticos
 * (el sitio compilado y las imágenes subidas) y encabezados de seguridad.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const config = require('./config');
const { ErrorHttp } = require('./errores');

const gzip = promisify(zlib.gzip);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRIMIBLES = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.webmanifest', '.txt']);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  // El navegador habla directo con Supabase Auth (renovar la sesión, login con Google, cerrar sesión)
  `connect-src 'self' ${config.supabase.url}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src https:",
  "frame-ancestors 'none'",
].join('; ');

// ─────────────────────────────── Router ───────────────────────────────

function crearRouter() {
  const rutas = [];

  function agregar(metodo, patron, manejadores) {
    const nombres = [];
    const fuente = patron
      .split('/')
      .map((segmento) => {
        if (segmento.startsWith(':')) {
          nombres.push(segmento.slice(1));
          return '([^/]+)';
        }
        return segmento.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    rutas.push({ metodo, re: new RegExp(`^${fuente}/?$`), nombres, manejadores });
  }

  const router = {
    /** Devuelve { manejadores, params } | { metodoNoPermitido: true } | null */
    buscar(metodo, rutaUrl) {
      let existeConOtroMetodo = false;
      for (const ruta of rutas) {
        const m = ruta.re.exec(rutaUrl);
        if (!m) continue;
        if (ruta.metodo !== metodo) {
          existeConOtroMetodo = true;
          continue;
        }
        const params = {};
        ruta.nombres.forEach((nombre, i) => {
          params[nombre] = decodeURIComponent(m[i + 1]);
        });
        return { manejadores: ruta.manejadores, params };
      }
      return existeConOtroMetodo ? { metodoNoPermitido: true } : null;
    },
  };
  for (const metodo of ['get', 'post', 'put', 'patch', 'delete']) {
    router[metodo] = (patron, ...manejadores) => agregar(metodo.toUpperCase(), patron, manejadores);
  }
  return router;
}

// ─────────────────────────── Lectura del cuerpo ───────────────────────────

function leerBuffer(req, limite) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let total = 0;
    let excedido = false;
    req.on('data', (parte) => {
      if (excedido) return;
      total += parte.length;
      if (total > limite) {
        excedido = true;
        partes.length = 0;
        return;
      }
      partes.push(parte);
    });
    req.on('end', () => {
      if (excedido) reject(new ErrorHttp(413, 'El contenido enviado es demasiado grande.'));
      else resolve(Buffer.concat(partes));
    });
    req.on('error', reject);
  });
}

async function leerJson(req, limite = 200_000) {
  const buffer = await leerBuffer(req, limite);
  if (buffer.length === 0) return {};
  try {
    const datos = JSON.parse(buffer.toString('utf8'));
    return datos && typeof datos === 'object' ? datos : {};
  } catch (_) {
    throw new ErrorHttp(400, 'El contenido enviado no es un JSON válido.');
  }
}

// ───────────────────────────── Respuestas ─────────────────────────────

function ipDe(req) {
  if (config.confiarProxy) {
    const reenviada = req.headers['x-forwarded-for'];
    if (reenviada) return String(reenviada).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'desconocida';
}

function encabezadosSeguridad(res, esHtml) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (config.produccion && config.urlPublica.startsWith('https://')) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  }
  if (esHtml) res.setHeader('Content-Security-Policy', CSP);
}

/** Responde con una redirección (y, si hace falta, cookies). */
function redirigir(res, destino, cookies = []) {
  const cabeceras = { Location: destino, 'Cache-Control': 'no-store' };
  if (cookies.length) cabeceras['Set-Cookie'] = cookies;
  res.writeHead(302, cabeceras);
  res.end();
}

/** Lee una cookie del pedido. */
function leerCookie(req, nombre) {
  for (const parte of String(req.headers.cookie || '').split(';')) {
    const [clave, ...valor] = parte.trim().split('=');
    if (clave === nombre) return decodeURIComponent(valor.join('='));
  }
  return '';
}

function enviarJson(res, estado, datos) {
  const cuerpo = estado === 204 || datos === undefined ? '' : JSON.stringify(datos);
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(cuerpo),
  });
  res.end(cuerpo);
}

const cacheGzip = new Map();

async function enviarArchivo(req, res, archivo, stat, { cache, esHtml }) {
  const ext = path.extname(archivo).toLowerCase();
  encabezadosSeguridad(res, esHtml);
  const etag = `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', cache);
  res.setHeader('Content-Type', TIPOS[ext] || 'application/octet-stream');
  res.setHeader('Vary', 'Accept-Encoding');

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304);
    return res.end();
  }

  const quiereGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (quiereGzip && COMPRIMIBLES.has(ext) && stat.size > 1024 && stat.size < 5_000_000) {
    let entrada = cacheGzip.get(archivo);
    if (!entrada || entrada.etag !== etag) {
      entrada = { etag, datos: await gzip(await fs.promises.readFile(archivo)) };
      cacheGzip.set(archivo, entrada);
    }
    res.writeHead(200, { 'Content-Encoding': 'gzip', 'Content-Length': entrada.datos.length });
    return res.end(req.method === 'HEAD' ? undefined : entrada.datos);
  }

  res.writeHead(200, { 'Content-Length': stat.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(archivo)
    .on('error', () => res.destroy())
    .pipe(res);
}

/**
 * Sirve archivos de una carpeta. Con `spa: true`, cualquier ruta sin archivo devuelve
 * index.html (para que funcionen /panel, /ingresar, /proyectos/XXX al recargar la página).
 * Devuelve true si respondió.
 */
async function servirCarpeta(req, res, raiz, rutaRelativa, { spa = false, cacheArchivos = 'public, max-age=3600' } = {}) {
  let relativa;
  try {
    relativa = decodeURIComponent(rutaRelativa);
  } catch (_) {
    enviarJson(res, 400, { error: 'URL inválida.' });
    return true;
  }
  if (relativa.includes('\0')) {
    enviarJson(res, 400, { error: 'URL inválida.' });
    return true;
  }
  const absoluta = path.resolve(raiz, '.' + path.posix.normalize('/' + relativa));
  if (absoluta !== raiz && !absoluta.startsWith(raiz + path.sep)) {
    enviarJson(res, 403, { error: 'Acceso denegado.' });
    return true;
  }

  let archivo = absoluta;
  let stat = await fs.promises.stat(archivo).catch(() => null);
  if (stat && stat.isDirectory()) {
    archivo = path.join(archivo, 'index.html');
    stat = await fs.promises.stat(archivo).catch(() => null);
  }
  if (stat && stat.isFile()) {
    const esHtml = path.extname(archivo).toLowerCase() === '.html';
    const hasheado = /\/assets\//.test(archivo.split(path.sep).join('/'));
    await enviarArchivo(req, res, archivo, stat, {
      esHtml,
      cache: esHtml ? 'no-cache' : hasheado ? 'public, max-age=31536000, immutable' : cacheArchivos,
    });
    return true;
  }

  if (spa && !path.extname(relativa)) {
    const index = path.join(raiz, 'index.html');
    const statIndex = await fs.promises.stat(index).catch(() => null);
    if (statIndex) {
      await enviarArchivo(req, res, index, statIndex, { esHtml: true, cache: 'no-cache' });
      return true;
    }
  }
  return false;
}

// ───────────────────────────── Servidor ─────────────────────────────

/** Devuelve la función (req, res) que atiende cada pedido. La usan el servidor local y la función de Vercel. */
function crearManejador(router) {
  async function atender(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const ruta = url.pathname;
    encabezadosSeguridad(res, false);

    // ── API ──
    if (ruta === '/api' || ruta.startsWith('/api/')) {
      const hallada = router.buscar(req.method, ruta);
      if (!hallada) return enviarJson(res, 404, { error: 'Ruta no encontrada.' });
      if (hallada.metodoNoPermitido) return enviarJson(res, 405, { error: 'Método no permitido.' });

      let cuerpoJson;
      const ctx = {
        req,
        res,
        params: hallada.params,
        query: Object.fromEntries(url.searchParams),
        ip: ipDe(req),
        estado: 200,
        usuario: null,
        json: async () => (cuerpoJson ??= await leerJson(req)),
      };
      let resultado;
      for (const manejador of hallada.manejadores) {
        resultado = await manejador(ctx);
        if (res.writableEnded) return; // el manejador ya respondió (por ejemplo, con una redirección)
      }
      return enviarJson(res, resultado === undefined ? (ctx.estado === 200 ? 204 : ctx.estado) : ctx.estado, resultado);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return enviarJson(res, 405, { error: 'Método no permitido.' });
    }

    // (Las imágenes subidas desde el panel se sirven desde Supabase Storage, no desde este servidor.)

    // ── El sitio (React compilado) ──
    const ok = await servirCarpeta(req, res, config.clientDist, ruta.slice(1), { spa: true });
    if (ok) return;
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(
      'El sitio todavía no está compilado.\nEn la carpeta "client" ejecutá:  npm install && npm run build\n' +
        '(o usá  npm run dev  en "client" mientras desarrollás).'
    );
  }

  return (req, res) =>
    atender(req, res).catch((error) => {
      if (res.headersSent) return res.destroy();
      if (error instanceof ErrorHttp) {
        return enviarJson(res, error.estado, { error: error.message, detalle: error.detalle });
      }
      console.error(`[${new Date().toISOString()}] Error en ${req.method} ${req.url}:`, error);
      enviarJson(res, 500, { error: 'Ocurrió un error en el servidor. Probá de nuevo en unos minutos.' });
    });
}

function crearServidor(router) {
  const servidor = http.createServer(crearManejador(router));
  servidor.requestTimeout = 60_000;
  servidor.headersTimeout = 20_000;
  servidor.keepAliveTimeout = 65_000;
  return servidor;
}

module.exports = { crearRouter, crearManejador, crearServidor, leerBuffer, leerJson, enviarJson, redirigir, leerCookie, ipDe };
