'use strict';
/**
 * Imágenes de portada de los proyectos, guardadas en Supabase Storage (bucket "portfolio").
 * Validación estricta, en tres capas:
 *   · servidor: sólo JPG, PNG o WebP por el tipo declarado Y por los primeros bytes del archivo,
 *     máximo 4 MB, nombre generado por el servidor (nunca se usa el que manda el cliente)
 *   · bucket:   límite de 4 MB y lista de tipos MIME permitidos
 *   · RLS de storage.objects: sólo un admin puede subir o borrar
 */
const crypto = require('crypto');
const config = require('./config');
const supabase = require('./supabase');
const { ErrorHttp } = require('./errores');
const { leerBuffer } = require('./http');

const EXTENSIONES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 4 * 1024 * 1024;

function firmaValida(datos, ext) {
  if (ext === 'jpg') return datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff;
  if (ext === 'png') return datos.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === 'webp') return datos.subarray(0, 4).toString('latin1') === 'RIFF' && datos.subarray(8, 12).toString('latin1') === 'WEBP';
  return false;
}

/** Prefijo de las URLs públicas de nuestro bucket. */
const prefijoPublico = () => `${config.supabase.url}/storage/v1/object/public/${config.supabase.bucket}/`;

/** Ruta del objeto dentro del bucket a partir de su URL pública ('' si no es de nuestro bucket). */
function rutaEnBucket(url) {
  if (typeof url !== 'string' || !url.startsWith(prefijoPublico())) return '';
  const ruta = url.slice(prefijoPublico().length);
  return /^proyectos\/[A-Za-z0-9._-]+$/.test(ruta) ? ruta : '';
}

/** Sube la imagen que viene en el cuerpo del pedido y devuelve su URL pública. */
async function guardarSubida(ctx) {
  const tipo = String(ctx.req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const ext = EXTENSIONES[tipo];
  if (!ext) throw new ErrorHttp(415, 'Subí una imagen JPG, PNG o WebP.');
  const datos = await leerBuffer(ctx.req, MAX_BYTES);
  if (datos.length === 0 || !firmaValida(datos, ext)) throw new ErrorHttp(400, 'El archivo no es una imagen válida.');

  const ruta = `proyectos/${crypto.randomBytes(12).toString('hex')}.${ext}`;
  // Con el token del admin: Storage vuelve a verificar con RLS que tenga permiso
  const { error } = await ctx.db.storage.from(config.supabase.bucket).upload(ruta, datos, { contentType: tipo, cacheControl: '2592000', upsert: false });
  if (error) {
    console.error('[Storage] No pude subir la imagen:', error.message);
    if (/row-level security|unauthorized|403/i.test(`${error.message} ${error.statusCode || ''}`)) throw new ErrorHttp(403, 'No tenés permiso para subir imágenes.');
    if (/size|too large|413/i.test(`${error.message} ${error.statusCode || ''}`)) throw new ErrorHttp(413, 'La imagen supera los 4 MB.');
    throw new ErrorHttp(502, 'No pude guardar la imagen. Probá de nuevo en unos minutos.');
  }
  return ctx.db.storage.from(config.supabase.bucket).getPublicUrl(ruta).data.publicUrl;
}

/** Borra la imagen del bucket si ya ningún proyecto la usa. */
async function borrarSiHuerfana(db, url) {
  const ruta = rutaEnBucket(url);
  if (!ruta) return;
  const { data } = await db.from('proyectos').select('id').eq('imagen_url', url).limit(1);
  if (data && data.length === 0) {
    const { error } = await db.storage.from(config.supabase.bucket).remove([ruta]);
    if (error) console.warn('[Storage] No pude borrar la imagen huérfana:', error.message);
  }
}

module.exports = { guardarSubida, borrarSiHuerfana, firmaValida, rutaEnBucket, EXTENSIONES, MAX_BYTES };
