# Cerebro del proyecto — Bulfor OC App

> **Para cualquier IA (Claude, ChatGPT/Codex u otra) que retome el trabajo.**
> Lee este archivo ANTES de abrir `index.html` (≈18.600 líneas). Aquí está el mapa
> de la app, cómo está hecha, qué se ha decidido y qué está pendiente, para que no
> tengas que leer todo el código. Las reglas de trabajo están en `AGENTS.md` /
> `CLAUDE.md` (son las mismas).
>
> **Mantenlo al día:** cada vez que termines un cambio, agrega una línea en la
> "Bitácora" (sección 9) y actualiza "Pendientes" (sección 10) y lo que haya
> cambiado de las demás secciones. Última actualización: 29-10-2026.

---

## 1. Qué es y quién la usa

- App web interna de **Farmacia Bulfor** (recetario magistral, Chile; RUT 76.186.755-5).
- La usa el equipo para: órdenes de compra de **Mercado Público**, facturas de venta
  y cobranza, facturas de proveedores, emisión de documentos tributarios (DTE),
  envíos **FedEx** y **Chilexpress**, **Órdenes de Elaboración** (recetas de pacientes
  de mesón), **Recetario** (copia de Pharma_RM: cada RM con su fórmula, lotes y
  costos), **Control Farmacia** (stock, lotes, vencimientos) y **RR.HH.** (vacaciones).
- **Seba** (dueño y Director Técnico) pide los cambios. Trabaja solo desde la web
  (GitHub, Vercel, dashboard de Supabase), sin entorno local, y en **español**.
  Explícale en lenguaje simple, sin jerga. No le pidas que ejecute comandos.

## 2. Cómo se trabaja (resumen; detalle en AGENTS.md)

1. Rama de trabajo actual: **`etapa2-uso-diario`** (rediseño "Etapa 2"). Se hace
   commit + push a esa rama; Vercel genera la vista previa:
   https://bulfor-oc-app-git-etapa2-uso-diario-bulfor-s-projects.vercel.app
2. **Solo se pasa a `main` cuando Seba lo dice** ("pásalo a main"). Se hace con
   `git push origin etapa2-uso-diario:main` (fast-forward; antes revisar que `main`
   no tenga commits que la rama no tenga). Producción: https://bulfor-oc-app-theta.vercel.app
3. Cada respuesta a Seba termina con: qué cambió, si está en rama o en main, link y
   pasos para probar. Recordarle recargar con **Ctrl+F5** (el navegador guarda la versión vieja).
4. Cambia solo lo que se pidió; lo demás, propónlo y espera su decisión.
5. Comentarios del código en español, estilo explicativo (como el código existente).
6. **Nunca** claves/tokens en el código (el repo es **público**). Solo la anon key de Supabase va en el navegador.
7. Cambios de base de datos: explicar antes y esperar el "sí". Respaldo
   `<tabla>_backup_AAAAMMDD` antes de cambios masivos. Tabla nueva = RLS + políticas.
8. DTE: nunca producción ni documentos reales sin autorización explícita.

## 3. Arquitectura

| Pieza | Qué es |
|---|---|
| `index.html` | Toda la app (HTML + JS vanilla, ≈18.600 líneas). **Nunca reescribirlo entero**: buscar con grep y editar el bloque. |
| `styles.css` | Estilos (≈1.800 líneas). Marca `#C0392B`. Íconos Tabler (CDN). Muchas reglas nuevas van al final del archivo. |
| `panel.js` | Sistema de "fichas" (ventana grande centrada) — ver sección 5. |
| `documentos.js` | Creación de documentos tributarios (factura, múltiple, guía, NC). |
| `api/notificar-receta.js` | Función Vercel: correo (Resend) al llegar una Orden de Elaboración. |
| `supabase/functions/emitir-dte/` | Edge Function: emite facturas (33) y guías (52) vía GDExpress. Ambiente según secreto `DTE_AMBIENTE` (T/P). |
| `supabase/functions/buscar-factura/` | Edge Function solo lectura: busca en GDExpress una factura recién emitida (para "Nuevo envío"). |
| `*.py` + `.github/workflows/` | Sincronizaciones en GitHub Actions (sección 7). `probar_*` / `diagnosticar_*` = diagnóstico. |
| `agente/bulforsync_recetario.ps1` | Copia del agente que corre en el **servidor de la farmacia** (sección 7). |
| `sw.js`, `manifest.json` | Solo para instalar la app; el service worker no cachea. |

