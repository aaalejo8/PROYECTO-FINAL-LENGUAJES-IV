'use strict';
/**
 * APIs web externas. Se consultan desde el servidor (no desde el navegador) por tres motivos:
 * se guarda una copia por unos minutos (GitHub limita a 60 consultas por hora sin token),
 * si la API se cae el sitio sigue funcionando, y la política de seguridad de la página no tiene
 * que permitir conexiones a otros dominios.
 *
 *   · GitHub REST  → repositorios y lenguajes del perfil
 *   · Open-Meteo   → hora y clima del lugar donde trabaja el desarrollador (no pide clave)
 */
const config = require('./config');

const cache = new Map();
/** Devuelve el valor guardado si es reciente; si no, lo pide. Si el pedido falla, usa el valor viejo. */
async function conCache(clave, ttlMs, pedir) {
  const guardado = cache.get(clave);
  if (guardado && Date.now() - guardado.hora < ttlMs) return guardado.valor;
  try {
    const valor = await pedir();
    cache.set(clave, { hora: Date.now(), valor });
    return valor;
  } catch (error) {
    console.warn(`[APIs] ${clave}: ${error.message}`);
    if (guardado) return guardado.valor;
    return null;
  }
}

// ───────────────────────────── GitHub ─────────────────────────────

async function pedirGithub(usuario) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'portfolio-fullstack', 'X-GitHub-Api-Version': '2022-11-28' };
  if (config.github.token) headers.Authorization = `Bearer ${config.github.token}`;
  const respuesta = await fetch(`https://api.github.com/users/${encodeURIComponent(usuario)}/repos?per_page=100&sort=pushed&type=owner`, {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!respuesta.ok) throw new Error(`GitHub respondió ${respuesta.status}`);
  const repos = (await respuesta.json()).filter((r) => !r.fork && !r.archived && !r.private);

  const lenguajes = new Map();
  for (const r of repos) if (r.language) lenguajes.set(r.language, (lenguajes.get(r.language) || 0) + 1);
  const conLenguaje = [...lenguajes.values()].reduce((a, b) => a + b, 0) || 1;

  return {
    disponible: true,
    usuario,
    perfil_url: `https://github.com/${encodeURIComponent(usuario)}`,
    totales: { repos: repos.length, estrellas: repos.reduce((a, r) => a + (r.stargazers_count || 0), 0) },
    repos: repos.slice(0, 6).map((r) => ({
      nombre: r.name,
      descripcion: r.description ? String(r.description).slice(0, 160) : null,
      url: r.html_url,
      estrellas: r.stargazers_count || 0,
      lenguaje: r.language || null,
      actualizado: r.pushed_at,
    })),
    lenguajes: [...lenguajes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([nombre, cantidad]) => ({ nombre, cantidad, porcentaje: Math.round((cantidad / conLenguaje) * 100) })),
  };
}

/** Actividad pública de GitHub. Devuelve { disponible: false } si no hay usuario configurado o la API no responde. */
async function github(usuario) {
  const nombre = usuario || config.github.usuario;
  if (!nombre || !/^[A-Za-z0-9-]{1,39}$/.test(nombre)) return { disponible: false };
  return (await conCache(`github:${nombre}`, 15 * 60_000, () => pedirGithub(nombre))) || { disponible: false };
}

// ───────────────────────────── Clima ─────────────────────────────

// Códigos del estándar WMO que usa Open-Meteo
const DESCRIPCION_CLIMA = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla',
  51: 'Llovizna',
  53: 'Llovizna',
  55: 'Llovizna',
  61: 'Lluvia débil',
  63: 'Lluvia',
  65: 'Lluvia fuerte',
  71: 'Nieve',
  73: 'Nieve',
  75: 'Nieve',
  80: 'Chubascos',
  81: 'Chubascos',
  82: 'Chubascos fuertes',
  95: 'Tormenta',
  96: 'Tormenta con granizo',
  99: 'Tormenta con granizo',
};

async function pedirClima() {
  const { latitud, longitud } = config.clima;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitud}&longitude=${longitud}&current=temperature_2m,weather_code,is_day&timezone=${encodeURIComponent(config.zona)}`;
  const respuesta = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!respuesta.ok) throw new Error(`Open-Meteo respondió ${respuesta.status}`);
  const actual = (await respuesta.json()).current;
  if (!actual || typeof actual.temperature_2m !== 'number') throw new Error('Respuesta sin datos');
  return {
    disponible: true,
    temperatura: Math.round(actual.temperature_2m),
    descripcion: DESCRIPCION_CLIMA[actual.weather_code] || 'Sin datos',
    es_de_dia: actual.is_day === 1,
  };
}

/** Hora y clima del lugar del desarrollador. La zona horaria siempre viene, así el reloj funciona aunque falle la API. */
async function clima() {
  const datos = (await conCache('clima', 30 * 60_000, pedirClima)) || { disponible: false };
  return { ciudad: config.clima.ciudad, zona: config.zona, ...datos };
}

module.exports = { github, clima };
