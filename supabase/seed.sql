-- Contenido de ejemplo (generado por server/scripts/generar-seed-sql.js). Sólo inserta si las tablas están vacías.

begin;

insert into public.perfil_sitio (id, nombre, titular, bio, ubicacion, email_publico, github_usuario, linkedin_url, disponible, anios_experiencia)
select 1, 'Nicolás Herrera', 'Desarrollador Fullstack', 'Diseño, programo y publico aplicaciones web completas: desde la interfaz que ve el usuario hasta la base de datos que la sostiene. Me gusta el código claro, las interfaces rápidas y entregar cosas que funcionen de verdad.', 'Salta, Argentina', 'nicolas.herrera@example.com', null, null, true, 3
where not exists (select 1 from public.perfil_sitio);

insert into public.tecnologias (nombre, categoria, nivel, orden)
select * from (values ('HTML', 'frontend', 5, 0),
  ('CSS', 'frontend', 5, 1),
  ('JavaScript', 'frontend', 4, 2),
  ('React', 'frontend', 4, 3),
  ('Tailwind CSS', 'frontend', 4, 4),
  ('GSAP', 'frontend', 3, 5),
  ('Node.js', 'backend', 4, 6),
  ('Express', 'backend', 4, 7),
  ('Python', 'backend', 3, 8),
  ('PostgreSQL', 'datos', 4, 9),
  ('Supabase', 'datos', 4, 10),
  ('MySQL', 'datos', 3, 11),
  ('SQL', 'datos', 4, 12),
  ('Git y GitHub', 'herramientas', 4, 13),
  ('Vite', 'herramientas', 4, 14),
  ('Linux', 'herramientas', 3, 15)) as t(nombre, categoria, nivel, orden)
where not exists (select 1 from public.tecnologias);

insert into public.experiencia (puesto, organizacion, desde, hasta, descripcion, orden)
select * from (values ('Desarrollador fullstack freelance', 'Clientes independientes', '2024', 'Actualidad', 'Sitios y sistemas a medida para comercios y pymes: catálogo online, paneles de administración, reportes y despliegue en la nube.', 0),
  ('Desarrollador junior', 'Estudio de software', '2023', '2024', 'Mantenimiento de APIs en Node.js y pantallas en React. Revisión de código en equipo y trabajo con PostgreSQL.', 1),
  ('Ingeniería en Informática', 'Universidad (en curso)', '2021', 'Actualidad', 'Base sólida en algoritmos, bases de datos, redes y desarrollo web.', 2)) as t(puesto, organizacion, desde, hasta, descripcion, orden)
where not exists (select 1 from public.experiencia);

insert into public.servicios (titulo, descripcion, icono, orden)
select * from (values ('Desarrollo web a medida', 'Sitios y aplicaciones web rápidas, accesibles y adaptadas a celulares, pensadas para tu negocio y no para una plantilla.', 'layout', 0),
  ('APIs y backend', 'Servicios en Node.js con autenticación, validación de datos y documentación, listos para conectar con tu app o tu tienda.', 'server', 1),
  ('Bases de datos y reportes', 'Diseño de bases PostgreSQL o MySQL, migraciones y paneles con métricas para que veas qué pasa en tu sistema.', 'database', 2),
  ('Asesoría técnica y code review', 'Revisamos tu proyecto, ordenamos las decisiones de arquitectura y te dejo un plan claro de mejoras.', 'message-square', 3),
  ('Despliegue y mantenimiento', 'Publicación en la nube con https, copias de seguridad y actualizaciones, para que el sitio no se caiga.', 'cloud', 4)) as t(titulo, descripcion, icono, orden)
where not exists (select 1 from public.servicios);

do $$
begin
  if exists (select 1 from public.proyectos) then return; end if;

  with nuevo as (
    insert into public.proyectos (slug, titulo, resumen, descripcion, tecnologias, destacado, orden)
    values ('gestor-de-turnos', 'Gestor de turnos', 'Sistema de reservas online para consultorios y peluquerías, con recordatorios por correo.', 'Aplicación web donde los clientes reservan turnos eligiendo servicio, profesional y horario disponible. El comercio ve su agenda del día, bloquea horarios y recibe un aviso por cada reserva nueva.

Se resolvió la superposición de turnos con transacciones en PostgreSQL y se agregó un panel con métricas de ocupación por semana.', array['React', 'Node.js', 'PostgreSQL', 'Tailwind CSS']::text[], true, 0) returning id
  )
  insert into public.demos (proyecto_id, titulo, descripcion, tipo, url, orden)
  select nuevo.id, d.* from nuevo, (values ('Recorrido del flujo de reserva', 'Demo de ejemplo: reemplazala por el link de tu demo desde el panel.', 'enlace', 'https://example.com/', 0)) as d(titulo, descripcion, tipo, url, orden);

  with nuevo as (
    insert into public.proyectos (slug, titulo, resumen, descripcion, tecnologias, destacado, orden)
    values ('panel-de-metricas', 'Panel de métricas en tiempo real', 'Dashboard con gráficos interactivos que se actualizan solos, para seguir ventas y visitas.', 'Panel para dueños de comercios que reúne ventas, visitas y consultas en gráficos filtrables por fecha. Los datos se consultan con SQL parametrizado y se agrupan por día, semana o mes.

Incluye exportación de reportes y un modo oscuro pensado para uso prolongado.', array['React', 'Chart.js', 'Express', 'PostgreSQL']::text[], true, 1) returning id
  )
  insert into public.demos (proyecto_id, titulo, descripcion, tipo, url, orden)
  select nuevo.id, d.* from nuevo, (values ('Dashboard con datos de ejemplo', 'Demo de ejemplo: reemplazala por el link de tu demo desde el panel.', 'enlace', 'https://example.com/', 0)) as d(titulo, descripcion, tipo, url, orden);

  insert into public.proyectos (slug, titulo, resumen, descripcion, tecnologias, destacado, orden)
  values ('api-de-reservas', 'API de reservas', 'API REST con autenticación por tokens, roles y límites de uso, documentada de punta a punta.', 'Servicio backend que expone reservas, usuarios y disponibilidad. Usa contraseñas con hash, sesiones firmadas, límite de intentos y validación estricta de cada campo recibido.

Pensada para conectarse con apps móviles y sitios de terceros.', array['Node.js', 'Express', 'PostgreSQL', 'Python']::text[], false, 2);

  insert into public.proyectos (slug, titulo, resumen, descripcion, tecnologias, destacado, orden)
  values ('finanzas-personales', 'App de finanzas personales', 'Registro de gastos con categorías, presupuestos mensuales y gráficos de evolución.', 'Aplicación para cargar ingresos y gastos desde el celular, con categorías propias, presupuestos por mes y alertas al acercarse al límite.

Los gráficos muestran la evolución mensual y comparan contra el período anterior.', array['React', 'Tailwind CSS', 'Node.js', 'MySQL']::text[], false, 3);

end $$;

commit;