Hosting: **Vercel** (proyecto `bulfor-oc-app`, equipo `bulfor-s-projects`), despliegue
automático por rama. Base de datos: **Supabase** proyecto `uodijcksuqaaovohutkf`.

## 4. Mapa de `index.html` (buscar por estos títulos de sección)

El código está dividido con comentarios `// ─── TÍTULO ───`. Busca el título con grep.

| Módulo (menú) | Páginas (`page-…`) | Dónde buscar |
|---|---|---|
| Inicio | `inicio` | `Pantalla Inicio: "Requiere atención"` |
| Órdenes de compra | `oc`, `hospitales`, `estadisticas` | `Listado de OC`, `RENDER OC`, `Ficha de un hospital`, `STATS` |
| Precios | `facturas-productos` | `Precios: productos base`, `Precios → Por cliente`, `grupoDeProductos` |
| Creación de documentos | `doc-factura`, `doc-multiple`, `doc-guia`, `doc-nc` | `documentos.js` |
| Facturas de venta | `facturas` (Documentos), `pagos` (Cobranza), `facturas-rechazadas`, `pagos-graficos` | `BUSCADOR DE DOCUMENTOS`, `Ficha de un documento`, `SEGUIMIENTO PAGO DE FACTURAS`, `Cobranza por cliente`, `FACTURAS RECHAZADAS`, `Casos de facturas rechazadas`, `GRÁFICOS DE PAGOS` |
| Facturas de proveedores | `facturas-por-pagar`, `facturas-prov-productos`, `facturas-prov-graficos` | `FACTURAS POR PAGAR`, `PRODUCTOS DE FACTURAS PROVEEDOR`, `Fichas de Productos de proveedores` |
| FedEx | `fedex` | `SEGUIMIENTO FEDEX`, `FedEx: lista con atajos`, `fichaEnvioFedex`, `fxRutaHtml`, `Nuevo envío` |
| Chilexpress | `chilexpress` | `CHILEXPRESS`, `fichaEnvioChilexpress`, `abrirRastreoChilexpress` |
| Elaboración | `elaboracion`, `pacientes`, `solicitudes-web` | `MÓDULO ÓRDENES DE ELABORACIÓN`, `FICHA DE LA ORDEN`, `Preparados anteriores del paciente`, `N° RM EN ÓRDENES DE ELABORACIÓN`, `PACIENTES`, `SOLICITUDES WEB` |
| Recetario | `rec-buscar` (vistas "Por RM" y "Por preparado"), `rec-compras`, `rec-alertas`, `rec-costos`, `rec-produccion` | `RECETARIO MAGISTRAL`, `BUSCAR RM`, `Nombrar un preparado`, `Preparados (vista "Por preparado"`, `DETALLE DE UN RM`, `ALERTAS DE LOTES`, `COSTOS Y MÁRGENES`, `Compras de materias` |
| Control farmacia | `farmacia-compras`, `farmacia-stock`, `farmacia-movimientos`, `farmacia-vencimientos`, `farmacia-catastro` | `CONTROL FARMACIA`, `FARMACIA: …` |
| RR.HH. | `rrhh-personal`, `rrhh-vacaciones` | `Pestaña Resumen`, `El cálculo del saldo`, `vac_*` |
| Navegación | — | `SUBMENUS` (objeto de menús), `seleccionarSubpagina`, `irAModuloPagina`, `showPage` |

Notas de navegación: los menús se definen en `SUBMENUS`; `showPage(id)` activa
`#page-<id>` y llama al `…Init()` del módulo (ver el bloque de `if (id === …)` cerca
del final). `showPage('rec-preparados')` redirige a Buscar RM, vista "Por preparado".

## 5. Patrones y piezas reutilizables (no duplicar)

**Datos**
- `fetchAll(tabla, query)` — lectura paginada de a 1000 (usar siempre que pueda haber >1000 filas). `recRpc(fn, params)` = lo mismo para funciones RPC.
- `sb(path, opciones)` — fetch a la REST de Supabase con la sesión (para POST/PATCH; upsert con header `Prefer: resolution=merge-duplicates`).
- `sesionActual` = `{ access_token, email, rol }`; editores: `sesionActual.rol === 'editor'`.

