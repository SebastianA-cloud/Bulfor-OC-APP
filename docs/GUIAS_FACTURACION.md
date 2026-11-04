# Guías por facturar

Nueva página de Facturas de venta, propuesta en `codex/guias-por-facturar`.

## Demostración sin datos reales

`prueba-guias.html` usa la misma pantalla y lógica del submenú, con hospitales, guías y facturas ficticios. Permite probar selección, guardado, retiros, períodos, OC, COT e historial. Los cambios solo existen en memoria hasta recargar; no contiene credenciales ni se conecta a Supabase. La app normal sigue usando su conexión autenticada y no carga este ejemplo.

## Uso

1. Elegir hospital y año, y pulsar Revisar guías.
2. Filtrar por mes de despacho. Las facturas sin período confirmado aparecen por fecha de emisión y dicen «Por definir».
3. Abrir una factura y desplegar «Guías de despacho asociadas». Cada guía abre su documento original.
4. Un editor puede seleccionar «Asociar guías», elegir el mes y parte del mes (Enero 1, Enero 2…), OC, COT y motivo/respaldo.
5. La vista «Guías sin factura / por revisar» muestra los despachos sin vínculo o con referencias a varias facturas. El historial registra asociaciones, retiros y cambios de período.

Se comparan RUT normalizados. Solo referencias XML tipo 52 generan asociaciones automáticas. No se usan montos o fechas para adivinar relaciones. Una revisión manual sustituye las referencias automáticas de esa factura, incluso cuando la selección queda vacía. Se pueden seleccionar guías de distintos meses, manteniendo visibles las fechas originales.

Facturas anuladas, rechazadas, reemplazadas o con NC requieren revisión y no cubren guías como facturación vigente. Esta primera versión trata cualquier NC vinculada de forma conservadora; una NC parcial necesita revisión del equipo. Cada guía se asocia completa a una factura en los registros manuales. Facturación parcial de una misma guía no está incluida.

## Activación pendiente de aprobación

`docs/sql/guias_facturacion.sql` crea tres tablas nuevas con RLS, políticas para usuarios autenticados, escritura de editores, validaciones y un historial que no se puede editar por la API. La función pública de guardado es SECURITY INVOKER; el trigger SECURITY DEFINER es privado y solo escribe el historial tras validar rol e identidad. La PK de guía evita duplicados; la versión evita sobrescribir otra edición.

No se ha ejecutado ese SQL en Supabase. Sin él, el lector de referencias sigue disponible pero el resultado se identifica como provisional, y guardar/historial están deshabilitados. No se importan automáticamente las relaciones del Excel ni se modifican DTE o pagos. Se requiere autorizar la creación de estas tablas antes de habilitar asociaciones compartidas. La integración a main requiere aprobación separada del PR revisado según AGENTS.md.

## Comprobación

- `tests/guias-facturacion.cjs`: Playwright con documentos y API simulados. XML con namespace, período distinto a emisión, COT desde OC, pendiente, factura rechazada, referencias en conflicto, formulario y error de versión, ausencia de tabla, lectura parcial fallida y móvil. Todas las solicitudes externas se interceptan, sin escrituras de producción.
- `tests/guias-facturacion-db.mjs`: PostgreSQL aislado mediante PGlite. Ejecuta el SQL propuesto y comprueba permisos de lector/anon/editor, hospital, tipo de documento, rechazo, duplicados, versión, atomicidad, historial inmutable y liberación/reasignación.
- Dependencias de prueba externas: `playwright`, `@electric-sql/pglite`. No se agregan dependencias a la app. Se pueden indicar rutas con `PLAYWRIGHT_MODULE`, `PGLITE_MODULE` y `CHROME_PATH`.
- Tras aprobar la activación: aplicar SQL, revisar asesores de seguridad y comprobar con un editor y un lector reales. No se ha probado en la base productiva.
