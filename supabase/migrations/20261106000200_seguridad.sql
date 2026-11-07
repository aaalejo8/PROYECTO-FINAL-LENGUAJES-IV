-- ============================================================================
--  Portfolio fullstack · Migración 2: roles, triggers y Row Level Security
--
--  Regla general: TODAS las tablas tienen RLS activado. La clave pública (anon /
--  publishable) sólo puede leer el contenido público; todo lo demás exige un
--  usuario autenticado con el rol correcto, verificado EN LA BASE (no en el navegador).
--  La clave service_role (sólo en el servidor Node) se usa para lo que ningún
--  usuario debería poder hacer directamente: guardar consultas y contar visitas.
-- ============================================================================

-- ── Funciones de rol (SECURITY DEFINER para poder leer perfiles sin recursión de RLS) ──
create or replace function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.rol from public.perfiles p where p.id = auth.uid() and p.activo;
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.rol_actual() = 'admin', false);
$$;

create or replace function public.es_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.rol_actual() in ('admin', 'operador'), false);
$$;

revoke execute on function public.rol_actual() from public;
grant execute on function public.rol_actual(), public.es_admin(), public.es_staff() to anon, authenticated, service_role;

-- ── Alta automática del perfil cuando alguien se registra en Supabase Auth ──
create or replace function public.crear_perfil_de_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
  v_avatar text;
