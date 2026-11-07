-- ============================================================================
--  Portfolio fullstack · Migración 1: tablas, restricciones e índices
--
--  Se aplica con la CLI (`supabase db push`) o pegando los archivos de
--  supabase/migrations/ EN ORDEN en el SQL Editor del panel de Supabase.
--  Es idempotente: se puede volver a correr sin perder datos.
-- ============================================================================

-- Quita acentos y pasa a minúsculas (para búsquedas "garcia" → "García").
-- IMMUTABLE para poder usarla en columnas generadas.
create or replace function public.normalizar(texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select translate(lower(coalesce(texto, '')), 'áéíóúüñàèìòùâêîôûäëïö', 'aeiouunaeiouaeiouaeio');
$$;

-- ── Perfiles de usuario (1 a 1 con auth.users de Supabase Auth) ─────────────
--   rol 'visitante' : se registró para ver el detalle de proyectos y demos
--   rol 'operador'  : atiende las consultas (bandeja y respuestas por correo)
--   rol 'admin'     : todo lo anterior + contenido, usuarios y métricas
create table if not exists public.perfiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null check (char_length(email) between 3 and 254),
  nombre         text not null check (char_length(nombre) between 1 and 100),
  avatar_url     text check (avatar_url is null or avatar_url ~ '^https://'),
  proveedor      text not null default 'email',
  rol            text not null default 'visitante' check (rol in ('admin', 'operador', 'visitante')),
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  ultimo_acceso  timestamptz,
  busqueda       text generated always as (public.normalizar(nombre || ' ' || email)) stored
);
create unique index if not exists perfiles_email_unico on public.perfiles (lower(email));
create index if not exists perfiles_rol_idx on public.perfiles (rol, creado_en desc);

