// ─── OPORTUNIDADES: licitaciones y compras ágiles abiertas ─────────────────
// (Pedido por Seba el 26-11-2026.) La sincronización `radar_oportunidades.py`
// revisa cada 2 horas Mercado Público (todo Chile, sin monto mínimo) y guarda
// en `mp_oportunidades` las que calzan con lo que vende Bulfor. Aquí se ven:
//  - Página Órdenes de compra › Oportunidades, con filtros y ficha.
//  - Campana roja arriba con las "Novedades": las abiertas que esta cuenta
//    todavía no ha visto. Cada cuenta marca lo suyo (`mp_oportunidades_vistas`).
// Prioridad (la calcula la sincronización): alta = dice magistral, recetario
// magistral, preparado farmacéutico, oficinal o papelillos; media = pide un
// producto de Bulfor; baja = solo una forma farmacéutica (oculta por defecto).
// Todo lo de este módulo empieza con "op".

let opDatos = null;            // filas de mp_oportunidades (sin productos)
let opVistas = {};             // codigo → { descartada }
// Participación del equipo (compartida, no por cuenta): codigo → { participamos,
// participante, actualizado_por, actualizado_en }. Tabla mp_oportunidades_gestion.
let opGestion = {};
const OP_PARTICIPANTES = ['Sebastián', 'Javiera', 'Christian', 'Genoveva'];
let opCargando = null;
const opFiltro = { vista: 'abiertas', tipo: '', q: '', soloClientes: false, conBaja: false };
// Orden de la lista: se cambia apretando el título de una columna (otra vez =
// al revés). Sin elegir, por fecha de cierre (las cerradas, la más reciente primero).
const opOrden = { campo: null, dir: 1 };
const OP_COLUMNAS = [
  ['cierre', 'Cierre'], ['tipo', 'Tipo'], ['organismo', 'Hospital / comprador'],
  ['nombre', 'Qué piden'], ['prioridad', 'Prioridad'], ['monto', 'Presupuesto'],
];
const OP_PRIO_ORDEN = { alta: 0, media: 1, baja: 2 };
function opValorOrden(r, campo) {
  if (campo === 'cierre') return r.fecha_cierre || '';
  if (campo === 'tipo') return OP_TIPO[r.tipo] || '';
  if (campo === 'prioridad') return OP_PRIO_ORDEN[r.prioridad] ?? 9;
  if (campo === 'monto') return Number(r.monto) || 0;
  return (r[campo] || '').toString().trim().toLowerCase();
}
function opOrdenarPor(campo) {
  if (opOrden.campo === campo) opOrden.dir = -opOrden.dir;
  else { opOrden.campo = campo; opOrden.dir = campo === 'monto' ? -1 : 1; } // presupuesto: mayor primero
  opRender();
}

const OP_TIPO = { licitacion: 'Licitación', compra_agil: 'Compra ágil' };
const OP_PRIO = {
  alta: '<span class="badge badge-red">Alta</span>',
  media: '<span class="badge badge-amber">Media</span>',
  baja: '<span class="badge badge-gray">Baja</span>',
};

// ─── Datos ─────────────────────────────────────────────────────────────────
function opCargar(forzar) {
  if (opCargando && !forzar) return opCargando;
  // Se traen las abiertas y las cerradas del último mes (las más viejas no sirven).
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString();
  opCargando = Promise.all([
    fetchAll('mp_oportunidades', 'select=codigo,tipo,nombre,organismo,unidad,region,estado,fecha_publicacion,fecha_cierre,monto,moneda,palabras,prioridad,es_cliente,total_ofertas,url,detectada_en'
      + `&prioridad=not.is.null&fecha_cierre=gte.${encodeURIComponent(hace30)}&order=fecha_cierre.asc`),
    fetchAll('mp_oportunidades_vistas', 'select=codigo,descartada'),
    // Si la tabla aún no existe, la página funciona igual sin participación
    fetchAll('mp_oportunidades_gestion', 'select=*').catch(() => []),
  ]).then(([filas, vistas, gestion]) => {
    opDatos = filas || [];
    opVistas = {};
    (vistas || []).forEach(v => { opVistas[v.codigo] = { descartada: !!v.descartada }; });
    opGestion = {};
    (gestion || []).forEach(g => { opGestion[g.codigo] = g; });
    opPintarAviso();
    return opDatos;
  }).catch(e => { opCargando = null; throw e; });
  return opCargando;
}

