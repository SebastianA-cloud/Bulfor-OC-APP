# Bulfor OC App — instrucciones para agentes de IA (Codex / ChatGPT y otros)

> **Antes de leer `index.html`, lee `docs/CEREBRO.md`**: mapa de la app, base de datos,
> sincronizaciones, decisiones tomadas, bitácora y pendientes. Al terminar cada cambio,
> actualiza su Bitácora y Pendientes. (`CLAUDE.md` tiene estas mismas reglas para Claude; si cambias una regla, cámbiala en ambos.)

App web interna de Farmacia Bulfor (recetario magistral, Chile). La usa el equipo de la farmacia para órdenes de compra de Mercado Público, despachos FedEx, Órdenes de Elaboración, seguimiento de pago de facturas, emisión de documentos tributarios y Control Farmacia (stock, lotes, vencimientos).

Seba (dueño y Director Técnico) es quien pide los cambios. Trabaja solo desde la web (GitHub, Vercel, dashboard de Supabase), sin entorno local. Habla en español: responde en español y explica en lenguaje simple, sin jerga innecesaria.

## Coordinación entre Claude y Codex (acuerdo de Seba, 29-10-2026)

Estas reglas reemplazan cualquier indicación anterior de usar una rama compartida o pasar una rama directamente a main. El detalle y el registro de tareas están en `docs/COORDINACION.md`.

1. Antes de empezar, leer este archivo, `docs/CEREBRO.md`, `docs/COORDINACION.md` y los PR abiertos. Revisar el estado remoto actual; no asumir que una conversación refleja lo último.
2. Cada asistente trabaja en su propia rama y una rama por tarea: `claude/<tarea>` o `codex/<tarea>`. Crear desde main actualizado; continuar una rama anterior solo si corresponde a la misma tarea y se revisaron sus diferencias. No escribir en la rama del otro ni reutilizar `etapa2-uso-diario` como rama compartida.
3. Registrar responsable, objetivo, rama, módulos/bloques o archivos, estado y PR en el registro de coordinación. Si la rama actual de Claude no está confirmada, no inventarla ni cambiarla por él.
4. Claude está a cargo del orden y los ajustes de menús, menú por menú, según lo que Seba le vaya pidiendo. Codex no modifica esos módulos, la navegación ni sus estilos compartidos mientras estén en curso, salvo reparto explícito de Seba. No ampliar el encargo por iniciativa propia.
5. Si ambas tareas necesitan el mismo archivo, delimitar bloques o funciones antes de editar. Si hay dependencia o solapamiento, trabajar en secuencia. Nunca resolver un conflicto borrando el trabajo del otro; revisar la intención de ambos cambios.
6. Hacer commit y push solamente a la rama propia y abrir un PR hacia main. Incluir alcance, pruebas, vista previa verificada cuando exista, impacto en datos y actualización del cerebro.
7. **Nunca escribir directamente en main, forzar su historial, integrar un PR ni activar auto-merge sin aprobación explícita de Seba para ese PR y su versión revisada.** Pedir cambios o aprobar un plan no autoriza a publicar. Si hay cambios posteriores que alteren lo aprobado, pedir nueva revisión.
8. Antes de integrar un PR aprobado, revisar main actualizado, resolver conflictos en la rama propia y repetir las comprobaciones afectadas. Integrar a través del PR; no usar un push de rama a main como atajo.
9. Actualizar Bitácora y Pendientes de `docs/CEREBRO.md` en el mismo PR. Distinguir siempre “propuesto/en rama” de “integrado en main”. Conservar los aportes del otro al actualizar documentación.
10. La vista previa de Vercel no significa una base de pruebas: según el cerebro, Supabase es producción. Usar datos simulados para pruebas que escriban. Cambios de esquema/datos, sincronizaciones con escritura, DTE reales y despliegues de funciones requieren autorización específica según las reglas de este archivo.
11. Al entregar: resumen simple, rama, PR, enlace de vista previa solo si se verificó, pruebas realizadas y pendientes. No inventar enlaces ni afirmar despliegues no comprobados.
12. Las instrucciones no sincronizan automáticamente las conversaciones. Cada asistente debe releer GitHub al retomar; Seba comunica los cambios de reparto. No afirmar que Claude recibió un aviso si solo se actualizó el repositorio.

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

## Si no tienes acceso directo a Supabase

Algunas herramientas (Codex) no pueden ejecutar SQL en Supabase. En ese caso:
- Para leer datos o cambiar el esquema, escribe el SQL en un archivo `.sql` y pídele a Seba que lo pegue en **Supabase → SQL Editor → Run**, explicándole antes qué hace.
- Nunca le pidas claves ni las pongas en el código. Las claves van en GitHub Secrets (Settings → Secrets and variables → Actions), Vercel o secretos de Supabase.
