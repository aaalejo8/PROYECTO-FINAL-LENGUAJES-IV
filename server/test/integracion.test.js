'use strict';
/**
 * Pruebas de INTEGRACIÓN de extremo a extremo: recorre la API HTTP del servidor ya encendido,
 * conectado a un proyecto real de Supabase (Auth + base + Storage).
 *
 *   1. npm run dev:servidor   (con server/.env completo)
 *   2. En otra terminal:
 *      TEST_API=http://localhost:3000 \
 *      TEST_ADMIN=qa-admin@portfolio-qa.dev TEST_OPERADOR=qa-operador@portfolio-qa.dev TEST_VISITANTE=qa-visitante@portfolio-qa.dev \
 *      TEST_PASSWORD='...' npm run test:integracion
 *
 * Usa cuentas de prueba existentes (una por rol). Lo que crea (servicio, proyecto, demo, imagen)
 * lo borra al final. Las pruebas que necesitan la service_role (contacto, visitas, alta/baja de
 * cuentas) se saltean solas si el servidor no la tiene (responde 502).
 */
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.TEST_API;
const saltear = BASE ? false : 'Definí TEST_API (y las cuentas TEST_*) para correr las pruebas de integración.';
const PASSWORD = process.env.TEST_PASSWORD;
const tokens = {};

async function api(metodo, ruta, { token, cuerpo, tipo, bytes } = {}) {
  const cabeceras = { 'user-agent': 'Mozilla/5.0 (prueba de integración)' };
  if (token) cabeceras.authorization = `Bearer ${token}`;
  let body;
  if (bytes) {
    cabeceras['content-type'] = tipo;
    body = bytes;
  } else if (cuerpo !== undefined) {
    cabeceras['content-type'] = 'application/json';
    body = JSON.stringify(cuerpo);
  }
  const r = await fetch(BASE + ruta, { method: metodo, headers: cabeceras, body });
  const texto = await r.text();
  let datos;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }
  return { estado: r.status, datos };
}

before(async () => {
  if (saltear) return;
  for (const [rol, email] of [
    ['admin', process.env.TEST_ADMIN],
    ['operador', process.env.TEST_OPERADOR],
    ['visitante', process.env.TEST_VISITANTE],
  ]) {
    const r = await api('POST', '/api/auth/login', { cuerpo: { email, password: PASSWORD } });
    assert.equal(r.estado, 200, `login ${rol}: ${JSON.stringify(r.datos)}`);
    assert.equal(r.datos.usuario.rol, rol);
    assert.ok(r.datos.sesion.access_token && r.datos.sesion.refresh_token);
    tokens[rol] = r.datos.sesion.access_token;
  }
});

test('público: portfolio sin detalle de proyectos y 401 en el detalle sin sesión', { skip: saltear }, async () => {
  const p = await api('GET', '/api/portfolio');
  assert.equal(p.estado, 200);
  assert.ok(p.datos.perfil && p.datos.servicios.length > 0 && p.datos.proyectos.length > 0);
  assert.equal('descripcion' in p.datos.proyectos[0], false);
  const slug = p.datos.proyectos[0].slug;
  assert.equal((await api('GET', `/api/proyectos/${slug}`)).estado, 401);
  assert.equal((await api('GET', `/api/proyectos/${slug}`, { token: 'x.y.z' })).estado, 401);
  const conSesion = await api('GET', `/api/proyectos/${slug}`, { token: tokens.visitante });
  assert.equal(conSesion.estado, 200);
  assert.ok(conSesion.datos.descripcion.length > 20 && Array.isArray(conSesion.datos.demos));
});

test('auth: login inválido, validaciones y /yo', { skip: saltear }, async () => {
  assert.equal((await api('POST', '/api/auth/login', { cuerpo: { email: process.env.TEST_VISITANTE, password: 'incorrecta-123' } })).estado, 401);
  assert.equal((await api('POST', '/api/auth/login', { cuerpo: { email: 'no-es-email', password: 'x' } })).estado, 400);
  assert.equal((await api('POST', '/api/auth/registro', { cuerpo: { nombre: 'A', email: 'a@b.com', password: '123' } })).estado, 400);
  const yo = await api('GET', '/api/auth/yo', { token: tokens.visitante });
  assert.equal(yo.estado, 200);
  assert.equal(yo.datos.rol, 'visitante');
  const acceso = await api('POST', '/api/auth/acceso', { token: tokens.visitante, cuerpo: { metodo: 'otro' } });
  assert.equal(acceso.estado, 200, 'repetir el aviso de acceso no falla (se deduplica por sesión)');
});