**Texto y formato**
- `coincideBusqueda(texto, q)` (varias palabras, sin tildes), `escapeHtml`, `clp(n)` ($), `fDate(fecha)` (dd-mm-aaaa, **corta el string**, no convierte zona), `nombreHosp(crudo)` (nombre estándar del hospital), `rutConPuntos`, `rutEsValido`, `claveOrdenNombre`, `esRuido`.
- **Fechas (Chile)**: muchas fechas se guardan solo como día y quedan a medianoche UTC; si se convierten a hora de Chile se corren al día anterior. Usar `diaEnvioChile(d)` (toma tal cual las fechas "solo día") o `fDate`. Hubo varios bugs por esto.

**Listas**
- `paginate(data, page)` + `renderPages(contId, total, pages, cur, 'fnName')` — páginas de 15 (`PS`).
- Período mes/año: patrón `{ anio, mes }` con selectores `‹ mes año ›` (ej. `fedexPoblarSelectores`, `fedexCambiarMes`, `recCambiarMes`, `rangoDelAlcance`).
- Tablas principales: clases `table-card oc-tabla tabla-centrada`; filas `oc-fila`; títulos oscuros y fijos al bajar (`ajustarCabecerasFijas()` calcula `--thead-top`). Si una tabla anidada no debe tener título fijo: `thead th { position: static !important }`.
- Listas A–Z: `renderTablaAlfabetica(...)` (opción `numerosAlFinal` para el grupo "#").
- Pestañas de estado: `fpp-status-tabs` / `fpp-status-tab`. Interruptor de vistas: `vista-switch`.

**Fichas (panel.js)**
- `panelAbrir(ficha, desde)` abre la ventana grande; `desde=true` la apila con "← Volver". Campos de la ficha: `antetitulo, titulo, tituloMono, tituloCopiar, tituloExtra, sub, resumen, cuerpo, pie, navegacion {texto, anterior, siguiente}, alCerrar, angosto` (+ claves propias como `docId`, `envioId`, `cxId`, `ocCodigo`). `panelPila`, `panelPintar`, `panelCerrar`, `panelEsc`.
- Fichas existentes: `fichaDocumento(id, lista, {cobranza})`, `fichaOC(codigo)`, `fichaEnvioFedex`, `fichaEnvioChilexpress`, `fichaFacturaProveedor`, fichas de Precios y de proveedores.
- Modales antiguos (`modal-overlay` + `modal-shell`): `cerrarTodosLosModales()`, `navPush(()=>volver)` + `botonAtrasHtml()` para "Volver".
- Clases de ficha: `doc-arriba`, `doc-caja`, `oc-info`, `oc-fact`, `panel-tabla-cuadros`, `doc-totales`, barra plegable `fx-envio` (`<details>`; "Ver productos"), `btn-mp` (botón píldora), `btn-mp-gris`, `btn-mp-cx`.

**Otros**: `toast(msg, 'err')`, `copiarTexto(v, boton)`, SheetJS (`XLSX`) cargado para Excel, `botonMP(url, texto)` (Mercado Público).

## 6. Base de datos (Supabase `uodijcksuqaaovohutkf`)

RLS en todo. Patrón de políticas: `leer_autenticados` (select, authenticated) y
`escribir_editores` / `actualizar_editores` / `eliminar_editores` con
`(auth.jwt()->'app_metadata'->>'rol') = 'editor'`.

