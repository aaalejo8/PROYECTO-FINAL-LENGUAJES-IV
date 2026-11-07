-- ============================================================================
--  Portfolio fullstack · Migración 3: funciones (RPC) y consultas parametrizadas
--
--  Todas reciben los datos como PARÁMETROS tipados (date, text...), nunca se arma
--  SQL concatenando lo que escribe el usuario. Las de métricas verifican el rol
--  dentro de la base: aunque alguien las llame directo con la clave pública, fallan.
-- ============================================================================

-- ── Tarjetas públicas de proyectos (sin descripción ni demos) ──
--   SECURITY DEFINER: el visitante anónimo no puede leer la tabla proyectos,
--   pero sí esta selección acotada de columnas.
create or replace function public.proyectos_publicos()
returns table (
  id bigint,
  slug text,
  titulo text,
  resumen text,
  tecnologias text[],
  imagen_url text,
  destacado boolean,
  cantidad_demos integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.slug, p.titulo, p.resumen, p.tecnologias, p.imagen_url, p.destacado,
         (select count(*)::int from public.demos d where d.proyecto_id = p.id and d.activo)
    from public.proyectos p
   where p.activo
   order by p.orden, p.id;
$$;
grant execute on function public.proyectos_publicos() to anon, authenticated;

-- ── Registro de una visita (sólo el servidor, con service_role) ──
--   Devuelve true si se contó. No se cuenta si el mismo visitante ya tuvo una
--   visita en los últimos 30 minutos (misma sesión de navegación).
create or replace function public.registrar_visita(p_ruta text, p_hash text, p_usuario uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{16}$' then
    raise exception 'Identificador de visitante inválido.' using errcode = '22023';
  end if;
  -- serializa las visitas del mismo visitante para que dos pedidos simultáneos no cuenten doble
  perform pg_advisory_xact_lock(hashtext(p_hash));
  if exists (
    select 1 from public.visitas v
     where v.visitante_hash = p_hash and v.creado_en > now() - interval '30 minutes'
  ) then
    if p_usuario is not null then
      -- si inició sesión durante la visita, la visita pasa a ser autenticada (sin contar otra)
      update public.visitas set usuario_id = p_usuario
       where id = (select id from public.visitas
                    where visitante_hash = p_hash and usuario_id is null
                    order by creado_en desc limit 1);
    end if;
    return false;
  end if;
  insert into public.visitas (ruta, visitante_hash, usuario_id)
  values (left(coalesce(nullif(p_ruta, ''), '/'), 200), p_hash, p_usuario);
  return true;
end;
$$;
revoke execute on function public.registrar_visita(text, text, uuid) from public, anon, authenticated;
grant execute on function public.registrar_visita(text, text, uuid) to service_role;

-- ── Validación común de parámetros de métricas ──
create or replace function public.validar_rango_metricas(p_desde date, p_hasta date, p_agrupar text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_desde is null or p_hasta is null then
    raise exception 'Faltan las fechas del rango.' using errcode = '22023';
  end if;
  if p_desde > p_hasta then
    raise exception 'La fecha "desde" no puede ser posterior a "hasta".' using errcode = '22023';
  end if;
  if p_hasta - p_desde > 730 then
    raise exception 'El rango máximo es de 2 años.' using errcode = '22023';
  end if;
  if p_agrupar not in ('day', 'week', 'month') then
    raise exception 'La agrupación tiene que ser day, week o month.' using errcode = '22023';
  end if;
  if p_agrupar = 'day' and p_hasta - p_desde > 180 then
    raise exception 'Para más de 180 días agrupá por semana o por mes.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.exigir_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Sólo el administrador puede ver las métricas.' using errcode = '42501';
  end if;
end;
$$;

-- ── Contadores generales ──
create or replace function public.metricas_resumen(p_zona text default 'America/Argentina/Salta')
returns json
language plpgsql
stable
set search_path = ''
as $$
declare
  inicio_hoy timestamptz;
  resultado json;
begin
  perform public.exigir_admin();
  inicio_hoy := date_trunc('day', now() at time zone p_zona) at time zone p_zona;
  select json_build_object(
    'visitas_total',        (select count(*) from public.visitas),
    'visitas_hoy',          (select count(*) from public.visitas where creado_en >= inicio_hoy),
    'visitantes_hoy',       (select count(distinct visitante_hash) from public.visitas where creado_en >= inicio_hoy),
    'visitas_autenticadas', (select count(*) from public.visitas where usuario_id is not null),
    'usuarios_registrados', (select count(*) from public.perfiles where rol = 'visitante'),
    'usuarios_total',       (select count(*) from public.perfiles),
    'accesos_total',        (select count(*) from public.accesos),
    'accesos_hoy',          (select count(*) from public.accesos where creado_en >= inicio_hoy),
    'usuarios_con_acceso',  (select count(distinct usuario_id) from public.accesos),
    'consultas_total',      (select count(*) from public.consultas),
    'consultas_nuevas',     (select count(*) from public.consultas where estado = 'nueva')
  ) into resultado;
  return resultado;
end;
$$;

-- ── Serie temporal para los gráficos (parametrizada) ──
--   p_tipo filtra la serie de consultas (null = todas).
create or replace function public.metricas_series(
  p_desde date,
  p_hasta date,
  p_agrupar text default 'day',
  p_zona text default 'America/Argentina/Salta',
  p_tipo text default null
)
returns table (
  periodo text,
  visitas integer,
  visitantes integer,
  visitas_autenticadas integer,
  accesos integer,
  usuarios_con_acceso integer,
  registros integer,
  usuarios_acumulados integer,
  consultas integer
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  ini timestamptz;
  fin timestamptz;
  base integer;
begin
  perform public.exigir_admin();
  perform public.validar_rango_metricas(p_desde, p_hasta, p_agrupar);
  if p_tipo is not null and p_tipo not in ('general', 'cotizacion', 'asesoria') then
    raise exception 'Tipo de consulta no válido.' using errcode = '22023';
  end if;
  ini := p_desde::timestamp at time zone p_zona;
  fin := (p_hasta + 1)::timestamp at time zone p_zona;
  select count(*) into base from public.perfiles where rol = 'visitante' and creado_en < ini;

  return query
  with serie as (
    select generate_series(date_trunc(p_agrupar, p_desde::timestamp), date_trunc(p_agrupar, p_hasta::timestamp), ('1 ' || p_agrupar)::interval) as p
  ),
  v as (
    select date_trunc(p_agrupar, x.creado_en at time zone p_zona) as p,
           count(*)::int as visitas, count(distinct x.visitante_hash)::int as visitantes, count(x.usuario_id)::int as autenticadas
      from public.visitas x where x.creado_en >= ini and x.creado_en < fin group by 1
  ),
  a as (
    select date_trunc(p_agrupar, x.creado_en at time zone p_zona) as p,
           count(*)::int as accesos, count(distinct x.usuario_id)::int as usuarios
      from public.accesos x where x.creado_en >= ini and x.creado_en < fin group by 1
  ),
  r as (
    select date_trunc(p_agrupar, x.creado_en at time zone p_zona) as p, count(*)::int as registros
      from public.perfiles x where x.rol = 'visitante' and x.creado_en >= ini and x.creado_en < fin group by 1
  ),
  c as (
    select date_trunc(p_agrupar, x.creado_en at time zone p_zona) as p, count(*)::int as consultas
      from public.consultas x
     where x.creado_en >= ini and x.creado_en < fin and (p_tipo is null or x.tipo = p_tipo) group by 1
  )
  select to_char(s.p, 'YYYY-MM-DD'),
         coalesce(v.visitas, 0), coalesce(v.visitantes, 0), coalesce(v.autenticadas, 0),
         coalesce(a.accesos, 0), coalesce(a.usuarios, 0),
         coalesce(r.registros, 0),
         (base + sum(coalesce(r.registros, 0)) over (order by s.p))::int,
         coalesce(c.consultas, 0)
    from serie s
    left join v on v.p = s.p
    left join a on a.p = s.p
    left join r on r.p = s.p
    left join c on c.p = s.p
   order by s.p;
end;
$$;

-- ── Consultas por tipo y por estado dentro del rango (parametrizada) ──
create or replace function public.metricas_consultas(
  p_desde date,
  p_hasta date,
  p_zona text default 'America/Argentina/Salta',
  p_tipo text default null
)
returns json
language plpgsql
stable
set search_path = ''
as $$
declare
  ini timestamptz;
  fin timestamptz;
  resultado json;
begin
  perform public.exigir_admin();
  perform public.validar_rango_metricas(p_desde, p_hasta, 'month');
  if p_tipo is not null and p_tipo not in ('general', 'cotizacion', 'asesoria') then
    raise exception 'Tipo de consulta no válido.' using errcode = '22023';
  end if;
  ini := p_desde::timestamp at time zone p_zona;
  fin := (p_hasta + 1)::timestamp at time zone p_zona;
  select json_build_object(
    'por_tipo', coalesce((
      select json_agg(json_build_object('clave', t.tipo, 'cantidad', t.n) order by t.n desc)
        from (select tipo, count(*)::int as n from public.consultas
               where creado_en >= ini and creado_en < fin and (p_tipo is null or tipo = p_tipo)
               group by tipo) t), '[]'::json),
    'por_estado', coalesce((
      select json_agg(json_build_object('clave', e.estado, 'cantidad', e.n) order by e.n desc)
        from (select estado, count(*)::int as n from public.consultas
               where creado_en >= ini and creado_en < fin and (p_tipo is null or tipo = p_tipo)
               group by estado) e), '[]'::json)
  ) into resultado;
  return resultado;
end;
$$;

-- ── Resumen de la bandeja (operador y admin) ──
create or replace function public.consultas_resumen()
returns json
language plpgsql
stable
set search_path = ''
as $$
declare
  resultado json;
begin
  if not public.es_staff() then
    raise exception 'No tenés permiso para ver las consultas.' using errcode = '42501';
  end if;
  select json_build_object(
    'nueva',          count(*) filter (where estado = 'nueva'),
    'en_seguimiento', count(*) filter (where estado = 'en_seguimiento'),
    'respondida',     count(*) filter (where estado = 'respondida'),
    'archivada',      count(*) filter (where estado = 'archivada')
  ) into resultado from public.consultas;
  return resultado;
end;
$$;

-- ── Cantidad de usuarios por rol (panel de usuarios) ──
create or replace function public.usuarios_resumen()
returns json
language plpgsql
stable
set search_path = ''
as $$
declare
  resultado json;
begin
  if not public.es_admin() then
    raise exception 'Sólo el administrador puede ver los usuarios.' using errcode = '42501';
  end if;
  select json_build_object(
    'admin',     count(*) filter (where rol = 'admin'),
    'operador',  count(*) filter (where rol = 'operador'),
    'visitante', count(*) filter (where rol = 'visitante'),
    'inactivos', count(*) filter (where not activo)
  ) into resultado from public.perfiles;
  return resultado;
end;
$$;

revoke execute on function public.metricas_resumen(text), public.metricas_series(date, date, text, text, text),
  public.metricas_consultas(date, date, text, text), public.consultas_resumen(), public.usuarios_resumen() from public, anon;
grant execute on function public.metricas_resumen(text), public.metricas_series(date, date, text, text, text),
  public.metricas_consultas(date, date, text, text), public.consultas_resumen(), public.usuarios_resumen() to authenticated;