const opAbierta = r => r.fecha_cierre && new Date(r.fecha_cierre) > new Date();
// Novedad = abierta, prioridad alta o media, y esta cuenta no la ha visto.
const opEsNueva = r => opAbierta(r) && r.prioridad !== 'baja' && !opVistas[r.codigo];
const opNuevas = () => (opDatos || []).filter(opEsNueva)
  .sort((a, b) => (a.prioridad === b.prioridad ? 0 : a.prioridad === 'alta' ? -1 : 1) || String(a.fecha_cierre).localeCompare(String(b.fecha_cierre)));

// Marca como vistas (sin cambiar si estaba descartada). Si falla no pasa nada:
// la próxima vez vuelve a salir como novedad.
async function opMarcarVistas(codigos) {
  codigos = codigos.filter(c => !opVistas[c]);
  if (!codigos.length) return;
  codigos.forEach(c => { opVistas[c] = { descartada: false }; });
  opPintarAviso();
  try {
    await sb('mp_oportunidades_vistas', { method: 'POST', headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(codigos.map(codigo => ({ codigo }))) });
  } catch (e) { /* opcional */ }
}

async function opDescartar(codigo, descartar) {
  const res = await sb('mp_oportunidades_vistas', { method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ codigo, descartada: !!descartar }]) });
  if (!res.ok) { toast('No se pudo guardar. Intenta de nuevo.', 'err'); return; }
  opVistas[codigo] = { descartada: !!descartar };
  toast(descartar ? 'Oportunidad descartada' : 'Oportunidad recuperada');
  opPintarAviso();
  if (document.getElementById('page-oportunidades')?.classList.contains('active')) opRender();
  // Si la ficha está abierta, se vuelve a armar para que el botón cambie
  if (typeof panelPila !== 'undefined' && panelPila.length) {
    const top = panelPila[panelPila.length - 1];
    const r = (opDatos || []).find(x => x.codigo === codigo);
    if (top && top.opCodigo === codigo && r) { panelPila[panelPila.length - 1] = opFicha(r, top.opNav); panelPintar(); }
  }
}

// ─── Aviso rojo (campana de arriba, menú e Inicio) ──────────────────────────
function opPintarAviso() {
  const permitida = typeof paginaPermitida !== 'function' || paginaPermitida('oportunidades');
  const n = permitida && opDatos ? opNuevas().length : 0;
  const campana = document.getElementById('op-campana');
  if (campana) {
    campana.style.display = permitida ? 'inline-flex' : 'none';
    campana.title = n ? `${n} oportunidad${n === 1 ? '' : 'es'} nueva${n === 1 ? '' : 's'} en Mercado Público` : 'Novedades de Mercado Público';
    const b = document.getElementById('op-campana-n');
    if (b) { b.textContent = n > 99 ? '99+' : n; b.style.display = n ? 'inline-flex' : 'none'; }
  }
  if (typeof ponerAvisoSub === 'function') ponerAvisoSub('oportunidades', n, { title: `${n} oportunidades nuevas` });
  if (document.getElementById('page-inicio')?.classList.contains('active') && typeof renderInicio === 'function') renderInicio();
}

// Para "Requiere atención" de Inicio
function opResumenInicio() {
  if (!opDatos) return null;
  const nuevas = opNuevas();
  return { nuevas: nuevas.length, alta: nuevas.filter(r => r.prioridad === 'alta').length };
}

// Se llama al arrancar la app (después del login) y se refresca cada 30 min.
function opIniciarAviso() {
  if (typeof paginaPermitida === 'function' && !paginaPermitida('oportunidades')) { opPintarAviso(); return; }
  opCargar(true).catch(() => {});
  if (!window.__opIntervalo) window.__opIntervalo = setInterval(() => opCargar(true).then(() => {
    if (document.getElementById('page-oportunidades')?.classList.contains('active')) opRender();
  }).catch(() => {}), 30 * 60000);
}