| Área | Tablas / vistas / funciones principales |
|---|---|
| OC Mercado Público | `ordenes_compra`, `items_oc`, `hospitales`, `hospitales_maestro` (nombre estándar + RUT), `productos`, `diccionario_normalizacion`, `equivalencias_costo` |
| Documentos emitidos (GDExpress) | `documentos_gdexpress` (tipo_dte 33 factura, 52 guía, 61 NC; `xml_completo`, `orden_compra_ref`, `estado_aceptacion`), `documentos_gdexpress_items` (**`codigo_tipo`='RM' + `codigo_valor`= N° de RM** del producto magistral), `dte_borradores` |
| Cobranza | `facturas_pago`, `feriados`, `sync_estado` |
| Proveedores | `facturas_por_pagar`, `facturas_por_pagar_items`, `notas_credito_recibidas`, `proveedores_cuentas` |
| Envíos | `seguimiento_fedex` (`historial` jsonb = movimientos de FedEx `[{fecha, estado, lugar, tipo}]`), `seguimiento_chilexpress` (estado manual) |
| Elaboración | `ordenes_elaboracion` (`pago`, `tipo_pago`, `numero_rm`, `paciente_id`, `receta_id`), `pacientes`, `recetas`, `solicitudes_web` |
| Recetario (copia de Pharma_RM) | `rec_rm` (cada RM; `paciente_nombre`, `paciente_rut` desde 29-10-2026), `rec_componentes`, `rec_materias`, `rec_lotes`, `rec_ingresos`, `rec_proveedores`, `rec_formas`, `rec_sync_log`, `rec_config` (hash del token del agente), `rec_lotes_revisados`; vistas `rec_rm_v` (RM + fórmula `descripcion` + costos), `rec_lineas`, `rec_rm_facturado` (N° RM normalizado de facturas y guías desde 2025) |
| Nombres de preparados | `rec_rm_nombres` (nombre puesto a mano por RM), `rec_formulas_nombre` (diccionario fórmula→nombre; origen factura/guía/manual) |
| Funciones RPC recetario | `rec_lista(p_desde, p_hasta, p_q, p_solo_alertas, p_limite)` (lista de Buscar RM con nombre y paciente; plpgsql), `rec_buscar`, `rec_preparados`, `rec_formulas_refrescar()` (rellena el diccionario; la llama la sync de documentos), `rec_ingest`/`rec_estado` (las usa el agente, con token), `rec_rut_dv`, `rec_resumen`, `rec_oe_candidatos`, `rec_costos_formulas`, `rec_margen_oe`, `rec_produccion`, `rec_vencimientos`, `rec_lotes_en_uso`, `rec_materias_resumen` |
| Control farmacia (sistema de ventas) | `farmacia_productos`, `farmacia_lotes`, `farmacia_movimientos`, `farmacia_familias`, `erp_*` (copia del sistema de ventas SenegPOS vía agente `erp_ingest`), vistas `v_farmacia_*` |
| RR.HH. | `personal`, `vacaciones_*`, funciones `vac_*` |

**Truco importante:** a veces la herramienta de migraciones de Supabase se queda
esperando una confirmación que no llega. En ese caso se le entrega a Seba un archivo
`.sql` para que lo pegue en **Supabase → SQL Editor → Run** y luego se verifica con una consulta.

## 7. Sincronizaciones y agentes

| Qué | Dónde corre | Frecuencia | Notas |
|---|---|---|---|
| OC Mercado Público (`actualizar_oc_final.py`) | GitHub Actions | cada 2 h | |
| `sincronizar_gdexpress.py` | GitHub Actions | cada 2 h (:20) | **Ojo:** hoy su código trae facturas RECIBIDAS de proveedores (GRUPO=R), igual que `sincronizar_facturas_recibidas.py`; parece una copia antigua. Revisar si sobra (no tocar sin consultar a Seba). |
| Documentos emitidos (`sincronizar_documentos_gdexpress.py`) | GitHub Actions | cada 2 h (:35) + **rápida cada 15 min** (`sincronizar_documentos_rapido.yml`, últimos 3 días) | Al final llama `rec_formulas_refrescar()` |
| Facturas recibidas (`sincronizar_facturas_recibidas.py`) | GitHub Actions | cada 2 h (:50) | |
| FedEx (`sincronizar_fedex.py`) | GitHub Actions | cada 2 h (:40) | API oficial FedEx; guarda estado, fecha de entrega, quién recibió ("Liberación de firma" → "Sin firma") e `historial`. Modos manuales: `probar`, `escribir`, `historial` (carga única de movimientos de los ya entregados). |
| Recetario (agente `BulforSync Recetario`) | **Servidor de la farmacia** `SERV_SENEGPOS`, Programador de tareas, cada 30 min | `C:\BulforSync\recetario\recetario.ps1` (copia en `agente/bulforsync_recetario.ps1`; la clave va en `config_recetario.json` del servidor, nunca en el repo). Lee Pharma_RM (MySQL) solo con SELECT y llama `rec_ingest`. Log: `C:\BulforSync\recetario\logs\recetario.log`. |
| Sistema de ventas (agente ERP) | Servidor de la farmacia | — | Llama `erp_ingest`. |
| Chilexpress | — | — | **Sin API** (la de producción exige Tarjeta Cliente Chilexpress; se decidió no usarla). Estado se anota a mano. Su página no acepta la OT en el enlace, así que "Ver en Chilexpress" copia la OT y abre el Centro de Ayuda. |

