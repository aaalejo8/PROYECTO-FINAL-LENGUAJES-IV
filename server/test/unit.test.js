'use strict';
/** Pruebas unitarias: no necesitan base de datos. */
const { test } = require('node:test');
const assert = require('node:assert/strict');

// Supabase no se usa en estas pruebas, pero algunos módulos crean el cliente al importarse
process.env.SUPABASE_URL = 'https://proyecto-de-prueba.supabase.co';
process.env.SUPABASE_ANON_KEY = 'clave-publica-de-prueba';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-privada-de-prueba';

const v = require('../src/validar');
const seg = require('../src/seguridad');
const { firmaValida, rutaEnBucket } = require('../src/imagenes');
const correo = require('../src/correo');
const { sesionDelToken } = require('../src/permisos');
const { traducir } = require('../src/supabase');
const metricas = require('../src/metricas');

const falla = (fn, mensaje) => assert.throws(fn, (e) => e.estado === 400 && (!mensaje || mensaje.test(e.message)));

test('validar.texto: recorta, exige y limita', () => {
  assert.equal(v.texto('  hola  ', 'El campo'), 'hola');
  falla(() => v.texto('', 'El campo', { obligatorio: true }));
  falla(() => v.texto('a', 'El campo', { min: 3 }));
  falla(() => v.texto('x'.repeat(11), 'El campo', { max: 10 }));
  falla(() => v.texto(123, 'El campo'));
});

test('validar.email: normaliza y rechaza formatos raros', () => {
  assert.equal(v.email('  Ana@Example.COM ', 'El email', { obligatorio: true }), 'ana@example.com');
  for (const malo of ['sin-arroba', 'a@b', 'a b@c.com', '@c.com', 'a@@c.com']) falla(() => v.email(malo, 'El email', { obligatorio: true }));
});

test('validar.url: sólo http(s) y, si se pide, sólo https', () => {
  assert.equal(v.url('https://example.com/a', 'El link'), 'https://example.com/a');
  falla(() => v.url('javascript:alert(1)', 'El link'));
  falla(() => v.url('ftp://example.com', 'El link'));
  falla(() => v.url('http://example.com', 'El link', { soloHttps: true }));
  assert.equal(v.url('', 'El link'), '');
});

test('validar.slug y lista', () => {
  assert.equal(v.slug('Mi Proyecto Ñandú 2026!', 'El link'), 'mi-proyecto-nandu-2026');
  assert.deepEqual(v.lista('React, Node.js , ,React', 'Tecnologías'), ['React', 'Node.js']);
  falla(() => v.lista(Array.from({ length: 20 }, (_, i) => `t${i}`), 'Tecnologías', { max: 12 }));
});

test('validar.validarPassword exige largo mínimo', () => {
  falla(() => v.validarPassword('corta'));
  assert.equal(typeof v.validarPassword('una-clave-larga-123'), 'string');
});

test('validar.fecha acepta AAAA-MM-DD reales', () => {
  assert.equal(v.fecha('2026-02-28', 'La fecha'), '2026-02-28');
  falla(() => v.fecha('2026-02-31', 'La fecha'));
  falla(() => v.fecha('28/02/2026', 'La fecha'));
  falla(() => v.fecha("2026-01-01'; DROP TABLE x;--", 'La fecha'));
});

test('seguridad.limitar corta con 429 al pasar el máximo', async () => {
  const freno = seg.limitar({ ventanaMs: 60_000, max: 2, mensaje: 'Pará un poco' });
  const ctx = { ip: '1.2.3.4', res: { setHeader() {} } };
  await freno(ctx);
  await freno(ctx);
  await assert.rejects(freno(ctx), (e) => e.estado === 429 && /Pará/.test(e.message));
  await freno({ ip: '5.6.7.8', res: { setHeader() {} } }); // otra IP no se ve afectada
});

test('seguridad.crearBloqueoPorFallos: bloquea por fallos y un éxito lo reinicia', () => {
  const b = seg.crearBloqueoPorFallos({ ventanaMs: 60_000, max: 2, mensaje: 'Bloqueado' });
  const ctx = { res: { setHeader() {} } };
  b.fallo('x');
  b.verificar(ctx, 'x');
  b.fallo('x');
  assert.throws(() => b.verificar(ctx, 'x'), (e) => e.estado === 429);
  b.exito('x');
  b.verificar(ctx, 'x');
});