// ─── Formato ───────────────────────────────────────────────────────────────
function opFecha(iso, conHora = true) {
  if (!iso) return '—';
  const d = new Date(iso);
  const o = { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' };
  if (conHora) Object.assign(o, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('es-CL', o).replace(',', '');
}

// "Cierra en 5 h" / "en 3 días" / "Cerrada", con color si queda poco.
function opCierreHtml(r) {
  if (!r.fecha_cierre) return '—';
  const horas = (new Date(r.fecha_cierre) - new Date()) / 3600000;
  let txt, cls = '';
  if (horas <= 0) { txt = 'Cerrada'; cls = 'op-cerrada'; }
  else if (horas < 1) { txt = 'menos de 1 h'; cls = 'op-urgente'; }
  else if (horas < 24) { txt = `en ${Math.floor(horas)} h`; cls = 'op-urgente'; }
  else if (horas < 48) { txt = 'en 1 día'; cls = 'op-urgente'; }
  else { txt = `en ${Math.floor(horas / 24)} días`; cls = horas < 96 ? 'op-pronto' : ''; }
  return `<span class="op-cierre ${cls}">${txt}</span><small>${opFecha(r.fecha_cierre)}</small>`;
}

const opMonto = r => r.monto ? clp(r.monto) + (r.moneda && r.moneda !== 'CLP' ? ' ' + escapeHtml(r.moneda) : '') : '—';

// ─── Página ────────────────────────────────────────────────────────────────
function opInit() {
  const cont = document.getElementById('op-contenido');
  if (!cont) return;
  if (!cont.dataset.armado) {
    cont.dataset.armado = '1';
    cont.innerHTML = `
      <div class="fpp-toolbar-top">
        <div class="fpp-status-tabs" id="op-vistas" role="group" aria-label="Qué oportunidades ver"></div>
        <div class="fpp-status-tabs" id="op-tipos" role="group" aria-label="Tipo"></div>
      </div>
      <div class="toolbar">
        <div class="search-wrap">
          <span class="search-icon"><i class="ti ti-search"></i></span>
          <input type="text" id="op-buscar" placeholder="Buscar hospital, producto, palabra o código…" oninput="opFiltro.q=this.value;opRender()">
        </div>
        <label class="op-check"><input type="checkbox" onchange="opFiltro.soloClientes=this.checked;opRender()"> Solo hospitales cliente</label>
        <label class="op-check" title="Las de prioridad baja solo coinciden en la forma farmacéutica (cápsulas, jarabe…)"><input type="checkbox" onchange="opFiltro.conBaja=this.checked;opRender()"> Incluir prioridad baja</label>
      </div>
      <div class="table-card">
        <div class="op-info" id="op-info"></div>
        <div>
          <table class="oc-tabla op-tabla">
            <thead><tr id="op-cabecera"></tr></thead>
            <tbody id="op-body"><tr><td colspan="7"><div class="fpp-empty"><p>Cargando oportunidades…</p></div></td></tr></tbody>
          </table>
        </div>
      </div>`;
  }
  opCargar().then(opRender).catch(() => {
    document.getElementById('op-body').innerHTML = '<tr><td colspan="7"><div class="fpp-empty"><p>No se pudieron cargar las oportunidades. Revisa la conexión y actualiza.</p></div></td></tr>';
  });
}

function opCambiarVista(v) { opFiltro.vista = v; opRender(); }
function opCambiarTipo(t) { opFiltro.tipo = t; opRender(); }

function opFiltradas() {
  const f = opFiltro;
  return (opDatos || []).filter(r => {
    const v = opVistas[r.codigo] || {};
    if (f.vista === 'descartadas') { if (!v.descartada) return false; }
    else if (f.vista === 'participamos') { if (!opGestion[r.codigo]?.participamos) return false; }
    else if (v.descartada) return false;
    if (f.vista === 'abiertas' && !opAbierta(r)) return false;
    if (f.vista === 'nuevas' && !opEsNueva(r)) return false;
    if (f.vista === 'cerradas' && opAbierta(r)) return false;
    if (!f.conBaja && r.prioridad === 'baja' && !['descartadas', 'participamos'].includes(f.vista)) return false;
    if (f.tipo && r.tipo !== f.tipo) return false;
    if (f.soloClientes && !r.es_cliente) return false;
    if (f.q && !coincideBusqueda(`${r.codigo} ${r.nombre} ${r.organismo} ${r.unidad} ${r.region} ${(r.palabras || []).join(' ')}`, f.q)) return false;
    return true;
  }).sort((a, b) => {
    const campo = opOrden.campo || 'cierre';
    const dir = opOrden.campo ? opOrden.dir : (f.vista === 'cerradas' ? -1 : 1);
    const va = opValorOrden(a, campo), vb = opValorOrden(b, campo);
    const c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
    // Empates: por fecha de cierre
    return (c * dir) || String(a.fecha_cierre).localeCompare(String(b.fecha_cierre));
  });
}

// Títulos de la tabla: botones que ordenan, con flecha en la columna activa.
function opPintarCabecera() {
  const tr = document.getElementById('op-cabecera');
  if (!tr) return;
  const activo = opOrden.campo || 'cierre';
  const dir = opOrden.campo ? opOrden.dir : (opFiltro.vista === 'cerradas' ? -1 : 1);
  tr.innerHTML = OP_COLUMNAS.map(([campo, label]) => {
    const on = campo === activo;
    const flecha = on ? (dir === 1 ? '▲' : '▼') : '↕';
    return `<th class="op-th${on ? ' op-th-activo' : ''}"${campo === 'monto' ? ' style="text-align:right"' : ''} aria-sort="${on ? (dir === 1 ? 'ascending' : 'descending') : 'none'}">
      <button type="button" onclick="opOrdenarPor('${campo}')" title="Ordenar por ${label.toLowerCase()}">${label} <span class="op-flecha">${flecha}</span></button></th>`;
  }).join('') + '<th></th>';
}

function opRender() {
  if (!opDatos) return;
  const nNuevas = opNuevas().length;
  const vistas = [['abiertas', 'Abiertas'], ['nuevas', `Nuevas${nNuevas ? ` (${nNuevas})` : ''}`], ['participamos', 'Participamos'], ['cerradas', 'Cerradas (último mes)'], ['descartadas', 'Descartadas']];
  document.getElementById('op-vistas').innerHTML = vistas.map(([v, l]) =>
    `<button type="button" class="fpp-status-tab${opFiltro.vista === v ? ' active' : ''}" aria-pressed="${opFiltro.vista === v}" onclick="opCambiarVista('${v}')">${l}</button>`).join('');
  const tipos = [['', 'Todas'], ['compra_agil', 'Compras ágiles'], ['licitacion', 'Licitaciones']];
  document.getElementById('op-tipos').innerHTML = tipos.map(([t, l]) =>
    `<button type="button" class="fpp-status-tab${opFiltro.tipo === t ? ' active' : ''}" aria-pressed="${opFiltro.tipo === t}" onclick="opCambiarTipo('${t}')">${l}</button>`).join('');

  opPintarCabecera();
  const filas = opFiltradas();
  window.__opLista = filas.map(r => r.codigo);
  document.getElementById('op-info').innerHTML = `${filas.length.toLocaleString('es-CL')} oportunidad${filas.length === 1 ? '' : 'es'}`
    + ' · <span class="op-nota">Se revisa Mercado Público cada 2 horas, en todo Chile. Para postular se entra a Mercado Público.</span>';
  const body = document.getElementById('op-body');
  if (!filas.length) {
    body.innerHTML = `<tr><td colspan="7"><div class="fpp-empty"><div class="fpp-empty-icon"><i class="ti ti-search"></i></div><p>${
      opFiltro.vista === 'nuevas' ? 'No hay oportunidades nuevas. Ya revisaste todo.' : 'No hay oportunidades con estos filtros.'}</p></div></td></tr>`;
    return;
  }
  body.innerHTML = filas.map(r => `
    <tr class="oc-fila${opEsNueva(r) ? ' op-nueva' : ''}" onclick="opAbrir('${escapeHtml(r.codigo)}')">
      <td data-label="Cierre" class="op-td-cierre"><div>${opCierreHtml(r)}</div></td>
      <td data-label="Tipo"><span class="badge ${r.tipo === 'licitacion' ? 'badge-blue' : 'badge-gray'}">${OP_TIPO[r.tipo] || r.tipo}</span></td>
      <td data-label="Hospital"><div>${escapeHtml(r.organismo || '—')}${r.es_cliente ? ' <span class="op-cliente" title="Ya le ha comprado a Bulfor">Cliente</span>' : ''}<small class="op-sub">${escapeHtml(r.region || '')}</small></div></td>
      <td data-label="Qué piden"><div>${opEsNueva(r) ? '<span class="op-punto" title="Nueva"></span>' : ''}${escapeHtml(r.nombre || '')}${(r.palabras || []).length ? `<small class="op-sub">${r.palabras.map(escapeHtml).join(' · ')}</small>` : ''}</div></td>
      <td data-label="Prioridad"><div>${OP_PRIO[r.prioridad] || ''}${opParticipacionBadge(r.codigo)}</div></td>
      <td data-label="Presupuesto" style="text-align:right;white-space:nowrap">${opMonto(r)}</td>
      <td class="op-td-acc">${(() => {
        // Descartar / recuperar desde la lista, sin abrir la ficha
        const desc = opVistas[r.codigo]?.descartada;
        return `<button type="button" class="op-btn-desc" title="${desc ? 'Volver a mostrar' : 'Descartar: no me interesa'}" onclick="event.stopPropagation();opDescartar('${escapeHtml(r.codigo)}', ${!desc})">${desc ? '<i class="ti ti-arrow-back-up"></i> Recuperar' : '<i class="ti ti-eye-off"></i> Descartar'}</button>`;
      })()}</td>
    </tr>`).join('');
}

// ─── Ficha de una oportunidad ───────────────────────────────────────────────
async function opAbrir(codigo, desde) {
  const r = (opDatos || []).find(x => x.codigo === codigo);
  if (!r) return;
  opMarcarVistas([codigo]);
  // Productos y descripción se piden aparte (son pesados para la lista)
  if (!r.__detalle) {
    try {
      const res = await sb(`mp_oportunidades?codigo=eq.${encodeURIComponent(codigo)}&select=descripcion,productos`, { headers: { 'Prefer': '' } });
      const d = res.ok ? (await res.json())[0] : null;
      r.__detalle = d || { descripcion: null, productos: [] };
    } catch (e) { r.__detalle = { descripcion: null, productos: [] }; }
  }
  const lista = window.__opLista || [];
  const i = lista.indexOf(codigo);
  panelAbrir(opFicha(r, i >= 0 ? { i, lista } : null), desde);
  if (document.getElementById('page-oportunidades')?.classList.contains('active')) opRender();
}

function opFicha(r, nav) {
  const det = r.__detalle || {};
  const productos = Array.isArray(det.productos) ? det.productos : [];
  const descartada = opVistas[r.codigo]?.descartada;
  const desc = det.descripcion && det.descripcion.trim() !== (r.nombre || '').trim() ? det.descripcion : '';
  return {
    opCodigo: r.codigo,
    antetitulo: OP_TIPO[r.tipo] || 'Oportunidad',
    titulo: r.nombre || r.codigo,
    // (panel.js escapa el subtítulo: va como texto simple)
    sub: `${r.codigo} · ${r.organismo || ''}${r.unidad ? ' · ' + r.unidad : ''}`,
    opNav: nav,
    tituloExtra: OP_PRIO[r.prioridad] || '',
    resumen: `<div class="hosp-cifras">
        <div><span>Cierre</span><b>${opCierreHtml(r)}</b></div>
        <div><span>Presupuesto</span><b>${opMonto(r)}</b></div>
        <div><span>Región</span><b>${escapeHtml(r.region || '—')}</b></div>
        <div><span>${r.tipo === 'compra_agil' ? 'Cotizaciones recibidas' : 'Publicada'}</span><b>${r.tipo === 'compra_agil' ? (r.total_ofertas ?? '—') : opFecha(r.fecha_publicacion, false)}</b></div>
      </div>`,
    cuerpo: `
      <div class="op-acciones">
        ${botonMP(r.url, r.tipo === 'compra_agil' ? 'Ver compra ágil en Mercado Público' : 'Ver licitación en Mercado Público')}
        <button type="button" class="btn-mp btn-mp-gris" onclick="opDescartar('${escapeHtml(r.codigo)}', ${!descartada})">${descartada ? '<i class="ti ti-arrow-back-up"></i> Recuperar' : '<i class="ti ti-eye-off"></i> Descartar (no me interesa)'}</button>
      </div>
      ${opParticipacionHtml(r.codigo)}
      ${r.es_cliente ? '<p class="op-nota-cliente"><i class="ti ti-building-hospital"></i> Este comprador ya le ha comprado a Bulfor.</p>' : ''}
      ${(r.palabras || []).length ? `<div class="panel-h">Por qué apareció</div><p>Coincide con: <b>${r.palabras.map(escapeHtml).join(', ')}</b></p>` : ''}
      ${desc ? `<div class="panel-h">Descripción</div><p class="op-desc">${escapeHtml(desc)}</p>` : ''}
      <div class="panel-h">Productos que piden (${productos.length})</div>
      ${productos.length ? `<table class="panel-tabla-cuadros"><thead><tr><th>Producto</th><th>Detalle</th><th style="text-align:right">Cantidad</th></tr></thead><tbody>
        ${productos.map(p => `<tr><td>${escapeHtml(p.nombre || '')}</td><td>${escapeHtml(p.descripcion || '')}</td><td style="text-align:right;white-space:nowrap">${p.cantidad != null ? Number(p.cantidad).toLocaleString('es-CL') : ''} ${escapeHtml(p.unidad || '')}</td></tr>`).join('')}
      </tbody></table>` : '<p style="color:var(--text-3)">Sin detalle de productos.</p>'}
      <p class="op-nota">Detectada por el radar: ${opFecha(r.detectada_en)} · Para cotizar u ofertar hay que entrar a Mercado Público.</p>`,
    navegacion: nav && nav.lista.length > 1 ? {
      texto: `${nav.i + 1} de ${nav.lista.length}`,
      anterior: nav.i > 0 ? () => opAbrir(nav.lista[nav.i - 1]) : null,
      siguiente: nav.i < nav.lista.length - 1 ? () => opAbrir(nav.lista[nav.i + 1]) : null,
    } : null,
  };
}

// ─── Ventana de Novedades (campana) ─────────────────────────────────────────
function opAbrirNovedades() {
  const pintar = () => {
    const nuevas = opNuevas();
    return {
      antetitulo: 'Novedades',
      titulo: 'Oportunidades nuevas en Mercado Público',
      sub: 'Licitaciones y compras ágiles abiertas que calzan con lo que vende Bulfor y que aún no has visto.',
      angosto: true,
      cuerpo: !opDatos ? '<p>Cargando…</p>' : `
        ${nuevas.length ? `<div class="op-nov-lista">${nuevas.slice(0, 50).map(r => `
          <button type="button" class="op-nov" onclick="opAbrir('${escapeHtml(r.codigo)}', true)">
            <span class="op-nov-top">${OP_PRIO[r.prioridad] || ''} <span class="badge ${r.tipo === 'licitacion' ? 'badge-blue' : 'badge-gray'}">${OP_TIPO[r.tipo]}</span> ${opCierreHtml(r)}</span>
            <b>${escapeHtml(r.nombre || '')}</b>
            <span class="op-sub">${escapeHtml(r.organismo || '')}${r.es_cliente ? ' · <span class="op-cliente">Cliente</span>' : ''} · ${opMonto(r)}</span>
          </button>`).join('')}</div>
          ${nuevas.length > 50 ? `<p class="op-nota">Y ${nuevas.length - 50} más.</p>` : ''}`
        : '<div class="fpp-empty"><div class="fpp-empty-icon">✅</div><p>No hay novedades. Ya revisaste todo.</p></div>'}
        <div class="op-acciones">
          <button type="button" class="btn-mp" onclick="panelCerrar();irAModuloPagina('oc-modulo','oportunidades')"><i class="ti ti-list"></i> Ver todas las oportunidades</button>
          ${nuevas.length ? `<button type="button" class="btn-mp btn-mp-gris" onclick="opMarcarTodasVistas()"><i class="ti ti-checks"></i> Marcar todas como vistas</button>` : ''}
        </div>`,
    };
  };
  panelAbrir(pintar());
  if (!opDatos) opCargar().then(() => { panelCerrar(); opAbrirNovedades(); }).catch(() => {});
}

function opMarcarTodasVistas() {
  opMarcarVistas(opNuevas().map(r => r.codigo));
  panelCerrar();
  opAbrirNovedades();
  if (document.getElementById('page-oportunidades')?.classList.contains('active')) opRender();
}

// ─── Participación del equipo (¿participamos? ¿quién?) ──────────────────────
// Es un dato compartido: lo ve todo el equipo, lo marque quien lo marque. El
// nombre se elige de la lista (no depende de la cuenta que lo anota).
function opParticipacionBadge(codigo) {
  const g = opGestion[codigo];
  if (!g) return '';
  return g.participamos
    ? `<span class="op-part op-part-si" title="Participamos">✓ ${escapeHtml(g.participante || 'Participamos')}</span>`
    : '<span class="op-part op-part-no">No participamos</span>';
}

function opParticipacionHtml(codigo) {
  const g = opGestion[codigo] || {};
  const c = escapeHtml(codigo);
  const si = g.participamos === true, no = g.participamos === false;
  return `<div class="op-part-caja">
    <div class="panel-h" style="margin-top:0">¿Participamos?</div>
    <div class="fpp-status-tabs" role="group" aria-label="¿Participamos?">
      <button type="button" class="fpp-status-tab${si ? ' active' : ''}" aria-pressed="${si}" onclick="opElegirParticipacion('${c}', true)">Sí, participamos</button>
      <button type="button" class="fpp-status-tab${no ? ' active' : ''}" aria-pressed="${no}" onclick="opElegirParticipacion('${c}', false)">No participamos</button>
      ${si || no ? `<button type="button" class="fpp-status-tab" onclick="opElegirParticipacion('${c}', null)" title="Borrar la respuesta">Sin responder</button>` : ''}
    </div>
    ${si || window.__opPartPendiente === codigo ? `<label class="op-part-quien">¿Quién participó?
      <select onchange="opGuardarParticipacion('${c}', true, this.value)">
        <option value="">Elegir…</option>
        ${OP_PARTICIPANTES.map(n => `<option${g.participante === n ? ' selected' : ''}>${n}</option>`).join('')}
      </select></label>` : ''}
    ${g.actualizado_en ? `<div class="op-nota">Anotado por ${escapeHtml(g.actualizado_por || '—')} el ${opFecha(g.actualizado_en)}</div>` : ''}
  </div>`;
}

// "Sí" primero pide el nombre (no se guarda hasta elegirlo); "No" y "Sin
// responder" se guardan al tiro.
function opElegirParticipacion(codigo, valor) {
  if (valor === true && !opGestion[codigo]?.participamos) {
    window.__opPartPendiente = codigo;
    opRepintarFicha(codigo);
    return;
  }
  window.__opPartPendiente = null;
  if (valor === true) return;
  opGuardarParticipacion(codigo, valor, null);
}

async function opGuardarParticipacion(codigo, participamos, participante) {
  if (participamos === true && !participante) return;
  let res;
  if (participamos === null) {
    res = await sb(`mp_oportunidades_gestion?codigo=eq.${encodeURIComponent(codigo)}`, { method: 'DELETE' });
  } else {
    res = await sb('mp_oportunidades_gestion', { method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([{ codigo, participamos, participante: participamos ? participante : null,
        actualizado_por: sesionActual?.email || null, actualizado_en: new Date().toISOString() }]) });
  }
  if (!res.ok) { toast('No se pudo guardar la participación. Intenta de nuevo.', 'err'); return; }
  if (participamos === null) delete opGestion[codigo];
  else opGestion[codigo] = (await res.json())[0] || { codigo, participamos, participante };
  window.__opPartPendiente = null;
  toast(participamos === null ? 'Respuesta borrada' : participamos ? `Guardado: participó ${participante}` : 'Guardado: no participamos');
  opRepintarFicha(codigo);
  if (document.getElementById('page-oportunidades')?.classList.contains('active')) opRender();
}

function opRepintarFicha(codigo) {
  if (typeof panelPila === 'undefined' || !panelPila.length) return;
  const top = panelPila[panelPila.length - 1];
  const r = (opDatos || []).find(x => x.codigo === codigo);
  if (top && top.opCodigo === codigo && r) { panelPila[panelPila.length - 1] = opFicha(r, top.opNav); panelPintar(); }
}
