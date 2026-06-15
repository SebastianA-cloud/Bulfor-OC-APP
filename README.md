# Bulfor OC — Buscador de Órdenes de Compra

App web para buscar y analizar órdenes de compra de Mercado Público.

## Archivos en este repositorio

- `index.html` — La app web (buscador, estadísticas, importador)
- `actualizar_oc.py` — Script que corre cada noche y trae OC nuevas
- `.github/workflows/actualizar_oc.yml` — Automatización nocturna

## Configuración (solo una vez)

### 1. Editar index.html con tus credenciales
Abre `index.html` y busca estas dos líneas cerca del inicio del script:
```
const SUPABASE_URL = window.SUPABASE_URL || 'TU_SUPABASE_URL';
const SUPABASE_KEY = window.SUPABASE_KEY || 'TU_SUPABASE_ANON_KEY';
```
Reemplaza `TU_SUPABASE_URL` y `TU_SUPABASE_ANON_KEY` con los valores de
tu proyecto en Supabase → Settings → API.

### 2. Agregar secretos en GitHub
Ve a tu repositorio → Settings → Secrets and variables → Actions → New repository secret:

| Nombre | Valor |
|--------|-------|
| SUPABASE_URL | URL de tu proyecto Supabase |
| SUPABASE_KEY | Anon key de Supabase |
| MP_TICKET | Tu ticket de Mercado Público |
| MP_RUT | Tu RUT de proveedor (ej: 76.186.755-5) |

### 3. Publicar en Vercel
1. Ir a vercel.com → Add New Project → importar este repositorio
2. Agregar variables de entorno: SUPABASE_URL y SUPABASE_KEY
3. Deploy

## Uso diario

- La app se actualiza **sola** cada noche a las 3am
- Para cargar el historial completo: abre la app → "Importar Excel" → arrastra tu .xlsm
- Para forzar una actualización manual: GitHub → Actions → "Actualizar OC" → Run workflow
