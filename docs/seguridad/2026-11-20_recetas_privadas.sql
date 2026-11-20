-- Recetas privadas (auditoría de seguridad 20-11-2026)
-- APLICAR SOLO DESPUÉS de integrar en main el PR que hace que la app baje las
-- fotos con la sesión (si se aplica antes, la app en producción deja de mostrar
-- las recetas hasta que se integre ese PR).
--
-- Qué hace:
--  1. El bucket `recetas` deja de ser público: las fotos solo se abren con sesión.
--  2. Leer: cualquier cuenta con sesión de la app (antes: cualquiera en internet,
--     incluso listando todos los archivos).
--  3. Subir y borrar: el rol se revisa en app_metadata (lo pone solo el
--     administrador) en vez de user_metadata (lo puede cambiar cada usuario).
--     Las 4 cuentas actuales tienen app_metadata.rol = 'editor', así que nadie
--     pierde permisos.
-- No borra ni mueve ninguna foto.

begin;

update storage.buckets set public = false where id = 'recetas';

drop policy if exists "Lectura publica storage" on storage.objects;
create policy recetas_leer_autenticados on storage.objects
  for select to authenticated
  using (bucket_id = 'recetas');

drop policy if exists recetas_subir_editores on storage.objects;
create policy recetas_subir_editores on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recetas' and (auth.jwt() -> 'app_metadata' ->> 'rol') = 'editor');

drop policy if exists recetas_borrar_editores on storage.objects;
create policy recetas_borrar_editores on storage.objects
  for delete to authenticated
  using (bucket_id = 'recetas' and (auth.jwt() -> 'app_metadata' ->> 'rol') = 'editor');

drop policy if exists recetas_web_borrar_editores on storage.objects;
create policy recetas_web_borrar_editores on storage.objects
  for delete to authenticated
  using (bucket_id = 'recetas-web' and (auth.jwt() -> 'app_metadata' ->> 'rol') = 'editor');

commit;

-- Verificación (debe decir public = false y mostrar las 3 políticas de `recetas`):
-- select id, public from storage.buckets;
-- select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'storage';
