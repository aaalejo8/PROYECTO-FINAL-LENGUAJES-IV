'use strict';
/**
 * Pruebas de la BASE DE DATOS: ejecuta las migraciones reales de supabase/migrations/ sobre un
 * PostgreSQL local en memoria (PGlite) y verifica restricciones, triggers, Row Level Security
 * y las consultas parametrizadas de métricas, actuando como cada rol de Supabase
 * (anon, authenticated con distintos perfiles, service_role).
 *
 *   npm test
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const carpetaMigraciones = path.join(__dirname, '..', '..', 'supabase', 'migrations');
let db;

const IDS = {
  admin: '00000000-0000-4000-8000-000000000001',
  operador: '00000000-0000-4000-8000-000000000002',
  visitante: '00000000-0000-4000-8000-000000000003',
  otro: '00000000-0000-4000-8000-000000000004',
};

/** Ejecuta `fn` como un rol de Supabase (y opcionalmente un usuario) dentro de una transacción que se deshace. */
async function como(rol, uid, fn, { confirmar = false } = {}) {
  await db.exec('begin');
  try {
    await db.query(`select set_config('role', $1, true)`, [rol]);
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(uid ? { sub: uid, role: rol } : { role: rol })]);
    const r = await fn();
    await db.exec(confirmar ? 'commit' : 'rollback');
    return r;
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}
const filas = async (sql, params) => (await db.query(sql, params)).rows;

before(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  db = new PGlite();
  await db.exec(fs.readFileSync(path.join(__dirname, 'supabase-stub.sql'), 'utf8'));
  for (const archivo of fs.readdirSync(carpetaMigraciones).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(carpetaMigraciones, archivo), 'utf8'));
  }
  // Usuarios: los crea "Supabase Auth" (insert en auth.users) y el trigger arma el perfil
  for (const [clave, id] of Object.entries(IDS)) {
    await db.query(`insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3, $4)`, [
      id,
      `${clave}@example.com`,
      JSON.stringify({ nombre: `Usuario ${clave}`, rol: 'admin' /* intento de escalar privilegios: se ignora */ }),
      JSON.stringify({ provider: clave === 'otro' ? 'google' : 'email' }),
    ]);
  }
  await db.query(`update public.perfiles set rol = 'admin' where id = $1`, [IDS.admin]);
  await db.query(`update public.perfiles set rol = 'operador' where id = $1`, [IDS.operador]);
  await db.exec(`
    insert into public.perfil_sitio (id, nombre, titular, bio) values (1, 'Dev', 'Fullstack', 'Biografía de prueba larga');
    insert into public.servicios (titulo, descripcion, activo) values ('Servicio visible', 'Descripción del servicio', true), ('Servicio oculto', 'Descripción del servicio', false);
    insert into public.proyectos (slug, titulo, resumen, descripcion) values ('proyecto-uno', 'Proyecto uno', 'Resumen del proyecto', 'Descripción completa del proyecto uno');
    insert into public.proyectos (slug, titulo, resumen, descripcion, activo) values ('proyecto-oculto', 'Proyecto oculto', 'Resumen del proyecto', 'Descripción completa del proyecto', false);
    insert into public.demos (proyecto_id, titulo, url) select id, 'Demo uno', 'https://example.com' from public.proyectos where slug = 'proyecto-uno';
    insert into public.consultas (codigo, tipo, nombre, email, asunto, mensaje) values
      ('CON-AAAAAA', 'general', 'Ana', 'ana@example.com', 'Hola', 'Mensaje de prueba uno'),
      ('CON-BBBBBB', 'cotizacion', 'Beto', 'beto@example.com', 'Presupuesto', 'Mensaje de prueba dos');
  `);
});

after(async () => {
  await db?.close();
});

// ───────────────────────────── Auth y perfiles ─────────────────────────────

