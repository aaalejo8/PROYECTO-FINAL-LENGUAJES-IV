-- ============================================================================
--  Portfolio fullstack · Migración 5: cada usuario puede leer SUS accesos
--
--  Encontrado en las pruebas contra Supabase real: la API (PostgREST) hace los INSERT con
--  "RETURNING", y PostgreSQL exige que la fila insertada también pase una política SELECT.
--  Sin esto, registrar el propio acceso fallaba con "violates row-level security policy".
--  El admin ya los veía todos (accesos_ver); ahora cada usuario ve además los propios.
-- ============================================================================
drop policy if exists accesos_ver_propios on public.accesos;
create policy accesos_ver_propios on public.accesos for select to authenticated
  using (usuario_id = (select auth.uid()));
