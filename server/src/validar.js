'use strict';
/** Funciones para validar y limpiar lo que llega desde el sitio o el panel. */
const { ErrorHttp } = require('./errores');

const invalido = (mensaje) => new ErrorHttp(400, mensaje);

function texto(valor, campo, { max = 255, obligatorio = false, min = 0, multilinea = false } = {}) {
  if (valor === undefined || valor === null) valor = '';
  if (typeof valor !== 'string') throw invalido(`${campo}: el valor no es válido.`);
  let limpio = valor.replace(/\r\n/g, '\n');
  limpio = multilinea
    ? limpio.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    : limpio.replace(/[\u0000-\u001f\u007f]/g, ' ');
  limpio = limpio.trim();
  if (obligatorio && !limpio) throw invalido(`${campo} es obligatorio.`);
  if (limpio && limpio.length < min) throw invalido(`${campo} debe tener al menos ${min} caracteres.`);
  if (limpio.length > max) throw invalido(`${campo} no puede superar los ${max} caracteres.`);
  return limpio;
}

function entero(valor, campo, { min = 0, max = 2_147_483_647, porDefecto } = {}) {
  if ((valor === undefined || valor === null || valor === '') && porDefecto !== undefined) return porDefecto;
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof n !== 'number' || !Number.isInteger(n)) throw invalido(`${campo} tiene que ser un número entero.`);
  if (n < min || n > max) throw invalido(`${campo} tiene que estar entre ${min} y ${max}.`);
  return n;
}

function decimal(valor, campo, { min = 0, max = 99_999_999 } = {}) {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor.replace(',', '.')) : valor;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw invalido(`${campo} tiene que ser un número.`);
  if (n < min || n > max) throw invalido(`${campo} tiene que estar entre ${min} y ${max}.`);
  return Math.round(n * 100) / 100;
}

function booleano(valor, campo, porDefecto) {
  if (valor === undefined || valor === null) {
    if (porDefecto !== undefined) return porDefecto;
    throw invalido(`${campo}: falta el valor.`);
  }
  if (typeof valor !== 'boolean') throw invalido(`${campo}: el valor no es válido.`);
  return valor;
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function email(valor, campo, { obligatorio = false } = {}) {
  const limpio = texto(valor, campo, { max: 150, obligatorio }).toLowerCase();
  if (limpio && !RE_EMAIL.test(limpio)) throw invalido(`${campo} no parece un email válido.`);
  return limpio;
}

function opcion(valor, campo, permitidas) {
  if (!permitidas.includes(valor)) throw invalido(`${campo}: opción no válida.`);
  return valor;
}

function validarPassword(valor, campo = 'La contraseña') {
  if (typeof valor !== 'string' || valor.length < 8) throw invalido(`${campo} tiene que tener al menos 8 caracteres.`);
  if (valor.length > 200) throw invalido(`${campo} es demasiado larga.`);
  return valor;
}


/** Dirección web: sólo http(s), sin usuario ni contraseña incluidos. Devuelve '' si está vacía y no es obligatoria. */
function url(valor, campo, { obligatorio = false, soloHttps = false } = {}) {
  const limpio = texto(valor, campo, { max: 300, obligatorio });
  if (!limpio) return '';
  let u;
  try {
    u = new URL(limpio);
  } catch (_) {
    throw invalido(`${campo} no parece un link válido (tiene que empezar con https://).`);
  }
  const protocolos = soloHttps ? ['https:'] : ['https:', 'http:'];
  if (!protocolos.includes(u.protocol) || u.username || u.password || !u.hostname.includes('.')) {
    throw invalido(`${campo} tiene que ser un link que empiece con ${soloHttps ? 'https://' : 'https:// o http://'}.`);
  }
  return u.toString();
}

/** Imagen: una foto subida desde el panel (URL pública de Supabase Storage) o cualquier link https. */
function imagen(valor, campo) {
  const limpio = texto(valor, campo, { max: 300 });
  if (!limpio) return '';
  return url(limpio, campo, { soloHttps: true });
}

/** Texto en formato "url-amigable": letras minúsculas, números y guiones. */
function slug(valor, campo) {
  const limpio = sinAcentos(texto(valor, campo, { max: 80 }))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return limpio;
}

/** Lista de textos cortos (por ejemplo, las tecnologías de un proyecto). Acepta un arreglo o texto separado por comas. */
function lista(valor, campo, { max = 12, largoItem = 30 } = {}) {
  let items = valor;
  if (valor === undefined || valor === null || valor === '') items = [];
  else if (typeof valor === 'string') items = valor.split(',');
  if (!Array.isArray(items)) throw invalido(`${campo}: el valor no es válido.`);
  const resultado = [];
  for (const item of items) {
    const t = texto(item, campo, { max: largoItem });
    if (t && !resultado.some((x) => x.toLowerCase() === t.toLowerCase())) resultado.push(t);
  }
  if (resultado.length > max) throw invalido(`${campo}: como máximo ${max} elementos.`);
  return resultado;
}

/** Fecha en formato AAAA-MM-DD (y que exista de verdad). */
function fecha(valor, campo, { porDefecto } = {}) {
  if ((valor === undefined || valor === null || valor === '') && porDefecto !== undefined) return porDefecto;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw invalido(`${campo} tiene que tener el formato AAAA-MM-DD.`);
  const d = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) throw invalido(`${campo} no es una fecha válida.`);
  return valor;
}

/** Teléfono internacional opcional: dígitos, espacios, +, paréntesis y guiones (6 a 30 caracteres). */
function telefonoOpcional(valor, campo) {
  const limpio = texto(valor, campo, { max: 30 });
  if (!limpio) return '';
  if (!/^[0-9+()\s.-]{6,30}$/.test(limpio) || limpio.replace(/\D/g, '').length < 6) {
    throw invalido(`${campo} no parece un teléfono válido.`);
  }
  return limpio;
}

/** Paginación común: ?pagina=1&limite=24 */
function paginacion(query, { limitePorDefecto = 24, limiteMaximo = 60 } = {}) {
  const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
  const limite = Math.min(limiteMaximo, Math.max(1, parseInt(query.limite, 10) || limitePorDefecto));
  return { pagina, limite, desde: (pagina - 1) * limite };
}

/** Escapa % _ \ para usarlo dentro de un LIKE. */
const escaparLike = (t) => t.replace(/[\\%_]/g, '\\$&');

// Búsqueda sin importar acentos ni mayúsculas: "bujia" encuentra "Bujía", "garcia" encuentra "García".
// Se hace con funciones que ya trae PostgreSQL (no hace falta instalar extensiones).
const ACENTOS = 'áéíóúüñàèìòùâêîôûäëïö';
const SIN_ACENTOS = 'aeiouunaeiouaeiouaeio';
const sqlSinAcentos = (columna) => `translate(lower(${columna}), '${ACENTOS}', '${SIN_ACENTOS}')`;
const sinAcentos = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Arma el patrón LIKE de una palabra buscada: "%bujia%" */
const patronBusqueda = (palabra) => `%${escaparLike(sinAcentos(palabra.slice(0, 60)))}%`;

module.exports = {
  texto,
  entero,
  decimal,
  booleano,
  email,
  opcion,
  validarPassword,
  url,
  imagen,
  slug,
  lista,
  fecha,
  telefonoOpcional,
  sinAcentos,
  paginacion,
  escaparLike,
  sqlSinAcentos,
  patronBusqueda,
};