test('el trigger crea el perfil como visitante aunque el registro pida otro rol', async () => {
  const [p] = await filas(`select rol, nombre, proveedor from public.perfiles where id = $1`, [IDS.visitante]);
  assert.deepEqual(p, { rol: 'visitante', nombre: 'Usuario visitante', proveedor: 'email' });
  const [g] = await filas(`select proveedor from public.perfiles where id = $1`, [IDS.otro]);
  assert.equal(g.proveedor, 'google');
});

test('un visitante sólo ve su propio perfil y no puede editarlo ni cambiarse el rol', async () => {
  await como('authenticated', IDS.visitante, async () => {
    const lista = await filas('select id from public.perfiles');
    assert.deepEqual(lista.map((f) => f.id), [IDS.visitante]);
    const r = await db.query(`update public.perfiles set rol = 'admin' where id = $1`, [IDS.visitante]);
    assert.equal(r.affectedRows, 0);
  });
});

test('el admin ve todos los perfiles y puede cambiar roles de otros', async () => {
  await como('authenticated', IDS.admin, async () => {
    assert.equal((await filas('select id from public.perfiles')).length, 4);
    const r = await db.query(`update public.perfiles set rol = 'operador' where id = $1`, [IDS.visitante]);
    assert.equal(r.affectedRows, 1);
  });
});

test('el admin no puede cambiarse su propio rol ni dejar el sistema sin administradores', async () => {
  await assert.rejects(
    como('authenticated', IDS.admin, () => db.query(`update public.perfiles set rol = 'visitante' where id = $1`, [IDS.admin])),
    /propio rol/
  );
  await assert.rejects(
    como('service_role', null, () => db.query(`update public.perfiles set activo = false where id = $1`, [IDS.admin])),
    /al menos un administrador/
  );
  await assert.rejects(
    // Supabase Auth borra el usuario de auth.users (rol del sistema) → el perfil se borra en cascada
    como('postgres', null, () => db.query(`delete from auth.users where id = $1`, [IDS.admin])),
    /al menos un administrador/
  );
});

// ───────────────────────────── Contenido ─────────────────────────────

test('anónimo: ve servicios activos y tarjetas de proyectos, pero NO el detalle ni las demos', async () => {
  await como('anon', null, async () => {
    assert.deepEqual((await filas('select titulo from public.servicios')).map((f) => f.titulo), ['Servicio visible']);
    assert.equal((await filas('select * from public.proyectos')).length, 0);
    assert.equal((await filas('select * from public.demos')).length, 0);
    const tarjetas = await filas('select * from public.proyectos_publicos()');
    assert.equal(tarjetas.length, 1);
    assert.equal(tarjetas[0].slug, 'proyecto-uno');
    assert.equal(tarjetas[0].cantidad_demos, 1);
    assert.equal('descripcion' in tarjetas[0], false);
  });
});

test('autenticado: ve el detalle y las demos de proyectos activos, no los ocultos', async () => {
  await como('authenticated', IDS.visitante, async () => {
    const p = await filas('select slug, descripcion from public.proyectos');
    assert.deepEqual(p.map((f) => f.slug), ['proyecto-uno']);
    assert.equal((await filas('select * from public.demos')).length, 1);
  });
});

