'use strict';
/**
 * Límites de uso por IP (o por otra clave).
 * Las contraseñas y las sesiones ahora las maneja Supabase Auth; acá quedan sólo los frenos
 * contra abusos del formulario de contacto, el registro y el ingreso.
 */
const { ErrorHttp } = require('./errores');

/**
 * Devuelve un middleware que corta con 429 si una misma IP (o clave) hace
 * demasiados pedidos en la ventana de tiempo.
 */
function limitar({ ventanaMs, max, mensaje, clave }) {
  const registros = new Map();
  setInterval(() => {
    const ahora = Date.now();
    for (const [k, v] of registros) if (v.reinicio <= ahora) registros.delete(k);
  }, 60_000).unref();

  return async (ctx) => {
    const k = clave ? await clave(ctx) : ctx.ip;
    const ahora = Date.now();
    let r = registros.get(k);
    if (!r || r.reinicio <= ahora) {
      r = { cantidad: 0, reinicio: ahora + ventanaMs };
      registros.set(k, r);
    }
    r.cantidad += 1;
    if (r.cantidad > max) {
      const segundos = Math.ceil((r.reinicio - ahora) / 1000);
      ctx.res.setHeader('Retry-After', String(segundos));
      throw new ErrorHttp(429, mensaje || 'Demasiados intentos. Esperá unos minutos y probá de nuevo.');
    }
  };
}

/**
 * Bloqueo por intentos FALLIDOS (para el ingreso). Un ingreso correcto borra el contador,
 * así el dueño no se bloquea a sí mismo por entrar varias veces, pero quien prueba contraseñas sí.
 */
function crearBloqueoPorFallos({ ventanaMs, max, mensaje }) {
  const registros = new Map();
  setInterval(() => {
    const ahora = Date.now();
    for (const [k, v] of registros) if (v.reinicio <= ahora) registros.delete(k);
  }, 60_000).unref();

  return {
    verificar(ctx, clave) {
      const r = registros.get(clave);
      if (r && r.reinicio > Date.now() && r.cantidad >= max) {
        ctx.res.setHeader('Retry-After', String(Math.ceil((r.reinicio - Date.now()) / 1000)));
        throw new ErrorHttp(429, mensaje);
      }
    },
    fallo(clave) {
      const ahora = Date.now();
      let r = registros.get(clave);
      if (!r || r.reinicio <= ahora) {
        r = { cantidad: 0, reinicio: ahora + ventanaMs };
        registros.set(clave, r);
      }
      r.cantidad += 1;
    },
    exito(clave) {
      registros.delete(clave);
    },
  };
}

module.exports = { limitar, crearBloqueoPorFallos };
