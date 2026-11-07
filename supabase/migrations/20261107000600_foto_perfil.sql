-- Foto del dueño del portfolio (se muestra en la portada).
-- La imagen vive en el bucket "portfolio" (carpeta perfil/); acá sólo se guarda su URL pública.
-- Re-ejecutable: no falla si la columna o la restricción ya existen.

alter table public.perfil_sitio add column if not exists foto_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfil_sitio_foto_url_https') then
    alter table public.perfil_sitio
      add constraint perfil_sitio_foto_url_https check (foto_url is null or (foto_url ~ '^https://' and char_length(foto_url) <= 500));
  end if;
end $$;