-- ── Datos del desarrollador (una sola fila) ─────────────────────────────────
create table if not exists public.perfil_sitio (
  id                 smallint primary key default 1 check (id = 1),
  nombre             text not null check (char_length(nombre) between 2 and 100),
  titular            text not null check (char_length(titular) between 2 and 150),
  bio                text not null check (char_length(bio) between 10 and 1500),
  ubicacion          text check (char_length(ubicacion) <= 100),
  email_publico      text check (email_publico is null or email_publico ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  github_usuario     text check (github_usuario is null or github_usuario ~ '^[A-Za-z0-9-]{1,39}$'),
  linkedin_url       text check (linkedin_url is null or linkedin_url ~ '^https://'),
  disponible         boolean not null default true,
  anios_experiencia  smallint not null default 0 check (anios_experiencia between 0 and 60)
);

-- ── Tecnologías del stack ───────────────────────────────────────────────────
create table if not exists public.tecnologias (
  id         bigint generated always as identity primary key,
  nombre     text not null unique check (char_length(nombre) between 1 and 50),
  categoria  text not null check (categoria in ('frontend', 'backend', 'datos', 'herramientas')),
  nivel      smallint not null default 3 check (nivel between 1 and 5),
  orden      integer not null default 0
);

-- ── Experiencia ─────────────────────────────────────────────────────────────
create table if not exists public.experiencia (
  id            bigint generated always as identity primary key,
  puesto        text not null check (char_length(puesto) between 2 and 100),
  organizacion  text not null check (char_length(organizacion) between 2 and 100),
  desde         text not null check (char_length(desde) between 1 and 20),
  hasta         text not null default 'Actualidad' check (char_length(hasta) between 1 and 20),
  descripcion   text check (char_length(descripcion) <= 1000),
  orden         integer not null default 0
);

-- ── Servicios ofrecidos (CRUD del administrador) ────────────────────────────
create table if not exists public.servicios (
  id              bigint generated always as identity primary key,
  titulo          text not null check (char_length(titulo) between 3 and 80),
  descripcion     text not null check (char_length(descripcion) between 10 and 600),
  icono           text not null default 'code'
                  check (icono in ('code', 'server', 'database', 'layout', 'smartphone', 'cloud', 'shield', 'zap', 'git-branch', 'message-square', 'globe', 'cpu')),
  orden           integer not null default 0 check (orden between 0 and 9999),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- ── Proyectos (CRUD del administrador) ──────────────────────────────────────
--   El detalle (descripción, repo) y las demos sólo los ven usuarios autenticados (RLS).
create table if not exists public.proyectos (
  id              bigint generated always as identity primary key,
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  titulo          text not null check (char_length(titulo) between 3 and 100),
  resumen         text not null check (char_length(resumen) between 10 and 300),
  descripcion     text not null check (char_length(descripcion) between 20 and 5000),
  tecnologias     text[] not null default '{}' check (cardinality(tecnologias) <= 12),
  imagen_url      text check (imagen_url is null or imagen_url ~ '^https://'),
  repo_url        text check (repo_url is null or repo_url ~ '^https://'),
  destacado       boolean not null default false,
  orden           integer not null default 0 check (orden between 0 and 9999),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index if not exists proyectos_orden_idx on public.proyectos (activo, orden, id);

-- ── Demos de cada proyecto (CRUD del administrador) ─────────────────────────
--   tipo 'iframe' : se muestra incrustada en la página del proyecto
--   tipo 'enlace' : se abre en otra pestaña
create table if not exists public.demos (
  id           bigint generated always as identity primary key,
  proyecto_id  bigint not null references public.proyectos (id) on delete cascade,
  titulo       text not null check (char_length(titulo) between 3 and 100),
  descripcion  text check (char_length(descripcion) <= 300),
  tipo         text not null default 'enlace' check (tipo in ('iframe', 'enlace')),
  url          text not null check (url ~ '^https://' and char_length(url) <= 300),
  orden        integer not null default 0 check (orden between 0 and 9999),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);
create index if not exists demos_proyecto_idx on public.demos (proyecto_id, orden, id);

-- ── Consultas del formulario de contacto ────────────────────────────────────
--   tipo:   general | cotizacion | asesoria
--   estado: nueva → en_seguimiento → respondida → archivada
create table if not exists public.consultas (
  id              bigint generated always as identity primary key,
  codigo          text not null unique check (codigo ~ '^CON-[A-Z0-9]{6,10}$'),
  tipo            text not null check (tipo in ('general', 'cotizacion', 'asesoria')),
  nombre          text not null check (char_length(nombre) between 2 and 100),
  email           text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and char_length(email) <= 150),
  telefono        text check (telefono is null or telefono ~ '^[0-9+()\s.-]{6,30}$'),
  asunto          text not null check (char_length(asunto) between 3 and 150),
  mensaje         text not null check (char_length(mensaje) between 10 and 2000),
  estado          text not null default 'nueva' check (estado in ('nueva', 'en_seguimiento', 'respondida', 'archivada')),
  usuario_id      uuid references public.perfiles (id) on delete set null,
  notas_internas  text check (char_length(notas_internas) <= 3000),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  busqueda        text generated always as (public.normalizar(codigo || ' ' || nombre || ' ' || email || ' ' || asunto)) stored,
  -- orden de la bandeja: primero las abiertas, después respondidas y al final archivadas
  prioridad       smallint generated always as (case estado when 'archivada' then 2 when 'respondida' then 1 else 0 end) stored
);
create index if not exists consultas_estado_idx on public.consultas (estado, creado_en desc);
create index if not exists consultas_creado_idx on public.consultas (creado_en desc);
create index if not exists consultas_tipo_idx on public.consultas (tipo, creado_en desc);

-- ── Respuestas enviadas por correo ──────────────────────────────────────────
--   simulado = true cuando el servidor no tenía SMTP configurado (el correo no salió de verdad)
create table if not exists public.respuestas (
  id            bigint generated always as identity primary key,
  consulta_id   bigint not null references public.consultas (id) on delete cascade,
  autor_id      uuid references public.perfiles (id) on delete set null,
  autor_nombre  text not null check (char_length(autor_nombre) between 1 and 100),
  asunto        text not null check (char_length(asunto) between 3 and 200),
  cuerpo        text not null check (char_length(cuerpo) between 5 and 5000),
  simulado      boolean not null default false,
  creado_en     timestamptz not null default now()
);
create index if not exists respuestas_consulta_idx on public.respuestas (consulta_id, creado_en);

-- ── Métricas ────────────────────────────────────────────────────────────────
--   visitas: una fila por VISITA = una sesión de navegación. El sitio la informa una vez por
--            pestaña (sessionStorage) y además la base ignora otra visita del mismo visitante
--            dentro de los 30 minutos siguientes (ver registrar_visita). visitante_hash es un
--            hash diario e irreversible (IP + navegador + secreto): cuenta visitantes únicos sin
--            guardar la IP. usuario_id se completa si la persona tenía la sesión iniciada.
create table if not exists public.visitas (
  id              bigint generated always as identity primary key,
  creado_en       timestamptz not null default now(),
  ruta            text not null default '/' check (char_length(ruta) <= 200),
  visitante_hash  text not null check (visitante_hash ~ '^[0-9a-f]{16}$'),
  usuario_id      uuid references public.perfiles (id) on delete set null
);
create index if not exists visitas_creado_idx on public.visitas (creado_en);
create index if not exists visitas_hash_idx on public.visitas (visitante_hash, creado_en desc);

--   accesos: una fila por ACCESO AUTENTICADO = cada sesión nueva de Supabase Auth
--            (login con contraseña, registro, Google o confirmación de email).
--            La unicidad (usuario_id, sesion_id) evita contar dos veces la misma sesión:
--            refrescar la página o renovar el token NO genera un acceso nuevo.
create table if not exists public.accesos (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  sesion_id   uuid not null,
  metodo      text not null check (metodo in ('password', 'google', 'registro', 'otro')),
  creado_en   timestamptz not null default now(),
  constraint accesos_sesion_unica unique (usuario_id, sesion_id)
);
create index if not exists accesos_creado_idx on public.accesos (creado_en);