begin
  v_nombre := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'nombre',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1)
  )), '');
  v_avatar := new.raw_user_meta_data ->> 'avatar_url';
  if v_avatar is not null and v_avatar !~ '^https://' then
    v_avatar := null;
  end if;

  insert into public.perfiles (id, email, nombre, avatar_url, proveedor, rol)
  values (
    new.id,
    lower(coalesce(new.email, new.id::text || '@sin-email.local')),
    left(coalesce(v_nombre, 'Usuario'), 100),
    left(v_avatar, 500),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
    'visitante'          -- nunca se acepta un rol enviado por el navegador
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_de_usuario();

-- Si el usuario cambia su email en Auth, se refleja en el perfil
create or replace function public.sincronizar_email_de_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.perfiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists al_cambiar_email on auth.users;
create trigger al_cambiar_email
  after update of email on auth.users
  for each row execute function public.sincronizar_email_de_usuario();

-- ── Protecciones de perfiles ──
--   · Siempre tiene que quedar al menos un administrador activo.
--   · Nadie puede cambiarse su propio rol ni desactivarse a sí mismo.
--   · El email y el proveedor los maneja Supabase Auth, no se editan a mano.
create or replace function public.proteger_perfiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  otros_admins integer;
begin
  if tg_op = 'UPDATE' then
    if auth.uid() is not null and auth.uid() = old.id
       and (new.rol is distinct from old.rol or new.activo is distinct from old.activo) then
      raise exception 'No podés cambiar tu propio rol ni desactivar tu cuenta.' using errcode = 'P0001';
    end if;
    if auth.uid() is not null and (new.email is distinct from old.email or new.proveedor is distinct from old.proveedor) then
      raise exception 'El email y el método de ingreso no se editan desde acá.' using errcode = 'P0001';
    end if;
  end if;

  if old.rol = 'admin' and old.activo
     and (tg_op = 'DELETE' or new.rol <> 'admin' or not new.activo) then
    -- se bloquean las filas de administradores para que dos cambios simultáneos no dejen el sistema sin ninguno
    perform 1 from public.perfiles where rol = 'admin' and activo for update;
    select count(*) into otros_admins from public.perfiles where rol = 'admin' and activo and id <> old.id;
    if otros_admins = 0 then
      raise exception 'Tiene que quedar al menos un administrador activo.' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_perfiles on public.perfiles;
create trigger proteger_perfiles
  before update or delete on public.perfiles
  for each row execute function public.proteger_perfiles();

-- ── Fecha de última modificación automática ──
create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists tocar_servicios on public.servicios;
create trigger tocar_servicios before update on public.servicios for each row execute function public.tocar_actualizado_en();
drop trigger if exists tocar_proyectos on public.proyectos;
create trigger tocar_proyectos before update on public.proyectos for each row execute function public.tocar_actualizado_en();
drop trigger if exists tocar_consultas on public.consultas;
create trigger tocar_consultas before update on public.consultas for each row execute function public.tocar_actualizado_en();

-- ============================================================================
--  Row Level Security
-- ============================================================================
alter table public.perfiles     enable row level security;
alter table public.perfil_sitio enable row level security;
alter table public.tecnologias  enable row level security;
alter table public.experiencia  enable row level security;
alter table public.servicios    enable row level security;
alter table public.proyectos    enable row level security;
alter table public.demos        enable row level security;
alter table public.consultas    enable row level security;
alter table public.respuestas   enable row level security;
alter table public.visitas      enable row level security;
alter table public.accesos      enable row level security;

-- Se borran las políticas anteriores para que la migración se pueda repetir
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ── perfiles: cada uno ve el suyo; el admin ve y edita todos ──
create policy perfiles_ver on public.perfiles
  for select to authenticated using (id = (select auth.uid()) or (select public.es_admin()));
create policy perfiles_editar_admin on public.perfiles
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy perfiles_borrar_admin on public.perfiles
  for delete to authenticated using ((select public.es_admin()));
-- (el alta la hace el trigger al_crear_usuario: no hay política de insert)

-- ── Contenido público: lectura para todos, escritura sólo admin ──
create policy perfil_sitio_ver on public.perfil_sitio for select to anon, authenticated using (true);
create policy perfil_sitio_admin on public.perfil_sitio for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy tecnologias_ver on public.tecnologias for select to anon, authenticated using (true);
create policy tecnologias_admin on public.tecnologias for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy experiencia_ver on public.experiencia for select to anon, authenticated using (true);
create policy experiencia_admin on public.experiencia for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy servicios_ver on public.servicios for select to anon, authenticated
  using (activo or (select public.es_admin()));
create policy servicios_insertar on public.servicios for insert to authenticated with check ((select public.es_admin()));
create policy servicios_editar on public.servicios for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy servicios_borrar on public.servicios for delete to authenticated using ((select public.es_admin()));

-- ── Proyectos y demos: el DETALLE sólo para usuarios autenticados ──
--   Los visitantes anónimos NO tienen ninguna política de lectura sobre estas tablas:
--   aunque usen la clave pública directo contra la API de Supabase, no ven nada.
--   La tarjeta pública (sin descripción ni demos) sale de la función proyectos_publicos().
create policy proyectos_ver on public.proyectos for select to authenticated
  using (activo or (select public.es_admin()));
create policy proyectos_insertar on public.proyectos for insert to authenticated with check ((select public.es_admin()));
create policy proyectos_editar on public.proyectos for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy proyectos_borrar on public.proyectos for delete to authenticated using ((select public.es_admin()));

create policy demos_ver on public.demos for select to authenticated
  using (
    (select public.es_admin())
    or (activo and exists (select 1 from public.proyectos p where p.id = proyecto_id and p.activo))
  );
create policy demos_insertar on public.demos for insert to authenticated with check ((select public.es_admin()));
create policy demos_editar on public.demos for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy demos_borrar on public.demos for delete to authenticated using ((select public.es_admin()));

-- ── Consultas y respuestas: operador y admin ──
--   El alta de consultas la hace el servidor (valida, limita envíos y manda los correos).
create policy consultas_ver on public.consultas for select to authenticated using ((select public.es_staff()));
create policy consultas_editar on public.consultas for update to authenticated
  using ((select public.es_staff())) with check ((select public.es_staff()));
create policy consultas_borrar on public.consultas for delete to authenticated using ((select public.es_admin()));

create policy respuestas_ver on public.respuestas for select to authenticated using ((select public.es_staff()));
create policy respuestas_insertar on public.respuestas for insert to authenticated
  with check ((select public.es_staff()) and autor_id = (select auth.uid()));

-- ── Métricas: sólo el admin las lee ──
create policy visitas_ver on public.visitas for select to authenticated using ((select public.es_admin()));
create policy accesos_ver on public.accesos for select to authenticated using ((select public.es_admin()));
-- Cada usuario registra SUS propios accesos (el servidor lo hace con el token de esa persona)
create policy accesos_insertar on public.accesos for insert to authenticated
  with check (usuario_id = (select auth.uid()));

-- ============================================================================
--  Supabase Storage: imágenes de portada de los proyectos
--  Bucket público (las imágenes se ven en el sitio) pero sólo el admin sube/borra.
--  Además el bucket limita el tamaño (4 MB) y el tipo (JPG, PNG, WebP).
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists portfolio_subir_admin on storage.objects;
drop policy if exists portfolio_editar_admin on storage.objects;
drop policy if exists portfolio_borrar_admin on storage.objects;
drop policy if exists portfolio_listar_admin on storage.objects;

create policy portfolio_subir_admin on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and (select public.es_admin()));
create policy portfolio_editar_admin on storage.objects for update to authenticated
  using (bucket_id = 'portfolio' and (select public.es_admin()));
create policy portfolio_borrar_admin on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and (select public.es_admin()));
create policy portfolio_listar_admin on storage.objects for select to authenticated
  using (bucket_id = 'portfolio' and (select public.es_admin()));
