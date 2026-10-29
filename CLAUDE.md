# Bulfor OC App — instrucciones para Claude

> **Antes de leer `index.html`, lee `docs/CEREBRO.md`**: mapa de la app, base de datos,
> sincronizaciones, decisiones tomadas, bitácora y pendientes. Al terminar cada cambio,
> actualiza su Bitácora y Pendientes. (`AGENTS.md` tiene estas mismas reglas para Codex/ChatGPT.)

App web interna de Farmacia Bulfor (recetario magistral, Chile). La usa el equipo de la farmacia para órdenes de compra de Mercado Público, despachos FedEx, Órdenes de Elaboración, seguimiento de pago de facturas, emisión de documentos tributarios y Control Farmacia (stock, lotes, vencimientos).

Seba (dueño y Director Técnico) es quien pide los cambios. Trabaja solo desde la web (GitHub, Vercel, dashboard de Supabase), sin entorno local. Habla en español: responde en español y explica en lenguaje simple, sin jerga innecesaria.

## Forma de trabajar

1. **Nunca trabajes directo en `main`.** Cada cambio va en una rama nueva con nombre descriptivo (`mejora-buscador-oc`, `fix-fechas-facturas`).
2. Haz commit y push de la rama. Vercel genera una URL de vista previa: entrégasela a Seba junto con qué probar y cómo.
3. **Solo haz merge a `main` cuando Seba diga que lo probó y está bien.** `main` es producción: la farmacia la usa en el día a día.
4. Cambia solo lo que se pidió. Si ves otro problema o algo mejorable, explícalo (qué es y por qué lo cambiarías) y espera su decisión antes de tocarlo.
5. Al terminar, resume: qué cambió, en qué rama, link de vista previa y pasos para probar.
6. Comentarios del código en español, en el mismo estilo explicativo que ya tiene el código.

## Estructura

- `index.html` — la app completa en JavaScript vanilla (~18.600 líneas). Es muy grande: busca con grep y edita solo el bloque necesario; nunca la reescribas entera.
- `styles.css` — estilos. Color de marca `#C0392B`. Íconos: Tabler Icons (CDN).
- `documentos.js` — módulo de creación de documentos.
- `api/notificar-receta.js` — función serverless de Vercel (aviso por correo con Resend de nuevas Órdenes de Elaboración).
- `supabase/functions/emitir-dte/` — Edge Function que emite facturas (33) y guías (52) vía GDExpress.
- `*.py` + `.github/workflows/` — sincronizaciones con Mercado Público y GDExpress que corren en GitHub Actions (cada 2 horas). Los `probar_*.py` y `diagnosticar_*.py` son scripts de diagnóstico.
- `sw.js`, `manifest.json` — solo para poder instalar la app; el service worker no cachea nada.

## Patrones existentes (reúsalos, no los dupliques)

- `fetchAll(table, query)` — consultas a Supabase paginadas en lotes de 1000. Úsala siempre que una tabla pueda tener más de 1000 filas.
- `coincideBusqueda(texto, query)` — búsqueda de varias palabras.
- `cerrarTodosLosModales()` — limpieza de modales.
- `esRuido(texto)` — filtra texto de relleno.
- `SUBMENUS` — objeto de configuración de la navegación; los menús nuevos se agregan ahí.
- Descargas a Excel con SheetJS (`xlsx`), ya cargado.
- Fechas: Chile (America/Santiago). Cuidado al parsear fechas sin hora (ya hubo bugs de zona horaria y de fechas SII sin componente de hora).

## Supabase (proyecto `uodijcksuqaaovohutkf`)

- **El repositorio es público.** En el navegador solo va la anon key. Nunca pongas en el código la `service_role` key ni ninguna otra clave o token: van en GitHub Secrets, en variables de entorno de Vercel o en secretos de Supabase.
- Antes de cambiar el esquema, revisa las tablas y columnas actuales.
- Los cambios de base de datos van directo a producción: explícale a Seba qué vas a cambiar antes de aplicarlo. Antes de modificar o borrar datos en masa, crea una tabla de respaldo (`<tabla>_backup_AAAAMMDD`).
- Toda tabla nueva lleva RLS activado con sus políticas. Después de cambios de esquema, revisa los avisos de seguridad de Supabase.

## Documentos tributarios (emitir-dte)

- El ambiente lo decide el secreto `DTE_AMBIENTE` (`T` = homologación/pruebas, `P` = producción).
- Nunca cambies a producción ni emitas un documento real sin la autorización explícita de Seba. Prueba siempre en homologación.