Secretos (GitHub Secrets / Supabase): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`FEDEX_API_KEY`, `FEDEX_SECRET_KEY`, `DTEBOX_IP`, `GDEXPRESS_API_KEY`, `DTE_AMBIENTE`, etc.
Las sincronizaciones solo corren lo que está en **`main`**.

## 8. Decisiones de diseño ya tomadas (respetarlas)

- **Estilo general** (Etapa 2): listas como Órdenes de compra/Facturas: tabla centrada, títulos oscuros fijos, selector mes/año `‹ ›`, páginas de 15, fichas en ventana grande con cajas (`doc-caja`).
- **Documentos**: ficha con OC + botón Mercado Público, caja Cobranza pequeña y caja Estado SII/Envío; productos en tabla cuadriculada con Neto/IVA/Total solo bajo Precio y Total; rechazadas/anuladas = "No se cobra". Columna "Folio".
- **Cobranza**: "Por factura" es la vista por defecto.
- **Facturas rechazadas**: pestañas "Por resolver" (por defecto, ignora el mes) y "Resueltas"; se siguen solo rechazos desde 28-10-2026 (`RECHAZADAS_SEGUIR_DESDE`).
- **FedEx / Chilexpress** (deben verse iguales): lista con columna Fecha (sin separaciones por día ni espacios), Hospital, OT, Factura, Estado, Recibió. "En camino/Con retraso/Con problema" y **"Todos" muestran todos los meses**; solo "Entregados" se ve por mes. Ficha angosta: OT + "Ver en …" (+ "Editar" en FedEx), estado en la esquina superior derecha **sin fechas**, "Qué se envió" plegable (Factura, Orden de compra, Productos, Total; sin fecha de emisión), "Ruta del envío" **horizontal** (Enviado → cada día en ruta con ciudad → Entregado). Sin total de factura, sin "enviado el" bajo el hospital, sin "Ingresado en la app". Si el número no es factura se busca como guía (52).
- **Elaboración**: vista Lista por defecto (Tablero disponible); lista con columna Fecha (sin separaciones), RM, Pago (Mesón/Transferencia/Por cancelar · Abono) y todo cabe a lo ancho; al crear orden el **pago y el tipo (total/abono) son obligatorios**; al elegir paciente existente se abre "Preparados anteriores" y se copia todo (incluida receta si vigente <1 año) **menos fecha/hora de retiro**; sección Recetario (N° RM) plegable y cerrada por defecto.
- **Buscar RM**: lista por mes/año (sin "7/30/90 días"), se mantiene "Solo con lote vencido"; columnas Fecha (sin hora), RM, Cantidad, Preparado, Paciente/Hospital (nombre + RUT), Costo MP, Avisos. Nombre del preparado: a mano > factura/guía del RM > misma fórmula; **no mostrar** bajo el nombre de dónde salió (solo en el globo al pasar el mouse). "＋ Ponerle nombre" sugiere nombres con concentración recalculada. Ficha del RM sin contraseña ni N° interno, tablas centradas. Vista "Por preparado" (antes pantalla Preparados): orden por nombre/veces/fecha/costo/forma, filtro por forma, costo última RM vs costo hoy (▲▼ si cambia >5%), últimas 10 RM y "Ver todas".
- **Consumo y compras**: la ficha de una materia se abre en la ventana grande del centro (como OC), no en panel lateral: arriba **una franja compacta** de 5 celdas: costo actual, último precio (▲▼), promedio 12 meses, último lote (con fecha y proveedor) y vencimiento (aviso Vencido / Vence en N días ≤90 / Vigente). Compras vs consumo con las 6 cifras en una fila y gráfico bajo a todo el ancho: **cerrada, la ficha cabe entera sin desplazarse**; solo se desplaza al abrir las barras. Abajo compras vs consumo y dos barras **plegables, cerradas por defecto**: "Historia de precios" (resumen en la barra; al abrir: cambio en el período, lo más barato y lo más caro con proveedor, gráfico con ejes de precio y meses, un punto por compra coloreado por proveedor y línea punteada del costo actual) y "Últimas compras" (10 más recientes + botón "Ver historial de compras (N)" → ventana con todas (fecha, proveedor, documento, lote, vencimiento, cantidad, precio unitario, costo y total).
- **Precios**: agrupación compartida `grupoDeProductos` (ZIMC=ZINC, PITASIO=POTASIO, ENOBARBITAL→FENOBARBITAL; OCARBAMAZEPINA es oxcarbazepina, va aparte).

## 9. Bitácora (lo último arriba)

- 29-10-2026 — Consumo y compras: ficha compacta (franja de 5 celdas, compras vs consumo en una fila) para que quepa sin scroll.
- 29-10-2026 — Consumo y compras: Historia de precios y Últimas compras plegables; gráfico de precios rehecho (ejes, proveedores por color, costo actual, tres cifras de resumen).
- 29-10-2026 — Consumo y compras: ficha centrada estilo OC con último lote y vencimiento (`rec_lotes`), e historial completo de compras en ventana aparte (rama `etapa2-uso-diario`, pendiente de pasar a main).
- 29-10-2026 — Buscar RM + Preparados unidos; nombres de preparados desde facturas/guías (tablas `rec_rm_nombres`, `rec_formulas_nombre`, vista `rec_rm_facturado`, función `rec_lista`); paciente (nombre + RUT) desde Pharma_RM (columnas en `rec_rm`, `rec_ingest` v2, agente v2). FedEx: `historial` + ruta horizontal + carga única de movimientos de 68 entregados; arreglo de fechas "solo día". Chilexpress igual a FedEx, botón que copia la OT, 2 envíos cargados a mano (guía 5480 Quillota, factura 22283 Serena). Pestaña "Todos" = todos los meses. Elaboración: lista sin separaciones, pago obligatorio, preparados anteriores del paciente, 10 órdenes antiguas sin pago → "Cancelado en meson".
- 28-10-2026 — Etapa 2 pasada a main (Precios, Creación de documentos con refacturación, Documentos, Cobranza, Rechazadas, Gráficos de cobros, Facturas por pagar, Productos de proveedores, FedEx, Chilexpress, títulos fijos, paginación). Edge Function `buscar-factura` y sincronización rápida de documentos.

## 10. Pendientes

- [ ] **Agente del recetario v2** (paciente): Seba reemplazó `recetario.ps1` el 29-10 pero no había vuelto a correr (última vuelta 10:56). Revisar: archivo bloqueado (Propiedades → Desbloquear), log `C:\BulforSync\recetario\logs\recetario.log`, ejecutar la tarea a mano. Verificar con `select count(*) from rec_rm where paciente_nombre is not null`.
- [ ] Revisar módulos que faltan del rediseño (Seba los va eligiendo uno a uno).
- [ ] Probar `buscar-factura` con una factura real recién emitida.
- [ ] Tabla `cobranza_gestiones` (la app la consulta y da 404): no creada; preguntar antes.
- [ ] Historial completo FedEx antiguo; limpieza de funciones viejas sin uso (`…Antiguo`, Precios de OC).
- [ ] Integración con el script de Google de Genoveva (pagos) — Etapa 4.
- [ ] Revisar si `sincronizar_gdexpress.py` es redundante con `sincronizar_facturas_recibidas.py` (ambos traen facturas recibidas).
- [ ] Dato raro: OT FedEx 882131599860 tiene entrega (19-06-2025) antes del envío (23-06-2025); Seba puede corregirlo con "Editar".

## 11. Cómo probar sin datos reales

El entorno de la IA normalmente no llega a Supabase desde el navegador. Se prueba
abriendo `index.html` con un servidor local (`python3 -m http.server 8765`) y
Playwright, ocultando el login y reemplazando `window.fetch` por datos de ejemplo
(ver cómo se hizo: se llenan arreglos globales como `fedex`, `chilexpress`,
`ordenesElaboracion`, `recBuscarData` y se llama al `…Init()`/`render…()` del módulo).
Revisar capturas a 1280 px de ancho (pantalla de notebook): nada debe quedar cortado
ni con scroll lateral.
