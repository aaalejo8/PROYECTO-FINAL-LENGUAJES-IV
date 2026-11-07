'use strict';
/**
 * Enciende el servidor (http://localhost:3000) y el sitio (http://localhost:5173) juntos:
 *
 *   npm run dev
 *
 * Ctrl+C apaga los dos. Los mensajes de cada uno salen con su etiqueta.
 */
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const raiz = path.join(__dirname, '..');
const esWindows = process.platform === 'win32';
const colores = { servidor: '\x1b[36m', cliente: '\x1b[35m' };
const hijos = [];
let cerrando = false;

function etiquetar(nombre, flujo, destino) {
  let resto = '';
  flujo.on('data', (trozo) => {
    const lineas = (resto + trozo.toString()).split(/\r?\n/);
    resto = lineas.pop();
    for (const linea of lineas) if (linea.trim()) destino.write(`${colores[nombre]}[${nombre}]\x1b[0m ${linea}\n`);
  });
}

function apagar(codigo = 0) {
  if (cerrando) return;
  cerrando = true;
  for (const h of hijos) {
    if (h.exitCode !== null || !h.pid) continue;
    if (esWindows) spawnSync('taskkill', ['/pid', String(h.pid), '/t', '/f']);
    else h.kill('SIGTERM');
  }
  setTimeout(() => process.exit(codigo), 400).unref();
}

function lanzar(nombre, carpeta) {
  const h = spawn('npm', ['run', 'dev', '--prefix', carpeta], { cwd: raiz, shell: esWindows, stdio: ['ignore', 'pipe', 'pipe'] });
  hijos.push(h);
  etiquetar(nombre, h.stdout, process.stdout);
  etiquetar(nombre, h.stderr, process.stderr);
  h.on('exit', (codigo) => {
    if (cerrando) return;
    console.error(`\n✖ Se detuvo el ${nombre} (código ${codigo}). Revisá el mensaje de arriba.`);
    apagar(codigo || 1);
  });
}

lanzar('servidor', 'server');
lanzar('cliente', 'client');
console.log('Encendiendo... el sitio va a estar en http://localhost:5173 (Ctrl+C para apagar).\n');
process.on('SIGINT', () => apagar(0));
process.on('SIGTERM', () => apagar(0));