test('permisos.sesionDelToken lee el session_id del token de Supabase', () => {
  const cuerpo = Buffer.from(JSON.stringify({ sub: 'u', session_id: 'abc-123' })).toString('base64url');
  assert.equal(sesionDelToken(`x.${cuerpo}.y`), 'abc-123');
  assert.equal(sesionDelToken('basura'), null);
});

test('supabase.traducir convierte errores de la base en respuestas HTTP claras', () => {
  assert.equal(traducir({ code: '23505', message: 'duplicate' }, { conflicto: 'Repetido' }).estado, 409);
  assert.equal(traducir({ code: '42501', message: 'new row violates row-level security policy' }).estado, 403);
  const propio = traducir({ code: 'P0001', message: 'Tiene que quedar al menos un administrador activo.' });
  assert.equal(propio.estado, 409);
  assert.match(propio.message, /administrador/);
  assert.equal(traducir({ code: '22023', message: 'El rango máximo es de 2 años.' }).estado, 400);
  assert.equal(traducir({ code: '23514', message: 'check' }).estado, 400);
  assert.equal(traducir(null), null);
});

test('imagenes.rutaEnBucket sólo reconoce URLs de nuestro bucket', () => {
  const base = 'https://proyecto-de-prueba.supabase.co/storage/v1/object/public/portfolio/';
  assert.equal(rutaEnBucket(`${base}proyectos/abc123.webp`), 'proyectos/abc123.webp');
  assert.equal(rutaEnBucket(`${base}../otro-bucket/x.png`), '');
  assert.equal(rutaEnBucket('https://example.com/proyectos/x.png'), '');
});

test('correo: las plantillas HTML escapan lo que escribe el visitante', () => {
  const c = { codigo: 'CON-ABC234', nombre: '<script>x</script> Ana', email: 'a@b.com', telefono: null, asunto: '"Hola" & <b>', mensaje: 'Línea 1\n\n<img src=x onerror=alert(1)>' };
  const aviso = correo.avisoDeConsulta(c, 'Consulta general');
  assert.doesNotMatch(aviso.html, /<script>|<img src=x/);
  assert.match(aviso.html, /&lt;script&gt;/);
  assert.match(aviso.texto, /CON-ABC234/);
  const r = correo.respuestaAConsulta({ consulta: c, cuerpo: 'Gracias <b>', autor: 'Operador' });
  assert.match(r.html, /Gracias &lt;b&gt;/);
});

test('imagenes.firmaValida mira los primeros bytes, no la extensión', () => {
  assert.equal(firmaValida(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]), 'jpg'), true);
  assert.equal(firmaValida(Buffer.from('<?php ?>'), 'jpg'), false);
  assert.equal(firmaValida(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), 'png'), true);
  assert.equal(firmaValida(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]), 'webp'), true);
  assert.equal(firmaValida(Buffer.from('GIF89a......'), 'png'), false);
});

test('metricas.leerParametros: rangos y agrupaciones válidas', () => {
  const p = metricas.leerParametros({ desde: '2026-01-01', hasta: '2026-01-31', agrupar: 'week' });
  assert.deepEqual(p, { desde: '2026-01-01', hasta: '2026-01-31', agrupar: 'week', tipo: null });
  assert.equal(metricas.leerParametros({ tipo: 'cotizacion' }).tipo, 'cotizacion');
  falla(() => metricas.leerParametros({ tipo: 'spam' }));
  assert.equal(metricas.leerParametros({}).agrupar, 'day');
  falla(() => metricas.leerParametros({ desde: '2026-02-01', hasta: '2026-01-01' }));
  falla(() => metricas.leerParametros({ desde: '2026-01-01', hasta: '2026-12-31', agrupar: 'day' }), /180/);
  falla(() => metricas.leerParametros({ desde: '2020-01-01', hasta: '2026-12-31', agrupar: 'month' }), /2 años/);
  falla(() => metricas.leerParametros({ agrupar: 'hora' }));
});