test('sólo el admin puede crear, editar y borrar proyectos, demos y servicios', async () => {
  await assert.rejects(
    como('authenticated', IDS.visitante, () => db.query(`insert into public.servicios (titulo, descripcion) values ('Hackeado', 'No debería poder')`)),
    /row-level security/
  );
  await assert.rejects(
    como('authenticated', IDS.operador, () => db.query(`insert into public.proyectos (slug, titulo, resumen, descripcion) values ('x-y-z', 'Titulo', 'Resumen largo', 'Descripción larga del proyecto')`)),
    /row-level security/
  );
  await como('authenticated', IDS.visitante, async () => {
    assert.equal((await db.query(`delete from public.demos`)).affectedRows, 0);
    assert.equal((await db.query(`update public.proyectos set titulo = 'Cambiado'`)).affectedRows, 0);
  });
  await como('authenticated', IDS.admin, async () => {
    await db.query(`insert into public.servicios (titulo, descripcion) values ('Nuevo servicio', 'Descripción válida')`);
    const [p] = await filas(`insert into public.proyectos (slug, titulo, resumen, descripcion) values ('nuevo', 'Nuevo', 'Resumen válido', 'Descripción válida del nuevo') returning id`);
    await db.query(`insert into public.demos (proyecto_id, titulo, url) values ($1, 'Demo nueva', 'https://example.org')`, [p.id]);
    assert.equal((await db.query(`delete from public.proyectos where id = $1`, [p.id])).affectedRows, 1);
    assert.equal((await filas('select * from public.demos where proyecto_id = $1', [p.id])).length, 0, 'las demos se borran en cascada');
  });
});

test('las restricciones CHECK rechazan datos inválidos aunque se salteen las validaciones del servidor', async () => {
  const casos = [
    `insert into public.demos (proyecto_id, titulo, url) select id, 'Demo', 'javascript:alert(1)' from public.proyectos limit 1`,
    `insert into public.proyectos (slug, titulo, resumen, descripcion) values ('Slug Con Espacios', 'Titulo', 'Resumen largo', 'Descripción larga del proyecto')`,
    `insert into public.consultas (codigo, tipo, nombre, email, asunto, mensaje) values ('CON-CCCCCC', 'spam', 'Ana', 'ana@example.com', 'Hola', 'Mensaje largo')`,
    `insert into public.consultas (codigo, tipo, nombre, email, asunto, mensaje) values ('CON-DDDDDD', 'general', 'Ana', 'no-es-un-email', 'Hola', 'Mensaje largo')`,
    `insert into public.servicios (titulo, descripcion, icono) values ('Servicio', 'Descripción válida', 'icono-inexistente')`,
  ];
  for (const sql of casos) {
    await assert.rejects(como('service_role', null, () => db.query(sql)), /check constraint/, sql);
  }
});

// ───────────────────────────── Consultas ─────────────────────────────

test('consultas: anónimos y visitantes no las ven ni las crean directo; operador sí las gestiona', async () => {
  await como('anon', null, async () => assert.equal((await filas('select * from public.consultas')).length, 0));
  await assert.rejects(
    como('anon', null, () => db.query(`insert into public.consultas (codigo, tipo, nombre, email, asunto, mensaje) values ('CON-EEEEEE', 'general', 'Spam', 'spam@example.com', 'Spam', 'Mensaje de spam directo')`)),
    /row-level security/
  );
  await como('authenticated', IDS.visitante, async () => assert.equal((await filas('select * from public.consultas')).length, 0));
  await como('authenticated', IDS.operador, async () => {
    assert.equal((await filas('select * from public.consultas')).length, 2);
    const r = await db.query(`update public.consultas set estado = 'en_seguimiento' where codigo = 'CON-AAAAAA'`);
    assert.equal(r.affectedRows, 1);
    const [c] = await filas(`select id from public.consultas where codigo = 'CON-AAAAAA'`);
    await db.query(`insert into public.respuestas (consulta_id, autor_id, autor_nombre, asunto, cuerpo) values ($1, $2, 'Operador', 'Re: Hola', 'Gracias por escribir')`, [c.id, IDS.operador]);
    const resumen = (await filas('select public.consultas_resumen() as r'))[0].r;
    assert.equal(resumen.en_seguimiento, 1);
    // no puede firmar una respuesta a nombre de otro
    await assert.rejects(
      db.query(`insert into public.respuestas (consulta_id, autor_id, autor_nombre, asunto, cuerpo) values ($1, $2, 'X', 'Re: Hola', 'Suplantando')`, [c.id, IDS.admin]),
      /row-level security/
    );
  });
});

