# Coordinación de trabajo — Bulfor OC App

Acuerdo indicado por Seba el 29-10-2026. Leer junto a AGENTS.md / CLAUDE.md y docs/CEREBRO.md.

## Registro vigente

- Codex: aviso de rechazadas pendientes, rama `codex/aviso-rechazadas-pendientes`; alcance: `rechazadasNuevas`, actualización del badge y carga de refacturas en index.html. Integrado en main mediante PR #4 el 30-10-2026; no modifica el PR de Recetario de Claude.

| Responsable | Tarea | Rama | Alcance | Estado / PR |
|---|---|---|---|---|
| Claude | Ordenar, quitar y agregar elementos menú por menú según Seba | Una rama `claude/<menú>` por menú | Menús y sus pantallas; navegación y estilos que requieran esos ajustes | En curso; menú actual: Recetario › Consumo y compras |
| Claude | Recetario › Consumo y compras (ficha centrada, último lote, historial de compras, detalle del consumo por lote/RM, envases sin consumo) | claude/consumo-compras | index.html: bloque `// ─── Compras de materias` (`recCm*`, `fichaMateriaRec`, `recCmHistorial`, `recCmDetalleConsumo`); styles.css: bloques `.rec-cm-*` al final; cerebro y registro | Aprobado por Seba el 30-10-2026; integrado en main mediante PR #2 |
| Codex | Configurar coordinación y contexto compartido | codex/flujo-coordinacion | AGENTS.md, CLAUDE.md, docs/CEREBRO.md, este registro y plantilla de PR | Aprobado por Seba el 30-10-2026; integración mediante PR #1 |
| Codex | Filtrar FedEx y Chilexpress por mes/año | codex/envios-por-mes | index.html: filterFedex y filterChilexpress; cerebro y registro | Integrado en main mediante PR #3 el 29-10-2026 |

## Ciclo de cada tarea

1. Leer el contexto y los PR abiertos; confirmar que la tarea no se superpone con otra.
2. Crear una rama propia desde main actualizado. Registrar aquí responsable, objetivo, rama, archivos/bloques y estado. No editar la rama del otro.
3. Hacer únicamente el alcance solicitado y verificarlo. Usar datos simulados cuando probar pueda escribir en producción.
4. Actualizar cerebro y este registro en el mismo cambio. Abrir PR con la plantilla del repositorio; obtener la URL real de preview si hay despliegue.
5. Seba revisa y prueba. Mantener el PR abierto sin integración automática hasta su aprobación explícita de esa versión.
6. Con aprobación, revisar cambios nuevos de main, resolver conflictos en la rama y validar lo afectado. Si cambia el comportamiento aprobado, volver a revisión.
7. Integrar a través del PR y actualizar el estado. La siguiente tarea parte del main actualizado.

## Archivos compartidos

- index.html concentra muchos módulos: dividir por bloques o funciones, no solo por nombre de archivo.
- styles.css y navegación pueden afectar varias pantallas: reservar su alcance o trabajar en secuencia.
- Cerebro y registro: conservar entradas ajenas y distinguir propuesta de producción. No reemplazar todo con una copia antigua.

## Despliegues y datos

- Main corresponde a producción según el contexto del proyecto. Ningún asistente puede publicarlo sin aprobación de Seba.
- Una preview de Vercel puede usar Supabase de producción. El aislamiento de datos no está verificado.
- No ejecutar sincronizaciones con escritura, migraciones, emisión real de DTE ni despliegues de funciones por el mero hecho de tener una preview.
- Las reglas documentales no equivalen a protección técnica de GitHub. Al revisar este flujo, main no estaba protegido; no se cambiaron ajustes de protección ni configuración de Vercel/Supabase.

## Cómo retomar y comunicar

Cada asistente relee los archivos y PR al iniciar o retomar. GitHub conserva el contexto compartido, pero no envía estas reglas automáticamente a una sesión de Claude ya abierta. Seba puede indicarle que lea esta rama antes de seguir. Actualizar el registro cuando Seba confirme el menú, la rama o el reparto; no inventar ese estado.
