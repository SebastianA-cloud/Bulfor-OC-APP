# Guías por facturar — implementación COT (04-11-2026)

**Estado:** propuesta en rama `codex/guias-cot-20261104`, PR #15 (https://github.com/SebastianA-cloud/Bulfor-OC-APP/pull/15). No integrada a main. El PR #14 fue cerrado, sin integración. Requiere revisión de Claude y aprobación explícita de Seba para integrar.

## Qué hace

- En Facturas de venta, submenú Guías por facturar.
- Un filtro por hospital (La Florida inicialmente; Roberto del Río fuera de Todos, pero seleccionable), mes de despacho y doce estados mensuales.
- Cuatro etapas: Sin COT → En COT, esperando OC → Con OC, sin factura → Facturada. Un despacho que ya trae su OC entra directamente en la tercera etapa.
- Grupos por COT u OC, fecha, período, detalle plegable, vínculo a ficha existente, cobro y cuatro hojas Excel.
- El seguimiento de 2025 es solo el estado «Facturado (histórico)».
- El registro de COT reconoce número (si está), monto con IVA, vencimiento y líneas Fecha / Guía / Monto. Valida folio, fecha, hospital, unicidad y monto real. Si no cuadra, pide nota pero permite guardar.
- La relación guía→COT tiene restricción única en Supabase; la edición de COT no mueve ni elimina guías. Borrar una COT completa libera sus guías.
- No se lee correo automáticamente; Seba pega el texto.

## Tablas aprobadas y ya creadas (Supabase producción)

- `public.guias_cot`: grupo/COT, RUT y nombre hospital, número opcional, monto, vencimiento, mes, quincena, nota.
- `public.guias_cot_detalle`: COT + ID de `documentos_gdexpress`, único por guía.
- RLS activado, 4 políticas por tabla: lectura autenticados; escritura editor según `app_metadata.rol`. Avisos de seguridad verificados: los avisos detectados son preexistentes en otras tablas/funciones.

## Carga histórica autorizada

Realizada 04-11-2026, usando una única transacción con validación de número de guías, montos, factura de cada grupo y hospital 65075485-9. **8 grupos, 82 guías**, sin duplicados. Se usaron las siete referencias de facturas proporcionadas, como `FACTURA_HISTORICA:<folio>` en la nota del grupo, sin inventar números de COT. Grupo junio: COT 812030-1038-COT26, vencimiento 02-11-2026, $6.790.201, seis guías, esperando OC.

La guía 5392 **no** se cargó: queda Sin COT, total $5.672.016 (diferencia errónea de factura 22309). También quedan sin COT abril, las guías intermedias mencionadas y las posteriores a 5401, salvo que tengan OC real directa.

Se conservan los grupos «Enero 1», «Febrero 1» y «Marzo 1» aprobados, aun cuando contengan guías emitidas después del día 15. Para nuevos registros se aplica quincena real.

## Cómo probar

1. Abrir vista previa del PR y entrar con su usuario habitual. Buscar Facturas de venta → Guías por facturar.
2. La Florida, Mayo 2026: grupo de factura 22309 y guía 5392 como Sin COT. Junio 2026: grupo 5396–5401 «En COT» de $6.790.201.
3. Revisar que los meses Enero, Febrero, Marzo y Mayo reconozcan las facturas históricas, aunque emitidas meses más tarde.
4. Descargar Excel y comprobar 4 hojas, columnas, montos y totales.
5. **Prueba aislada**, sin escrituras: agregar `?guias_demo=1#guias-cot` a la URL del despliegue y abrir la pantalla. La maqueta usa las seis guías ficticias (IDs 95000–95005) y su COT; no ejecuta guardados.
6. Con rol editor, abrir Registrar COT y pegar el texto ejemplo. Debe reconocer seis guías y $6.790.201. **No guardar ese ejemplo en producción**, porque las seis guías están vinculadas por la carga histórica y la app debe mostrar aviso de duplicados.

## Pendientes para revisión de Claude y Seba

- Vercel reportó un despliegue completado (GitHub status). URL de rama: https://bulfor-oc-app-git-codex-guias-cot-20261104-bulfor-s-projects.vercel.app/ . No se verificó respuesta HTTP ni apertura visual desde este entorno.
- Probar visualmente la vista previa real en escritorio y móvil (no confundir compilación/construcción de la rama con prueba visual).
- Verificar con usuario editor y viewer los permisos de acceso y guardado, sin usar un registro real de prueba sobre las guías históricas.
- Revisar posibles coincidencias múltiples de facturas por OC: si hay ambigüedad no asociar automáticamente.
- Las COT sin número pueden mostrarse con el número de COT de una OC solo si coincide de forma única el hospital y el total exacto; si hay varias OC iguales, no se vinculan automáticamente. Esta resolución se calcula al leer, sin modificar el número guardado.
- Aún no se integra a main. Claude revisa primero y Seba aprueba expresamente el PR concreto.