test('la búsqueda ignora acentos y mayúsculas (columna generada)', async () => {
  await db.query(`insert into public.consultas (codigo, tipo, nombre, email, asunto, mensaje) values ('CON-FFFFFF', 'asesoria', 'José García', 'jose@example.com', 'Asesoría', 'Mensaje de prueba tres')`);
  const r = await filas(`select codigo from public.consultas where busqueda like '%garcia%'`);
  assert.deepEqual(r.map((f) => f.codigo), ['CON-FFFFFF']);
});

// ───────────────────────────── Métricas ─────────────────────────────

test('visitas: se registran sólo por el servidor y no se cuentan dos veces en 30 minutos', async () => {
  await assert.rejects(como('anon', null, () => db.query(`select public.registrar_visita('/', 'abcdef0123456789', null)`)), /permission denied/);
  await assert.rejects(como('anon', null, () => db.query(`insert into public.visitas (visitante_hash) values ('abcdef0123456789')`)), /row-level security/);
  const contar = (hash, usuario = null) =>
    como('service_role', null, async () => (await filas(`select public.registrar_visita('/', $1, $2) as ok`, [hash, usuario]))[0].ok, { confirmar: true });
  assert.equal(await contar('abcdef0123456789'), true);
  assert.equal(await contar('abcdef0123456789'), false, 'la misma sesión no suma otra visita');
  assert.equal(await contar('abcdef0123456789', IDS.visitante), false);
  assert.equal(await contar('0123456789abcdef', IDS.visitante), true);
  const [v] = await filas(`select count(*)::int as total, count(usuario_id)::int as autenticadas from public.visitas`);
  assert.deepEqual(v, { total: 2, autenticadas: 2 }, 'la visita anónima pasó a autenticada al iniciar sesión');
  await assert.rejects(contar('no-es-un-hash'), /inválido/);
});

test('accesos: cada usuario registra sólo los suyos y una sesión cuenta una sola vez', async () => {
  const sesion = '11111111-1111-4111-8111-111111111111';
  await assert.rejects(
    como('authenticated', IDS.visitante, () =>
      db.query(`insert into public.accesos (usuario_id, sesion_id, metodo) values ($1, gen_random_uuid(), 'password')`, [IDS.otro])
    ),
    /row-level security/
  );
  await como(
    'authenticated',
    IDS.visitante,
    async () => {
      await db.query(`insert into public.accesos (usuario_id, sesion_id, metodo) values ($1, $2, 'password') on conflict do nothing`, [IDS.visitante, sesion]);
      await db.query(`insert into public.accesos (usuario_id, sesion_id, metodo) values ($1, $2, 'password') on conflict do nothing`, [IDS.visitante, sesion]);
    },
    { confirmar: true }
  );
  const [a] = await filas(`select count(*)::int as n from public.accesos`);
  assert.equal(a.n, 1);
});