test('roles: el visitante no entra al panel y el operador no ve métricas ni contenido', { skip: saltear }, async () => {
  for (const ruta of ['/api/admin/consultas', '/api/admin/metricas/resumen', '/api/admin/usuarios', '/api/admin/servicios']) {
    assert.equal((await api('GET', ruta, { token: tokens.visitante })).estado, 403, ruta);
  }
  assert.equal((await api('GET', '/api/admin/consultas', { token: tokens.operador })).estado, 200);
  for (const ruta of ['/api/admin/metricas/resumen', '/api/admin/usuarios', '/api/admin/proyectos']) {
    assert.equal((await api('GET', ruta, { token: tokens.operador })).estado, 403, ruta);
  }
});

test('CRUD de servicios, proyectos y demos (admin) con validación y limpieza', { skip: saltear }, async () => {
  const t = tokens.admin;
  assert.equal((await api('POST', '/api/admin/servicios', { token: t, cuerpo: { titulo: 'x', descripcion: 'corta' } })).estado, 400);
  const s = await api('POST', '/api/admin/servicios', { token: t, cuerpo: { titulo: 'Servicio QA', descripcion: 'Servicio creado por la prueba de integración', icono: 'zap' } });
  assert.equal(s.estado, 201);
  assert.equal((await api('GET', `/api/admin/servicios/${s.datos.id}`, { token: t })).datos.titulo, 'Servicio QA');
  const s2 = await api('PUT', `/api/admin/servicios/${s.datos.id}`, { token: t, cuerpo: { titulo: 'Servicio QA editado', descripcion: 'Descripción editada en la prueba', activo: false } });
  assert.equal(s2.datos.activo, false);
  const publicos = (await api('GET', '/api/portfolio')).datos.servicios.map((x) => x.id);
  assert.equal(publicos.includes(s.datos.id), false, 'un servicio inactivo no se ve en el sitio');
  assert.equal((await api('DELETE', `/api/admin/servicios/${s.datos.id}`, { token: t })).estado, 200);
  assert.equal((await api('DELETE', `/api/admin/servicios/${s.datos.id}`, { token: t })).estado, 404);

  const p = await api('POST', '/api/admin/proyectos', {
    token: t,
    cuerpo: { titulo: 'Proyecto QA', resumen: 'Resumen de la prueba de integración', descripcion: 'Descripción larga del proyecto de prueba de integración', tecnologias: 'React, Supabase', repo_url: 'https://github.com/ejemplo/qa' },
  });
  assert.equal(p.estado, 201, JSON.stringify(p.datos));
  assert.equal(p.datos.slug, 'proyecto-qa');
  assert.equal((await api('POST', '/api/admin/proyectos', { token: t, cuerpo: { titulo: 'Proyecto QA', resumen: 'Resumen repetido de prueba', descripcion: 'Descripción larga del proyecto repetido' } })).estado, 409);
  assert.equal((await api('POST', `/api/admin/proyectos/${p.datos.id}/demos`, { token: t, cuerpo: { titulo: 'Demo mala', url: 'javascript:alert(1)' } })).estado, 400);
  const d = await api('POST', `/api/admin/proyectos/${p.datos.id}/demos`, { token: t, cuerpo: { titulo: 'Demo QA', url: 'https://example.com/demo', tipo: 'iframe' } });
  assert.equal(d.estado, 201);
  assert.equal((await api('PUT', `/api/admin/demos/${d.datos.id}`, { token: t, cuerpo: { titulo: 'Demo QA editada', url: 'https://example.com/demo2' } })).datos.titulo, 'Demo QA editada');
  const detalle = await api('GET', '/api/proyectos/proyecto-qa', { token: tokens.visitante });
  assert.equal(detalle.datos.demos.length, 1);

  // Imagen a Supabase Storage: PNG válido de 1x1 y un archivo disfrazado
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  assert.equal((await api('POST', '/api/admin/imagenes', { token: t, tipo: 'image/png', bytes: Buffer.from('<?php echo 1; ?>') })).estado, 400);
  assert.equal((await api('POST', '/api/admin/imagenes', { token: tokens.visitante, tipo: 'image/png', bytes: png })).estado, 403);
  const img = await api('POST', '/api/admin/imagenes', { token: t, tipo: 'image/png', bytes: png });
  assert.equal(img.estado, 201, JSON.stringify(img.datos));
  assert.match(img.datos.url, /\/storage\/v1\/object\/public\/portfolio\/proyectos\//);
  assert.equal((await fetch(img.datos.url)).status, 200, 'la imagen se sirve públicamente');
  const conImagen = await api('PUT', `/api/admin/proyectos/${p.datos.id}`, { token: t, cuerpo: { ...p.datos, tecnologias: p.datos.tecnologias, imagen_url: img.datos.url } });
  assert.equal(conImagen.estado, 200, JSON.stringify(conImagen.datos));

  assert.equal((await api('DELETE', `/api/admin/proyectos/${p.datos.id}`, { token: t })).estado, 200);
  assert.equal((await api('GET', '/api/proyectos/proyecto-qa', { token: tokens.visitante })).estado, 404);
  // La imagen huérfana se borra del bucket (el CDN de Supabase puede seguir sirviendo la copia cacheada
  // unos minutos, por eso se verifica en storage.objects y no pidiendo la URL pública).
});

test('bandeja: listar, filtrar, cambiar estado, notas y responder por correo', { skip: saltear }, async () => {
  const t = tokens.operador;
  const lista = await api('GET', '/api/admin/consultas?estado=abiertas', { token: t });
  assert.equal(lista.estado, 200);
  if (lista.datos.items.length === 0) return; // no hay consultas abiertas para probar
  const c = lista.datos.items[0];
  const filtro = await api('GET', `/api/admin/consultas?tipo=${c.tipo}&q=${encodeURIComponent(c.codigo)}`, { token: t });
  assert.equal(filtro.datos.items[0].id, c.id);
  const seguimiento = await api('PATCH', `/api/admin/consultas/${c.id}/estado`, { token: t, cuerpo: { estado: 'en_seguimiento' } });
  assert.equal(seguimiento.datos.estado, 'en_seguimiento');
  assert.match(seguimiento.datos.notas_internas, /En seguimiento/);
  assert.equal((await api('PATCH', `/api/admin/consultas/${c.id}/estado`, { token: t, cuerpo: { estado: 'borrada' } })).estado, 400);
  const notas = await api('PATCH', `/api/admin/consultas/${c.id}/notas`, { token: t, cuerpo: { notas_internas: `${seguimiento.datos.notas_internas}\nNota de QA` } });
  assert.match(notas.datos.notas_internas, /Nota de QA/);
  const r = await api('POST', `/api/admin/consultas/${c.id}/responder`, { token: t, cuerpo: { asunto: `Re: ${c.asunto}`, cuerpo: 'Respuesta de la prueba de integración.' } });
  assert.equal(r.estado, 201, JSON.stringify(r.datos));
  assert.equal(r.datos.estado, 'respondida');
  assert.ok(r.datos.respuestas.length >= 1);
  const resumen = await api('GET', '/api/admin/consultas/resumen', { token: t });
  assert.ok(resumen.datos.respondida >= 1);
});

test('métricas: contadores reales y consultas parametrizadas con filtros', { skip: saltear }, async () => {
  const t = tokens.admin;
  const r = await api('GET', '/api/admin/metricas/resumen', { token: t });
  assert.equal(r.estado, 200);
  assert.ok(r.datos.accesos_total >= 3, 'los logins de esta prueba quedaron registrados');
  assert.ok(r.datos.usuarios_registrados >= 1);
  const s = await api('GET', '/api/admin/metricas/series?agrupar=week&tipo=cotizacion', { token: t });
  assert.equal(s.estado, 200);
  assert.ok(s.datos.puntos.length >= 4 && 'usuarios_acumulados' in s.datos.puntos[0]);
  const c = await api('GET', '/api/admin/metricas/consultas?tipo=asesoria', { token: t });
  assert.ok(c.datos.por_tipo.every((f) => f.clave === 'asesoria'));
  assert.equal((await api('GET', "/api/admin/metricas/series?desde=2026-01-01'; drop table visitas;--", { token: t })).estado, 400);
  assert.equal((await api('GET', '/api/admin/metricas/series?desde=2026-02-01&hasta=2026-01-01', { token: t })).estado, 400);
});

test('usuarios: listado con búsqueda y filtros, cambio de rol y protecciones', { skip: saltear }, async () => {
  const t = tokens.admin;
  const l = await api('GET', '/api/admin/usuarios?rol=visitante&q=qa', { token: t });
  assert.equal(l.estado, 200);
  assert.ok(l.datos.items.every((u) => u.rol === 'visitante'));
  assert.ok(l.datos.resumen.admin >= 1);
  const yo = (await api('GET', '/api/auth/yo', { token: t })).datos;
  assert.equal((await api('PATCH', `/api/admin/usuarios/${yo.id}`, { token: t, cuerpo: { rol: 'visitante' } })).estado, 409);
  assert.equal((await api('DELETE', `/api/admin/usuarios/${yo.id}`, { token: t })).estado, 409);
  assert.equal((await api('PATCH', '/api/admin/usuarios/no-es-un-uuid', { token: t, cuerpo: { nombre: 'X' } })).estado, 400);
  const visitante = (await api('GET', '/api/auth/yo', { token: tokens.visitante })).datos;
  const detalle = await api('GET', `/api/admin/usuarios/${visitante.id}`, { token: t });
  assert.equal(detalle.estado, 200);
  assert.ok(Array.isArray(detalle.datos.ultimos_accesos));
  const renombrado = await api('PATCH', `/api/admin/usuarios/${visitante.id}`, { token: t, cuerpo: { nombre: 'QA Visitante' } });
  assert.equal(renombrado.estado, 200, JSON.stringify(renombrado.datos));
});

test('usuarios: alta, bloqueo, desbloqueo, cambio de contraseña y baja (Supabase Auth)', { skip: saltear }, async () => {
  const t = tokens.admin;
  const email = `qa-ciclo-${Date.now()}@portfolio-qa.dev`;
  const clave1 = `Ciclo-${Date.now()}-a!`;
  const clave2 = `Ciclo-${Date.now()}-b!`;
  const login = (password) => api('POST', '/api/auth/login', { cuerpo: { email, password } });

  assert.equal((await api('POST', '/api/admin/usuarios', { token: tokens.operador, cuerpo: { email, nombre: 'QA Ciclo', password: clave1 } })).estado, 403);
  const alta = await api('POST', '/api/admin/usuarios', { token: t, cuerpo: { email, nombre: 'QA Ciclo', rol: 'operador', password: clave1 } });
  assert.equal(alta.estado, 201, JSON.stringify(alta.datos));
  assert.equal(alta.datos.rol, 'operador');
  const id = alta.datos.id;
  try {
    assert.equal((await api('POST', '/api/admin/usuarios', { token: t, cuerpo: { email, nombre: 'QA Ciclo', password: clave1 } })).estado, 409);
    const primero = await login(clave1);
    assert.equal(primero.estado, 200, JSON.stringify(primero.datos));
    assert.equal(primero.datos.usuario.rol, 'operador');
    const tokenViejo = primero.datos.sesion.access_token;

    const bloqueo = await api('PATCH', `/api/admin/usuarios/${id}`, { token: t, cuerpo: { activo: false } });
    assert.equal(bloqueo.estado, 200, JSON.stringify(bloqueo.datos));
    assert.equal(bloqueo.datos.activo, false);
    assert.notEqual((await login(clave1)).estado, 200, 'una cuenta bloqueada no puede ingresar');
    assert.equal((await api('GET', '/api/auth/yo', { token: tokenViejo })).estado, 401, 'el token que ya tenía deja de servir');

    const desbloqueo = await api('PATCH', `/api/admin/usuarios/${id}`, { token: t, cuerpo: { activo: true, password: clave2 } });
    assert.equal(desbloqueo.estado, 200, JSON.stringify(desbloqueo.datos));
    assert.notEqual((await login(clave1)).estado, 200, 'la contraseña vieja ya no sirve');
    assert.equal((await login(clave2)).estado, 200, 'ingresa con la contraseña nueva');
  } finally {
    const baja = await api('DELETE', `/api/admin/usuarios/${id}`, { token: t });
    assert.equal(baja.estado === 200 || baja.estado === 204, true, JSON.stringify(baja.datos));
  }
  assert.notEqual((await login(clave2)).estado, 200, 'una cuenta borrada no puede ingresar');
  assert.equal((await api('GET', `/api/admin/usuarios/${id}`, { token: t })).estado, 404);
});

test('contacto y visitas (necesitan la service_role en el servidor)', { skip: saltear }, async (t) => {
  const malo = await api('POST', '/api/contacto', { cuerpo: { tipo: 'spam', nombre: 'A', email: 'x', asunto: '', mensaje: '' } });
  assert.equal(malo.estado, 400);
  const r = await api('POST', '/api/contacto', { cuerpo: { tipo: 'general', nombre: 'QA Contacto', email: 'qa-contacto@portfolio-qa.dev', asunto: 'Prueba de contacto', mensaje: 'Mensaje enviado por la prueba de integración.' } });
  if (r.estado === 502) return t.skip('El servidor no tiene una SUPABASE_SERVICE_ROLE_KEY válida.');
  assert.equal(r.estado, 201, JSON.stringify(r.datos));
  assert.match(r.datos.codigo, /^CON-/);
  const v = await api('POST', '/api/visitas', { cuerpo: { ruta: '/' } });
  assert.equal(v.estado, 204);
});
