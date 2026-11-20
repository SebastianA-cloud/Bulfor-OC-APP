# Respaldos de Bulfor OC App

## Qué se respalda y dónde

| Copia | Qué incluye | Cuánto dura | Quién la hace |
|---|---|---|---|
| Supabase (plan Pro) | Base de datos completa, 1 vez al día | 7 días | Automático (Supabase → Database → Backups) |
| Respaldo semanal propio | Base de datos + fotos de recetas, **cifrado** | 21 días en GitHub | GitHub Actions en un repositorio **privado** |
| Copia mensual | El último respaldo semanal | Para siempre | Seba la descarga a Google Drive / disco externo |
| Código | Toda la app | Para siempre | GitHub (este repositorio) |

La copia de Supabase **no incluye las fotos** y vive en la misma cuenta; por eso existe el respaldo propio.

## Instalar el respaldo semanal (una sola vez, ~15 minutos)

1. **Crear el repositorio privado:** GitHub → botón **+** → *New repository* → nombre `bulfor-respaldos` → marcar **Private** → *Create repository*.
2. **Copiar los dos archivos** de `docs/respaldos/` de este repositorio:
   - `descargar_archivos.py` → a la raíz de `bulfor-respaldos` (*Add file → Create new file*, pegar el contenido).
   - `respaldo-semanal.yml` → a `.github/workflows/respaldo-semanal.yml` (escribir esa ruta completa como nombre del archivo).
3. **Cargar los 4 secretos** en `bulfor-respaldos` → *Settings → Secrets and variables → Actions → New repository secret*:
   - `SUPABASE_DB_URL`: Supabase → botón **Connect** (arriba) → *Session pooler* → copiar la cadena y reemplazar `[YOUR-PASSWORD]` por la contraseña de la base (si no la recuerdas: Project Settings → Database → *Reset database password*; ojo: si la cambias, nada más la usa hoy, pero confirmarlo antes).
   - `SUPABASE_URL`: `https://uodijcksuqaaovohutkf.supabase.co`
   - `SUPABASE_SERVICE_KEY`: Supabase → Project Settings → API Keys → `service_role` (la misma de las sincronizaciones).
   - `RESPALDO_CLAVE`: una contraseña larga inventada (ej. 5 palabras al azar). **Anotarla en papel o en un gestor de contraseñas.** Sin ella el respaldo no se puede abrir.
4. **Probarlo:** `bulfor-respaldos` → *Actions* → *Respaldo semanal* → **Run workflow**. Debe terminar en verde (✓) y abajo aparecer *Artifacts → bulfor-respaldo*.
5. Si falla, GitHub te manda un correo. Mándame el mensaje de error.

## Rutina

- **Mensual (primer lunes):** Actions → última ejecución verde → descargar *bulfor-respaldo* → guardarlo en Google Drive (carpeta "Respaldos Bulfor") o en un disco externo. Borrar los de más de 1 año si se quiere.
- **Cada 3 meses:** pedirle a Claude una prueba de restauración en un proyecto de Supabase de prueba (nunca sobre producción).

## Cómo restaurar (emergencia)

1. Descifrar: `gpg -d bulfor-respaldo-AAAA-MM-DD.tar.gz.gpg | tar xz` (pide `RESPALDO_CLAVE`).
2. Crear un proyecto nuevo en Supabase (o usar el mismo si se perdió todo, solo con decisión de Seba).
3. Base: `pg_restore --no-owner --no-privileges -d "<cadena del proyecto>" respaldo/base.dump`.
4. Fotos: subir las carpetas `respaldo/archivos/recetas` y `respaldo/archivos/recetas-web` a los buckets del mismo nombre.
5. Cambiar `SUPABASE_URL`/claves en la app y en los secretos si el proyecto es nuevo.
