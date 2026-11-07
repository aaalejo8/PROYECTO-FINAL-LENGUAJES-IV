'use strict';
/**
 * Genera supabase/seed.sql a partir de los datos de scripts/seed.js, para quien prefiera cargar el
 * contenido de ejemplo pegándolo en el SQL Editor de Supabase (o con `supabase db reset`).
 *   node scripts/generar-seed-sql.js
 */
const fs = require('fs');
const path = require('path');
const { PERFIL, TECNOLOGIAS, EXPERIENCIA, SERVICIOS, PROYECTOS } = require('./seed');

const q = (v) => (v === null || v === undefined ? 'null' : typeof v === 'boolean' || typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(q).join(', ')}]::text[]`;
const l = [];
l.push('-- Contenido de ejemplo (generado por server/scripts/generar-seed-sql.js). Sólo inserta si las tablas están vacías.');
l.push('begin;');
const P = PERFIL;
l.push(`insert into public.perfil_sitio (id, nombre, titular, bio, ubicacion, email_publico, github_usuario, linkedin_url, disponible, anios_experiencia)
select 1, ${[P.nombre, P.titular, P.bio, P.ubicacion, P.email_publico, P.github_usuario, P.linkedin_url, P.disponible, P.anios_experiencia].map(q).join(', ')}
where not exists (select 1 from public.perfil_sitio);`);
l.push(`insert into public.tecnologias (nombre, categoria, nivel, orden)
select * from (values ${TECNOLOGIAS.map(([n, c, v], i) => `(${q(n)}, ${q(c)}, ${v}, ${i})`).join(',\n  ')}) as t(nombre, categoria, nivel, orden)
where not exists (select 1 from public.tecnologias);`);
l.push(`insert into public.experiencia (puesto, organizacion, desde, hasta, descripcion, orden)
select * from (values ${EXPERIENCIA.map((e, i) => `(${e.map(q).join(', ')}, ${i})`).join(',\n  ')}) as t(puesto, organizacion, desde, hasta, descripcion, orden)
where not exists (select 1 from public.experiencia);`);
l.push(`insert into public.servicios (titulo, descripcion, icono, orden)
select * from (values ${SERVICIOS.map((e, i) => `(${e.map(q).join(', ')}, ${i})`).join(',\n  ')}) as t(titulo, descripcion, icono, orden)
where not exists (select 1 from public.servicios);`);
l.push(`do $$
begin
  if exists (select 1 from public.proyectos) then return; end if;`);
for (const [i, p] of PROYECTOS.entries()) {
  const valores = `(${q(p.slug)}, ${q(p.titulo)}, ${q(p.resumen)}, ${q(p.descripcion)}, ${arr(p.tecnologias)}, ${p.destacado}, ${i})`;
  const columnas = 'insert into public.proyectos (slug, titulo, resumen, descripcion, tecnologias, destacado, orden)';
  l.push(
    p.demos.length
      ? `  with nuevo as (
    ${columnas}
    values ${valores} returning id
  )
  insert into public.demos (proyecto_id, titulo, descripcion, tipo, url, orden)
  select nuevo.id, d.* from nuevo, (values ${p.demos.map((d, j) => `(${d.map(q).join(', ')}, ${j})`).join(', ')}) as d(titulo, descripcion, tipo, url, orden);`
      : `  ${columnas}\n  values ${valores};`
  );
}
l.push('end $$;');
l.push('commit;');
fs.writeFileSync(path.join(__dirname, '..', '..', 'supabase', 'seed.sql'), l.join('\n\n') + '\n');
console.log('✔ supabase/seed.sql generado');
