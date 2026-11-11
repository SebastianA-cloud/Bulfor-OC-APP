# Coordinación de trabajo — Bulfor OC App

Acuerdo indicado por Seba el 29-10-2026. Leer junto a AGENTS.md / CLAUDE.md y docs/CEREBRO.md.

## Registro vigente

- 11-11-2026 · Claude · `claude/boton-volver-graficos` · A pedido de Seba: botón Volver visible en los gráficos. Alcance: styles.css, regla `.btn-volver-graficos`. Estado: aprobado por Seba el 11-11-2026 e integrado en main mediante PR #26.
- 11-11-2026 · Claude · `claude/menu-facturas-bulfor` · A pedido de Seba (interfaz, normalmente de Codex): Facturas Bulfor con creación de documentos adentro, "Buscar documentos" y gráficos como botones. Alcance: index.html (menú lateral, barra de módulos, barra del celular, Inicio, `SUBMENUS`, `GRUPO_PAGINA`, `renderNavSubmenuMobile`, barra de Cobranza y de Facturas por pagar, encabezados de los gráficos), `permisos.js` (nombres de módulo, botones con permiso, Borradores), `documentos.js` (enlaces al menú), styles.css (2 reglas al final). Ojo con el PR #24 si también toca `SUBMENUS`. Estado: aprobado por Seba el 11-11-2026 e integrado en main mediante PR #25.
- 06-11-2026 · Claude · `claude/oe-rm-paciente` · A pedido de Seba (interfaz, normalmente de Codex): paciente en las sugerencias de RM de Órdenes de elaboración. Alcance: index.html, solo `recPintarSeccionOE` (llamada a `rec_oe_candidatos` y la tarjeta de cada sugerencia); función `rec_oe_candidatos` en Supabase (autorizada). Estado: aprobado por Seba el 06-11-2026 e integrado en main mediante PR #23.
- 05-11-2026 · Claude · `claude/usuario-login` · A pedido de Seba: usuario por cuenta (sirve con correos de cualquier dominio) y desplegable del login con los usuarios de ese equipo. Alcance: index.html, bloque del login (`resolverCorreoLogin`, `usuariosDelEquipo`, `manejarLogin`); permisos.js, columna Usuario, "Cambiar usuario" y campo al crear. Base: `perfiles.usuario` y `correo_de_usuario` ya aplicados con autorización. Estado: aprobado por Seba el 05-11-2026 e integrado en main mediante PR #20.
- 05-11-2026 · Claude · `claude/login-usuario` · A pedido de Seba: entrar con usuario en vez de correo. Alcance: index.html, campo del login, `iniciarSesion` (mensaje de error), bloque `USUARIOS_CONOCIDOS`/`manejarLogin`/`precargarCorreoRecordado`; permisos.js, texto del formulario Nueva cuenta. Estado: aprobado por Seba el 05-11-2026 e integrado en main mediante PR #19.
- 05-11-2026 · Claude · `claude/perfiles-permisos` · A pedido de Seba (aunque la interfaz corresponde a Codex desde el 02-11; si Claude se queda sin tokens, Seba pasa el trabajo a Codex): menús por perfil y pantalla Usuarios y permisos. Alcance: archivo nuevo `permisos.js`; en index.html solo el script, el grupo Administración (menú lateral, barra de módulos, barra del celular), la página `page-usuarios`, `SUBMENUS.admin`, guardas de permiso en `showPage` (override), `mostrarModulo`, `seleccionarSubpagina`, `renderNavSubmenuMobile`, `renderInicioKpis`, `renderInicio` y `arrancarApp`; styles.css bloque `.sin-permiso`/`.usr-*` al final; `supabase/functions/admin-usuarios`. Base: tabla `perfiles` y función ya creadas con autorización. Estado: aprobado por Seba el 05-11-2026 e integrado en main mediante PR #18.
- 04-11-2026 · Claude · `claude/documentos-guias-estado` · A pedido de Seba (aunque la interfaz corresponde a Codex desde el 02-11): estado real de las guías en Facturas de venta › Documentos. Alcance mínimo: en index.html solo el resumen de `renderDocumentosGdexpress` y la etiqueta de guías de su tabla; en `guias-cot.js` funciones nuevas `gcAsegurarDatos`, `gcEstados`, `gcEstadoGuia`, `gcBadgeGuia`, `gcResumenGuias` y `gcInvoices` excluye facturas rechazadas. Estado: aprobado por Seba el 04-11-2026 e integrado en main mediante PR #17.
- 04-11-2026 · Claude · `claude/guias-cot-correcciones` (creada sobre `codex/guias-cot-20261104`, sin escribir en la rama de Codex) · Correcciones de la revisión del PR #15, a pedido de Seba. Alcance: solo `guias-cot.js`, cerebro y este registro. Estado: aprobado por Seba el 04-11-2026 e integrado en main mediante PR #16 (incluye los commits de Codex); PR #15 cerrado sin integrar.
- 04-11-2026 · Codex · `codex/guias-cot-20261104` · Guías por facturar, centrado en COT. Alcance: entrada en SUBMENUS y pantalla `page-guias-cot` de index.html, módulos `guias-cot.js` y `guias-cot.css`, `docs/GUIAS_COT.md` y cerebro. Autorizadas y creadas dos tablas nuevas RLS; histórico 2026 cargado (82 guías / 8 grupos); parser de correo de junio y render de datos simulados probados sin escritura. PR #14 cerrado sin merge. Estado: PR #15 abierto (sin merge); Vercel informó despliegue exitoso, falta prueba visual y revisión de Claude; Seba debe aprobar expresamente este PR antes de integrar.

