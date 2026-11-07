'use strict';
/**
 * Deja el proyecto listo para correr en tu computadora contra tu proyecto de Supabase:
 *
 *   npm run preparar
 *
 * Hace, en orden (y se puede repetir sin romper nada):
 *   1. Crea server/.env desde .env.example si no existe y verifica las claves de Supabase.
 *   2. Crea client/.env con la URL y la clave PÚBLICA de Supabase (nunca la service_role).
 *   3. Instala las dependencias del servidor y del cliente.
 *   4. Comprueba que las migraciones estén aplicadas y carga el contenido de ejemplo.
 *   5. Crea un administrador y un operador de prueba (si no existían).
 *
 * Antes: creá el proyecto en https://supabase.com y aplicá supabase/migrations (ver docs/SUPABASE.md).
 * Opciones:  --sin-instalar   salta el paso 3
 * Usuarios de prueba:  ADMIN_EMAIL, ADMIN_PASSWORD, OPERADOR_EMAIL, OPERADOR_PASSWORD
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const raiz = path.join(__dirname, '..');
const servidor = path.join(raiz, 'server');
const cliente = path.join(raiz, 'client');
const envServidor = path.join(servidor, '.env');
const envCliente = path.join(cliente, '.env');
const sinInstalar = process.argv.includes('--sin-instalar');

const USUARIOS = [
  { rol: 'admin', nombre: 'Administrador', email: process.env.ADMIN_EMAIL || 'admin@example.com', clave: process.env.ADMIN_PASSWORD || 'admin12345' },
  { rol: 'operador', nombre: 'Operador', email: process.env.OPERADOR_EMAIL || 'operador@example.com', clave: process.env.OPERADOR_PASSWORD || 'operador12345' },
];

let paso = 0;
const titulo = (texto) => console.log(`\n\x1b[1m[${++paso}] ${texto}\x1b[0m`);
const ok = (texto) => console.log(`    ✔ ${texto}`);
const aviso = (texto) => console.log(`    ℹ ${texto}`);

function fallar(mensaje, ayuda = []) {
  console.error(`\n\x1b[31m✖ ${mensaje}\x1b[0m`);
  for (const linea of ayuda) console.error(`  ${linea}`);
  process.exit(1);
}

function correr(comando, args, { cwd = raiz, env = {} } = {}) {
  const r = spawnSync(comando, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', shell: process.platform === 'win32' });
  return { codigo: r.status ?? 1, salida: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const leerEnv = (archivo) =>
  Object.fromEntries(
    fs
      .readFileSync(archivo, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, '')])
  );

// ── 0. Versión de Node ─────────────────────────────────────────────
const [mayor, menor] = process.versions.node.split('.').map(Number);
if (mayor < 20 || (mayor === 20 && menor < 12)) {
  fallar(`Necesitás Node.js 20.12 o más nuevo (tenés ${process.versions.node}).`, ['Descargalo de https://nodejs.org (versión LTS).']);
}

// ── 1. server/.env ─────────────────────────────────────────────────
titulo('Configuración del servidor (server/.env)');
if (!fs.existsSync(envServidor)) {
  fs.copyFileSync(path.join(servidor, '.env.example'), envServidor);
  ok('Creé server/.env a partir de .env.example.');
}
const env = leerEnv(envServidor);
const faltan = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !env[k]);
if (faltan.length) {
  fallar(`Faltan datos de Supabase en server/.env: ${faltan.join(', ')}`, [
    'Están en el panel de Supabase → Project Settings → API (o Data API / API Keys).',
    'Completalos y volvé a correr:  npm run preparar      (guía completa: docs/SUPABASE.md)',
  ]);
}
ok('Claves de Supabase presentes.');

// ── 2. client/.env (sólo datos públicos) ───────────────────────────
titulo('Configuración del sitio (client/.env)');
const lineasCliente = [
  '# Generado por npm run preparar. Sólo datos PÚBLICOS: nunca pongas acá la service_role.',
  `VITE_SUPABASE_URL=${env.SUPABASE_URL}`,
  `VITE_SUPABASE_ANON_KEY=${env.SUPABASE_ANON_KEY}`,
  '',
].join('\n');
if (!fs.existsSync(envCliente) || fs.readFileSync(envCliente, 'utf8') !== lineasCliente) {
  fs.writeFileSync(envCliente, lineasCliente);
  ok('client/.env actualizado con la URL y la clave pública.');
} else {
  ok('client/.env ya estaba al día.');
}

// ── 3. Dependencias ────────────────────────────────────────────────
titulo('Dependencias');
if (sinInstalar) {
  aviso('Salteado (--sin-instalar).');
} else {
  for (const [nombre, carpeta] of [['servidor', servidor], ['cliente', cliente]]) {
    console.log(`    Instalando ${nombre} (puede tardar un minuto)...`);
    const r = correr('npm', ['install', '--no-audit', '--no-fund'], { cwd: carpeta });
    if (r.codigo !== 0) fallar(`No pude instalar las dependencias del ${nombre}.`, [r.salida.split('\n').slice(-8).join('\n  ')]);
    ok(`Dependencias del ${nombre} listas.`);
  }
}

// ── 4. Base de datos ───────────────────────────────────────────────
titulo('Base de datos (Supabase) y contenido de ejemplo');
const seed = correr('node', ['scripts/seed.js'], { cwd: servidor });
if (seed.codigo !== 0) {
  fallar('No pude usar la base de Supabase.', [
    seed.salida,
    'Si dice que una tabla no existe: aplicá las migraciones de supabase/migrations (ver docs/SUPABASE.md, paso 2).',
  ]);
}
ok(seed.salida.replace(/^✔\s*/, ''));

// ── 5. Usuarios ────────────────────────────────────────────────────
titulo('Usuarios de prueba');
for (const u of USUARIOS) {
  const r = correr('node', ['scripts/crear-admin.js', u.email, u.nombre, u.clave, u.rol], { cwd: servidor, env: { CREAR_SIN_PISAR: '1' } });
  if (r.codigo !== 0) fallar(`No pude crear el usuario ${u.email}.`, [r.salida]);
  ok(r.salida.replace(/^✔\s*/, ''));
}

console.log('\n\x1b[1m\x1b[32m✔ Todo listo.\x1b[0m\n');
console.log('  Para encender el sitio:   npm run dev');
console.log('  Después abrí:             http://localhost:5173\n');
console.log('  Usuarios de prueba (cambiá las claves antes de publicar el sitio):');
for (const u of USUARIOS) console.log(`    ${u.rol.padEnd(9)} ${u.email}  /  ${u.clave}`);
console.log('    El panel está en /panel. Un visitante se registra solo desde /ingresar.\n');
