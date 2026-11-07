-- ============================================================================
--  Portfolio fullstack · Migración 4: endurecimiento de funciones
--  (correcciones sugeridas por el Security Advisor de Supabase)
--
--  · Las funciones de TRIGGER no tienen que poder llamarse por /rest/v1/rpc: se les quita
--    EXECUTE a los roles de la API (los triggers siguen funcionando igual).
--  · rol_actual() sólo la usan es_admin()/es_staff() internamente.
--  · Quedan públicas a propósito (y documentadas):
--      es_admin(), es_staff()  → las usan las políticas RLS evaluadas como anon/authenticated;
--                                sólo responden sobre el propio usuario (true/false).
--      proyectos_publicos()    → la tarjeta pública de proyectos, sin descripción ni demos.
-- ============================================================================
revoke execute on function public.crear_perfil_de_usuario() from public, anon, authenticated;
revoke execute on function public.sincronizar_email_de_usuario() from public, anon, authenticated;
revoke execute on function public.proteger_perfiles() from public, anon, authenticated;
revoke execute on function public.tocar_actualizado_en() from public, anon, authenticated;
revoke execute on function public.rol_actual() from public, anon, authenticated;
revoke execute on function public.validar_rango_metricas(date, date, text) from public, anon;
revoke execute on function public.exigir_admin() from public, anon;
-- Al quitar PUBLIC hay que dejar explícito que los usuarios autenticados sí pueden usarlas
-- (las llaman las funciones de métricas, que se ejecutan con el rol de quien consulta)
grant execute on function public.validar_rango_metricas(date, date, text), public.exigir_admin() to authenticated, service_role;
