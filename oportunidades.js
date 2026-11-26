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
let opCargando = null;
const opFiltro = { vista: 'abiertas', tipo: '', q: '', soloClientes: false, conBaja: false };

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
  ]).then(([filas, vistas]) => {
    opDatos = filas || [];
    opVistas = {};
    (vistas || []).forEach(v => { opVistas[v.codigo] = { descartada: !!v.descartada }; });
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
          <span class="search-icon">🔍</span>
          <input type="text" id="op-buscar" placeholder="Buscar hospital, producto, palabra o código…" oninput="opFiltro.q=this.value;opRender()">
        </div>
        <label class="op-check"><input type="checkbox" onchange="opFiltro.soloClientes=this.checked;opRender()"> Solo hospitales cliente</label>
        <label class="op-check" title="Las de prioridad baja solo coinciden en la forma farmacéutica (cápsulas, jarabe…)"><input type="checkbox" onchange="opFiltro.conBaja=this.checked;opRender()"> Incluir prioridad baja</label>
      </div>
      <div class="table-card">
        <div class="op-info" id="op-info"></div>
        <div>
          <table class="oc-tabla op-tabla">
            <thead><tr><th>Cierre</th><th>Tipo</th><th>Hospital / comprador</th><th>Qué piden</th><th>Prioridad</th><th style="text-align:right">Presupuesto</th><th></th></tr></thead>
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
    else if (v.descartada) return false;
    if (f.vista === 'abiertas' && !opAbierta(r)) return false;
    if (f.vista === 'nuevas' && !opEsNueva(r)) return false;
    if (f.vista === 'cerradas' && opAbierta(r)) return false;
    if (!f.conBaja && r.prioridad === 'baja' && f.vista !== 'descartadas') return false;
    if (f.tipo && r.tipo !== f.tipo) return false;
    if (f.soloClientes && !r.es_cliente) return false;
    if (f.q && !coincideBusqueda(`${r.codigo} ${r.nombre} ${r.organismo} ${r.unidad} ${r.region} ${(r.palabras || []).join(' ')}`, f.q)) return false;
    return true;
  }).sort((a, b) => f.vista === 'cerradas'
    ? String(b.fecha_cierre).localeCompare(String(a.fecha_cierre))
    : String(a.fecha_cierre).localeCompare(String(b.fecha_cierre)));
}

function opRender() {
  if (!opDatos) return;
  const nNuevas = opNuevas().length;
  const vistas = [['abiertas', 'Abiertas'], ['nuevas', `Nuevas${nNuevas ? ` (${nNuevas})` : ''}`], ['cerradas', 'Cerradas (último mes)'], ['descartadas', 'Descartadas']];
  document.getElementById('op-vistas').innerHTML = vistas.map(([v, l]) =>
    `<button type="button" class="fpp-status-tab${opFiltro.vista === v ? ' active' : ''}" aria-pressed="${opFiltro.vista === v}" onclick="opCambiarVista('${v}')">${l}</button>`).join('');
  const tipos = [['', 'Todas'], ['compra_agil', 'Compras ágiles'], ['licitacion', 'Licitaciones']];
  document.getElementById('op-tipos').innerHTML = tipos.map(([t, l]) =>
    `<button type="button" class="fpp-status-tab${opFiltro.tipo === t ? ' active' : ''}" aria-pressed="${opFiltro.tipo === t}" onclick="opCambiarTipo('${t}')">${l}</button>`).join('');

  const filas = opFiltradas();
  window.__opLista = filas.map(r => r.codigo);
  document.getElementById('op-info').innerHTML = `${filas.length.toLocaleString('es-CL')} oportunidad${filas.length === 1 ? '' : 'es'}`
    + ' · <span class="op-nota">Se revisa Mercado Público cada 2 horas, en todo Chile. Para postular se entra a Mercado Público.</span>';
  const body = document.getElementById('op-body');
  if (!filas.length) {
    body.innerHTML = `<tr><td colspan="7"><div class="fpp-empty"><div class="fpp-empty-icon">🔍</div><p>${
      opFiltro.vista === 'nuevas' ? 'No hay oportunidades nuevas. Ya revisaste todo.' : 'No hay oportunidades con estos filtros.'}</p></div></td></tr>`;
    return;
  }
  body.innerHTML = filas.map(r => `
    <tr class="oc-fila${opEsNueva(r) ? ' op-nueva' : ''}" onclick="opAbrir('${escapeHtml(r.codigo)}')">
      <td data-label="Cierre" class="op-td-cierre"><div>${opCierreHtml(r)}</div></td>
      <td data-label="Tipo"><span class="badge ${r.tipo === 'licitacion' ? 'badge-blue' : 'badge-gray'}">${OP_TIPO[r.tipo] || r.tipo}</span></td>
      <td data-label="Hospital"><div>${escapeHtml(r.organismo || '—')}${r.es_cliente ? ' <span class="op-cliente" title="Ya le ha comprado a Bulfor">Cliente</span>' : ''}<small class="op-sub">${escapeHtml(r.region || '')}</small></div></td>
      <td data-label="Qué piden"><div>${opEsNueva(r) ? '<span class="op-punto" title="Nueva"></span>' : ''}${escapeHtml(r.nombre || '')}${(r.palabras || []).length ? `<small class="op-sub">${r.palabras.map(escapeHtml).join(' · ')}</small>` : ''}</div></td>
      <td data-label="Prioridad">${OP_PRIO[r.prioridad] || ''}</td>
      <td data-label="Presupuesto" style="text-align:right;white-space:nowrap">${opMonto(r)}</td>
      <td><i class="ti ti-chevron-right" aria-hidden="true"></i></td>
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