- 04-11-2026 · Codex · propuesta en `codex/factura-ux`. Factura: buscar cliente por nombre, ayuda para orden, errores enlazados a secciones y revisión/edición antes de emitir. Validación y emisión existentes conservadas; pruebas con datos simulados. Pendiente PR y revisión de Seba.

- 04-11-2026 · Codex · propuesta en `codex/precios-ux`. Precios: búsqueda etiquetada, acceso por teclado, filtro de clientes en ficha que conserva consulta al volver, resumen del último precio sin IVA y regresos explícitos. PR y revisión pendientes.

- Codex · propuesta en `codex/estadisticas-ux` · Estadísticas de órdenes de compra. Informes agrupados, controles de teclado y alcance de los datos visible. Pendiente de revisión.

- Codex · propuesta en `codex/hospitales-ux` · Hospitales. Apertura de ficha con teclado, quitar región conservando búsqueda y aclarar total en órdenes con IVA. Pendiente de revisión.

- Codex · propuesta en `codex/mejorar-busqueda-oc` · Buscar orden de compra. Coincidencia exacta, ayuda bajo el campo y limpieza de filtros conservando el texto. Pendiente de revisión.

- Codex · codex/buscar-orden-compra · etiqueta y buscador de Órdenes de compra en index.html · propuesta para revisión.

- Codex · `codex/contraste-submenus` · Mejorar la visibilidad del desplegable de escritorio. Alcance: `#nav-submenu` en `styles.css` y documentación. Propuesto para revisión en PR.

- Reparto de Seba (02-11-2026): Claude continúa Pharma_RM/lotes/stocks en `bulfor-recetario`; Codex asume los cambios de interfaz de la app. Esta tarea autoriza exclusivamente Recetario › Alertas de lotes.
- Codex: propuesta de dos pestañas de Alertas de lotes, rama `codex/alertas-lotes-ux`; alcance: HTML de `page-rec-alertas`, estado y funciones `recAlertas*`/historial del mismo bloque, estilos solo bajo `#page-rec-alertas`, documentación. Implementado y probado con datos simulados. Pendiente revisión de Seba.

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