test('métricas: sólo el admin las consulta; los parámetros se validan en la base', async () => {
  await assert.rejects(como('authenticated', IDS.operador, () => db.query(`select public.metricas_resumen()`)), /administrador/);
  await assert.rejects(como('anon', null, () => db.query(`select public.metricas_resumen()`)), /permission denied/);
  await como('authenticated', IDS.admin, async () => {
    const r = (await filas(`select public.metricas_resumen('America/Argentina/Salta') as r`))[0].r;
    assert.equal(r.visitas_total, 2);
    assert.equal(r.usuarios_registrados, 2);
    assert.equal(r.accesos_total, 1);
    assert.equal(r.consultas_total, 3);

    const hoy = (await filas(`select (now() at time zone 'America/Argentina/Salta')::date::text as d`))[0].d;
    const serie = await filas(`select * from public.metricas_series(($1::date - 6), $1::date, 'day', 'America/Argentina/Salta', null)`, [hoy]);
    assert.equal(serie.length, 7, 'un punto por día, incluidos los días sin datos');
    const ultimo = serie.at(-1);
    assert.equal(ultimo.visitas, 2);
    assert.equal(ultimo.accesos, 1);
    assert.equal(ultimo.registros, 2);
    assert.equal(ultimo.usuarios_acumulados, 2);
    assert.equal(ultimo.consultas, 3);

    const soloCotizacion = await filas(`select * from public.metricas_series(($1::date - 6), $1::date, 'day', 'America/Argentina/Salta', 'cotizacion')`, [hoy]);
    assert.equal(soloCotizacion.at(-1).consultas, 1, 'el filtro por tipo de consulta se aplica');

    const porTipo = (await filas(`select public.metricas_consultas(($1::date - 6), $1::date, 'America/Argentina/Salta', null) as r`, [hoy]))[0].r;
    assert.equal(porTipo.por_tipo.reduce((s, f) => s + f.cantidad, 0), 3);
    assert.equal(porTipo.por_estado.length >= 1, true);

    const mensual = await filas(`select * from public.metricas_series(($1::date - 364), $1::date, 'month', 'America/Argentina/Salta', null)`, [hoy]);
    assert.ok(mensual.length >= 12 && mensual.length <= 13);
  });
  for (const [desde, hasta, agrupar] of [
    ['2026-02-01', '2026-01-01', 'day'],
    ['2020-01-01', '2026-01-01', 'month'],
    ['2025-01-01', '2026-01-01', 'day'],
    ['2026-01-01', '2026-01-10', 'hora; drop table visitas'],
  ]) {
    await assert.rejects(
      como('authenticated', IDS.admin, () => db.query(`select * from public.metricas_series($1, $2, $3)`, [desde, hasta, agrupar])),
      /posterior|máximo|180 días|agrupación/
    );
  }
});

test('storage: sólo el admin puede subir imágenes al bucket del portfolio', async () => {
  const [b] = await filas(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'portfolio'`);
  assert.equal(b.public, true);
  assert.equal(Number(b.file_size_limit), 4 * 1024 * 1024);
  await assert.rejects(
    como('authenticated', IDS.visitante, () => db.query(`insert into storage.objects (bucket_id, name) values ('portfolio', 'x.png')`)),
    /row-level security/
  );
  await como('authenticated', IDS.admin, () => db.query(`insert into storage.objects (bucket_id, name) values ('portfolio', 'proyectos/x.png')`));
});

test('las migraciones se pueden volver a ejecutar sin errores ni pérdida de datos', async () => {
  const antes = (await filas('select count(*)::int as n from public.consultas'))[0].n;
  for (const archivo of fs.readdirSync(carpetaMigraciones).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(carpetaMigraciones, archivo), 'utf8'));
  }
  assert.equal((await filas('select count(*)::int as n from public.consultas'))[0].n, antes);
});

test('supabase/seed.sql carga el contenido de ejemplo en una base nueva y no duplica si se repite', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const nueva = new PGlite();
  try {
    await nueva.exec(fs.readFileSync(path.join(__dirname, 'supabase-stub.sql'), 'utf8'));
    for (const archivo of fs.readdirSync(carpetaMigraciones).filter((f) => f.endsWith('.sql')).sort()) {
      await nueva.exec(fs.readFileSync(path.join(carpetaMigraciones, archivo), 'utf8'));
    }
    const seed = fs.readFileSync(path.join(carpetaMigraciones, '..', 'seed.sql'), 'utf8');
    await nueva.exec(seed);
    await nueva.exec(seed);
    const n = async (t) => (await nueva.query(`select count(*)::int as n from public.${t}`)).rows[0].n;
    assert.equal(await n('perfil_sitio'), 1);
    assert.ok((await n('proyectos')) >= 3);
    assert.ok((await n('servicios')) >= 3);
    assert.ok((await n('demos')) >= 1);
  } finally {
    await nueva.close();
  }
});
