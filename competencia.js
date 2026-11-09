// ─── Competencia en licitaciones ────────────────────────────────────────────
// Órdenes de compra › Competencia en licitaciones.
// Muestra SOLO los productos donde ofertó Bulfor en licitaciones de Mercado
// Público, con lo que ofertó la competencia en esos mismos productos.
// Datos: lic_lineas (un producto), lic_ofertas (cada empresa que ofertó) y
// lic_competidores (lista editable de competidores a seguir). Los carga cada
// lunes la sincronización competencia_licitaciones.py (Datos Abiertos de
// ChileCompra), que se actualiza con un mes o más de desfase.
// Aislado del resto de los menús: todo lo de aquí empieza con "cmp".

const CMP_RUT_BULFOR = '76.186.755-5';
const cmpState = {
  cargado: false, cargando: false,
  lineas: [], ofertas: [], competidores: [],
  porLinea: new Map(),        // clave_linea -> [ofertas]
  vista: 'resumen',           // resumen | ofertas | competidores
  q: '', resultado: 'todas', anio: 'todos', competidor: 'todos', pagina: 1,
  demo: new URLSearchParams(location.search).get('competencia_demo') === '1',
};
const CMP_POR_PAGINA = 15;

const cmpEsc = v => escapeHtml(v == null ? '' : String(v));
const cmpPeso = n => (n == null || isNaN(n)) ? '—' : '$\u00a0' + Number(n).toLocaleString('es-CL', { maximumFractionDigits: 2 });
const cmpFecha = s => { const a = String(s || '').slice(0, 10).split('-'); return a.length === 3 ? `${a[2]}-${a[1]}-${a[0]}` : '—'; };
const cmpPct = n => (n == null || !isFinite(n)) ? '—' : (n > 0 ? '+' : '') + n.toLocaleString('es-CL', { maximumFractionDigits: 1 }) + '%';
const cmpEditor = () => typeof sesionActual !== 'undefined' && sesionActual && sesionActual.rol === 'editor';
const cmpActivos = () => cmpState.competidores.filter(c => c.activo);
const cmpNombre = rut => (cmpState.competidores.find(c => c.rut === rut) || {}).nombre;

// Mediana (no se deja llevar por los casos de unidades distintas:
// un competidor que oferta por comprimido y otro por frasco).
function cmpMediana(arr) {
  const v = arr.filter(x => isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

async function cmpInit() {
  if (cmpState.cargado) { cmpRender(); return; }
  if (cmpState.cargando) return;
  cmpState.cargando = true;
  document.getElementById('cmp-contenido').innerHTML = '<div class="cmp-vacio">Cargando licitaciones…</div>';
  try {
    if (cmpState.demo && window.CMP_DEMO) {
      Object.assign(cmpState, JSON.parse(JSON.stringify(window.CMP_DEMO)));
    } else {
      const [lineas, ofertas, comp] = await Promise.all([
        fetchAll('lic_lineas', 'select=*&order=fecha_publicacion.desc'),
        fetchAll('lic_ofertas', 'select=clave_linea,rut_proveedor,proveedor,nombre_fantasia,precio_unitario,cantidad_ofertada,estado_oferta,seleccionada'),
        fetchAll('lic_competidores', 'select=*&order=nombre'),
      ]);
      cmpState.lineas = lineas; cmpState.ofertas = ofertas; cmpState.competidores = comp;
    }
    cmpIndexar();
    cmpState.cargado = true;
  } catch (e) {
    console.error(e);
    document.getElementById('cmp-contenido').innerHTML = '<div class="cmp-vacio">No se pudieron cargar los datos. Recarga la página.</div>';
    return;
  } finally {
    cmpState.cargando = false;
  }
  cmpRender();
}

// Agrupa las ofertas por producto y calcula, para cada producto, el precio de
// Bulfor, quién ganó y el resultado de Bulfor.
function cmpIndexar() {
  cmpState.porLinea = new Map();
  cmpState.ofertas.forEach(o => {
    if (!cmpState.porLinea.has(o.clave_linea)) cmpState.porLinea.set(o.clave_linea, []);
    cmpState.porLinea.get(o.clave_linea).push(o);
  });
  cmpState.lineas.forEach(l => {
    const ofs = cmpState.porLinea.get(l.clave) || [];
    const b = ofs.find(o => o.rut_proveedor === CMP_RUT_BULFOR);
    const ganadoras = ofs.filter(o => o.seleccionada).sort((a, b2) => (a.precio_unitario ?? 1e18) - (b2.precio_unitario ?? 1e18));
    l._bulfor = b ? Number(b.precio_unitario) : null;
    l._bulforRechazada = b && b.estado_oferta === 'Rechazada';
    l._ganadoras = ganadoras;
    l._resultado = ganadoras.some(o => o.rut_proveedor === CMP_RUT_BULFOR) ? 'gano' : (ganadoras.length ? 'perdio' : 'sin');
    l._precioGanador = ganadoras.length ? Number(ganadoras[0].precio_unitario) : null;
    l._nOfertas = ofs.length;
    l._texto = [l.licitacion, l.descripcion, l.producto_generico, l.organismo, l.unidad_compradora,
      ...ofs.map(o => o.proveedor + ' ' + (o.nombre_fantasia || ''))].join(' ');
  });
}

function cmpPrecioDe(clave, rut) {
  const o = (cmpState.porLinea.get(clave) || []).find(x => x.rut_proveedor === rut && x.estado_oferta !== 'Rechazada');
  return o ? Number(o.precio_unitario) : null;
}

function cmpNombreGanador(l) {
  if (!l._ganadoras.length) return '';
  return l._ganadoras.map(o => o.rut_proveedor === CMP_RUT_BULFOR ? 'Bulfor' : (cmpNombre(o.rut_proveedor) || o.nombre_fantasia || o.proveedor)).join(' / ');
}

function cmpRender() {
  const cont = document.getElementById('cmp-contenido');
  if (!cont) return;
  const tabs = [['resumen', 'Resumen'], ['ofertas', 'Nuestras ofertas'], ['competidores', 'Competidores']];
  const ultima = cmpState.lineas.reduce((m, l) => (l.fecha_publicacion || '') > m ? l.fecha_publicacion : m, '');
  let html = `<div class="cmp-cab">
      <div class="fpp-status-tabs" id="cmp-tabs">${tabs.map(([k, t]) =>
        `<button class="fpp-status-tab${cmpState.vista === k ? ' active' : ''}" onclick="cmpVista('${k}')">${t}</button>`).join('')}</div>
      <div class="cmp-nota">Datos Abiertos de ChileCompra · última licitación cargada: ${cmpFecha(ultima)}</div>
    </div>`;
  if (!cmpState.lineas.length) html += '<div class="cmp-vacio">Aún no hay licitaciones cargadas.</div>';
  else if (cmpState.vista === 'resumen') html += cmpHtmlResumen();
  else if (cmpState.vista === 'ofertas') html += cmpHtmlOfertas();
  else html += cmpHtmlCompetidores();
  cont.innerHTML = html;
  cmpEtiquetar(cont);
}

// En celular las tablas se ven como tarjetas y cada dato usa su data-label
// como etiqueta: se copia el título de la columna a cada celda.
function cmpEtiquetar(raiz) {
  raiz.querySelectorAll('table').forEach(t => {
    const titulos = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
    t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => {
      if (!td.dataset.label && titulos[i]) td.dataset.label = titulos[i];
    }));
  });
}

function cmpVista(v) { cmpState.vista = v; cmpState.pagina = 1; cmpRender(); }

// ─── Resumen ────────────────────────────────────────────────────────────────
function cmpEstadisticas(rut) {
  // Productos donde ofertaron Bulfor y esta empresa (oferta aceptada).
  const comunes = cmpState.lineas.filter(l => cmpPrecioDe(l.clave, rut) != null);
  const adj = comunes.filter(l => l._resultado !== 'sin');
  const ganados = comunes.filter(l => l._ganadoras.some(o => o.rut_proveedor === rut)).length;
  const conPrecio = comunes.filter(l => l._bulfor > 0);
  const difs = conPrecio.map(l => (cmpPrecioDe(l.clave, rut) / l._bulfor - 1) * 100);
  return {
    licitaciones: new Set(comunes.map(l => l.licitacion)).size,
    productos: comunes.length,
    ganados, pctGanados: adj.length ? 100 * ganados / adj.length : null,
    bulforGano: comunes.filter(l => l._resultado === 'gano').length,
    masBarato: conPrecio.filter(l => cmpPrecioDe(l.clave, rut) < l._bulfor).length,
    masCaro: conPrecio.filter(l => cmpPrecioDe(l.clave, rut) > l._bulfor).length,
    mediana: cmpMediana(difs),
    ultima: comunes.reduce((m, l) => (l.fecha_publicacion || '') > m ? l.fecha_publicacion : m, ''),
  };
}

function cmpHtmlResumen() {
  const L = cmpState.lineas;
  const gano = L.filter(l => l._resultado === 'gano').length;
  const perdio = L.filter(l => l._resultado === 'perdio').length;
  const sin = L.length - gano - perdio;
  const lic = new Set(L.map(l => l.licitacion)).size;
  const filas = cmpActivos().map(c => ({ c, e: cmpEstadisticas(c.rut) }))
    .sort((a, b) => b.e.productos - a.e.productos);
  const dif = m => m == null ? '—' : `<span class="${m < 0 ? 'cmp-rojo' : m > 0 ? 'cmp-verde' : ''}">${m < 0 ? cmpPct(m).replace('-', '') + ' más barato' : m > 0 ? cmpPct(m).replace('+', '') + ' más caro' : 'igual'}</span>`;
  return `
    <div class="stats cmp-kpis">
      <div class="stat"><div class="stat-label">Productos ofertados</div><div class="stat-val">${L.length.toLocaleString('es-CL')}</div><div class="cmp-sub">en ${lic} licitaciones</div></div>
      <div class="stat"><div class="stat-label">Ganados</div><div class="stat-val cmp-verde">${gano}</div><div class="cmp-sub">${gano + perdio ? Math.round(100 * gano / (gano + perdio)) + '% de los adjudicados' : ''}</div></div>
      <div class="stat"><div class="stat-label">Perdidos</div><div class="stat-val">${perdio}</div></div>
      <div class="stat"><div class="stat-label">Sin adjudicar</div><div class="stat-val">${sin}</div><div class="cmp-sub">abiertas, en evaluación o desiertas</div></div>
    </div>
    <div class="table-card tabla-centrada cmp-tabla">
      <table>
        <thead><tr><th>Competidor</th><th>Productos en común</th><th>Ganó</th><th>Bulfor le ganó</th><th>Más barato / más caro</th><th>Precio vs Bulfor</th><th>Última vez</th></tr></thead>
        <tbody>${filas.map(({ c, e }) => `
          <tr class="cmp-click" onclick="cmpVerCompetidor('${cmpEsc(c.rut)}')" title="Ver los productos donde coincidimos">
            <td class="cmp-izq"><strong>${cmpEsc(c.nombre)}</strong></td>
            <td>${e.productos}<div class="cmp-gris">en ${e.licitaciones} licitaciones</div></td>
            <td>${e.ganados}${e.pctGanados != null ? ` <span class="cmp-gris">(${Math.round(e.pctGanados)}%)</span>` : ''}</td>
            <td>${e.bulforGano}</td><td>${e.masBarato} / ${e.masCaro}</td>
            <td>${dif(e.mediana)}</td><td>${cmpFecha(e.ultima)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p class="cmp-ayuda">Se cuentan solo los productos donde ofertó Bulfor. Ganar no siempre es ser el más barato: se adjudica por puntaje (precio, plazo, experiencia…).
      La diferencia de precio usa la mediana porque algunos ofertan por comprimido y otros por frasco.</p>`;
}

function cmpVerCompetidor(rut) {
  cmpState.vista = 'ofertas'; cmpState.competidor = rut; cmpState.pagina = 1; cmpRender();
}

// ─── Nuestras ofertas ───────────────────────────────────────────────────────
function cmpFiltradas() {
  const q = cmpState.q.trim();
  return cmpState.lineas.filter(l =>
    (cmpState.resultado === 'todas' || l._resultado === cmpState.resultado) &&
    (cmpState.anio === 'todos' || String(l.fecha_publicacion || '').startsWith(cmpState.anio)) &&
    (cmpState.competidor === 'todos' || cmpPrecioDe(l.clave, cmpState.competidor) != null) &&
    (!q || coincideBusqueda(l._texto, q)));
}

function cmpHtmlOfertas() {
  const lista = cmpFiltradas();
  const paginas = Math.max(1, Math.ceil(lista.length / CMP_POR_PAGINA));
  cmpState.pagina = Math.min(cmpState.pagina, paginas);
  const desde = (cmpState.pagina - 1) * CMP_POR_PAGINA;
  const anios = [...new Set(cmpState.lineas.map(l => String(l.fecha_publicacion || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  const res = { todas: 'Todas', gano: 'Ganadas', perdio: 'Perdidas', sin: 'Sin adjudicar' };
  const badge = l => l._resultado === 'gano' ? '<span class="cmp-badge cmp-b-gano">Ganó</span>'
    : l._resultado === 'perdio' ? '<span class="cmp-badge cmp-b-perdio">Perdió</span>' : '<span class="cmp-badge">Sin adjudicar</span>';
  // Mejor precio de la competencia (cualquier empresa distinta de Bulfor).
  const mejorOtro = l => {
    const o = (cmpState.porLinea.get(l.clave) || []).filter(x => x.rut_proveedor !== CMP_RUT_BULFOR && x.estado_oferta !== 'Rechazada' && x.precio_unitario != null)
      .sort((a, b) => a.precio_unitario - b.precio_unitario)[0];
    return o ? { p: Number(o.precio_unitario), n: cmpNombre(o.rut_proveedor) || o.nombre_fantasia || o.proveedor } : null;
  };
  const filas = lista.slice(desde, desde + CMP_POR_PAGINA).map(l => {
    const m = mejorOtro(l);
    const dif = l._bulfor && l._precioGanador ? (l._bulfor / l._precioGanador - 1) * 100 : null;
    return `<tr class="cmp-click" onclick="cmpAbrirFicha('${cmpEsc(l.clave)}')">
      <td>${cmpFecha(l.fecha_publicacion)}</td>
      <td class="cmp-izq cmp-prod"><div>${cmpEsc(l.descripcion || l.producto_generico)}</div><div class="cmp-gris">${cmpEsc(l.organismo)} · ${cmpEsc(l.licitacion)}</div></td>
      <td>${cmpEsc(l.unidad_medida || '')}</td>
      <td><strong>${cmpPeso(l._bulfor)}</strong>${l._bulforRechazada ? '<div class="cmp-gris">rechazada</div>' : ''}</td>
      <td>${m ? `${cmpPeso(m.p)}<div class="cmp-gris">${cmpEsc(m.n)}</div>` : '—'}</td>
      <td>${l._ganadoras.length ? `${cmpPeso(l._precioGanador)}<div class="cmp-gris">${cmpEsc(cmpNombreGanador(l))}</div>` : '—'}</td>
      <td>${badge(l)}${dif != null && l._resultado === 'perdio' ? `<div class="cmp-gris">${cmpPct(dif)} vs ganador</div>` : ''}</td>
    </tr>`;
  }).join('');
  return `
    <div class="toolbar cmp-toolbar">
      <div class="search-wrap"><span class="search-icon">🔍</span>
        <input type="text" id="cmp-q" placeholder="Buscar producto, hospital, licitación o empresa…" value="${cmpEsc(cmpState.q)}" oninput="cmpBuscar(this.value)">
      </div>
      <select onchange="cmpFiltro('resultado',this.value)" aria-label="Resultado">${Object.entries(res).map(([k, t]) => `<option value="${k}"${cmpState.resultado === k ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <select onchange="cmpFiltro('anio',this.value)" aria-label="Año"><option value="todos">Todos los años</option>${anios.map(a => `<option${cmpState.anio === a ? ' selected' : ''}>${a}</option>`).join('')}</select>
      <select onchange="cmpFiltro('competidor',this.value)" aria-label="Competidor"><option value="todos">Con cualquier competidor</option>${cmpActivos().map(c => `<option value="${cmpEsc(c.rut)}"${cmpState.competidor === c.rut ? ' selected' : ''}>Donde ofertó ${cmpEsc(c.nombre)}</option>`).join('')}</select>
      <button class="page-btn" onclick="cmpExcel()" title="Descargar lo filtrado a Excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>
    </div>
    <div class="cmp-info">${lista.length.toLocaleString('es-CL')} productos</div>
    <div class="table-card tabla-centrada cmp-tabla">
      <table>
        <thead><tr><th>Fecha</th><th>Producto</th><th>Unidad</th><th>Bulfor</th><th>Mejor precio competencia</th><th>Ganador</th><th>Resultado</th></tr></thead>
        <tbody>${filas || '<tr><td colspan="7" class="cmp-vacio">Sin resultados.</td></tr>'}</tbody>
      </table>
    </div>
    ${paginas > 1 ? `<div class="cmp-paginas">
      <button class="page-btn" ${cmpState.pagina <= 1 ? 'disabled' : ''} onclick="cmpPagina(-1)">‹ Anterior</button>
      <span>Página ${cmpState.pagina} de ${paginas}</span>
      <button class="page-btn" ${cmpState.pagina >= paginas ? 'disabled' : ''} onclick="cmpPagina(1)">Siguiente ›</button></div>` : ''}`;
}

let cmpTimerBuscar = null;
function cmpBuscar(v) {
  cmpState.q = v; cmpState.pagina = 1;
  clearTimeout(cmpTimerBuscar);
  cmpTimerBuscar = setTimeout(() => {
    cmpRender();
    const inp = document.getElementById('cmp-q');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }, 250);
}
function cmpFiltro(k, v) { cmpState[k] = v; cmpState.pagina = 1; cmpRender(); }
function cmpPagina(d) { cmpState.pagina += d; cmpRender(); document.getElementById('cmp-contenido')?.scrollIntoView({ block: 'start' }); }

// Palabras que identifican el producto en la descripción del comprador: se
// quitan códigos, números, unidades y formas farmacéuticas (cada hospital las
// escribe distinto). "914-4034 CAPTOPRIL 5MG/ML X 30ML" → ["CAPTOPRIL"].
const CMP_RUIDO = new Set(('SKU DE DEL LA LAS LOS EL EN CON SIN POR PARA Y O X ML MG GR GRS GRAMO GRAMOS KG KILO LT LITRO UI MCG ' +
  'FCO FRASCO FRASCOS FC FRAS POMO TARRO SOBRE SOBRES CAJA UNIDAD UNIDADES ENVASE ENVASADO AMBAR TAPA JERINGA SELLO ' +
  'JARABE SOLUCION SOLUCIÓN ORAL SUSPENSION SUSPENSIÓN CAPSULA CAPSULAS CÁPSULA CÁPSULAS CP CPS COMPRIMIDO COMPRIMIDOS ' +
  'CREMA TOPICA TÓPICA GEL POLVO POLV PASTA UNGUENTO UNGÜENTO LOCION LOCIÓN GOTAS SIMPLE OFICINAL USP SABORIZADO ' +
  'MAGISTRAL MAGISTRALES PREPARADO FORMULA FÓRMULA JBE SOL SUSP').split(' '));
function cmpPalabrasClave(texto, max = 2) {
  const palabras = String(texto || '').toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ0-9]+/g, ' ').split(' ')
    .filter(w => w.length >= 3 && !/\d/.test(w) && !CMP_RUIDO.has(w));
  return [...new Set(palabras)].slice(0, max).map(w => w.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

// ─── Ficha de un producto ───────────────────────────────────────────────────
// Todas las ofertas de ese producto (de menor a mayor precio) y el historial:
// otras veces que Bulfor ofertó el mismo producto genérico (código ONU).
function cmpAbrirFicha(clave) {
  const l = cmpState.lineas.find(x => x.clave === clave);
  if (!l) return;
  const ofs = (cmpState.porLinea.get(clave) || []).slice()
    .sort((a, b) => (a.estado_oferta === 'Rechazada') - (b.estado_oferta === 'Rechazada') || (a.precio_unitario ?? 1e18) - (b.precio_unitario ?? 1e18));
  const filasOf = ofs.map(o => {
    const esB = o.rut_proveedor === CMP_RUT_BULFOR;
    const dif = !esB && l._bulfor && o.precio_unitario != null ? (o.precio_unitario / l._bulfor - 1) * 100 : null;
    const nombre = esB ? 'Bulfor' : (cmpNombre(o.rut_proveedor) || o.nombre_fantasia || o.proveedor);
    return `<tr class="${esB ? 'cmp-fila-bulfor' : ''}">
      <td class="cmp-izq">${cmpEsc(nombre)}${!esB && !cmpNombre(o.rut_proveedor) ? `<div class="cmp-gris">${cmpEsc(o.proveedor)}</div>` : ''}</td>
      <td>${cmpPeso(o.precio_unitario)}</td><td>${dif == null ? '' : cmpPct(dif)}</td>
      <td>${o.estado_oferta === 'Rechazada' ? '<span class="cmp-gris">Rechazada</span>' : 'Aceptada'}</td>
      <td>${o.seleccionada ? '<span class="cmp-badge cmp-b-gano">Ganó</span>' : ''}</td></tr>`;
  }).join('');
  const clave2 = cmpPalabrasClave(l.descripcion || l.producto_generico);
  const hist = clave2.length ? cmpState.lineas.filter(x => x.clave !== clave &&
      clave2.every(w => cmpPalabrasClave(x.descripcion || x.producto_generico, 99).includes(w)))
    .sort((a, b) => String(b.fecha_publicacion).localeCompare(String(a.fecha_publicacion))).slice(0, 15) : [];
  const filasHist = hist.map(x => `<tr class="cmp-click" onclick="cmpAbrirFicha('${cmpEsc(x.clave)}')">
      <td>${cmpFecha(x.fecha_publicacion)}</td><td class="cmp-izq">${cmpEsc(x.descripcion || x.producto_generico)}<div class="cmp-gris">${cmpEsc(x.organismo)}</div></td>
      <td>${cmpEsc(x.unidad_medida || '')}</td><td>${cmpPeso(x._bulfor)}</td>
      <td>${x._ganadoras.length ? `${cmpPeso(x._precioGanador)}<div class="cmp-gris">${cmpEsc(cmpNombreGanador(x))}</div>` : '—'}</td></tr>`).join('');
  document.getElementById('cmp-ficha')?.remove();
  const modal = document.createElement('div');
  modal.id = 'cmp-ficha';
  modal.className = 'modal-overlay';
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div class="modal-shell modal-xl cmp-modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div>
          <div class="cmp-eyebrow">${cmpEsc(l.licitacion)} · ${cmpFecha(l.fecha_publicacion)} · ${cmpEsc(l.estado || '')}</div>
          <div class="cmp-titulo">${cmpEsc(l.descripcion || l.producto_generico)}</div>
          <div class="cmp-gris">${cmpEsc(l.organismo)}${l.unidad_compradora ? ' · ' + cmpEsc(l.unidad_compradora) : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          ${l.link ? `<a class="page-btn" href="${cmpEsc(l.link)}" target="_blank" rel="noopener">Ver en Mercado Público</a>` : ''}
          <button class="modal-close" aria-label="Cerrar" onclick="document.getElementById('cmp-ficha').remove()">✕</button>
        </div>
      </div>
      <div class="modal-body">
        <div class="cmp-franja">
          <div><span>Cantidad pedida</span><strong>${l.cantidad != null ? Number(l.cantidad).toLocaleString('es-CL') : '—'} ${cmpEsc(l.unidad_medida || '')}</strong></div>
          <div><span>Precio Bulfor</span><strong>${cmpPeso(l._bulfor)}</strong></div>
          <div><span>Ganador</span><strong>${l._ganadoras.length ? cmpEsc(cmpNombreGanador(l)) + ' · ' + cmpPeso(l._precioGanador) : 'Sin adjudicar'}</strong></div>
          <div><span>Ofertas</span><strong>${ofs.length}</strong></div>
        </div>
        <h4 class="cmp-h4">Ofertas en este producto</h4>
        <div class="table-card tabla-centrada cmp-tabla"><table>
          <thead><tr><th>Empresa</th><th>Precio unitario neto</th><th>vs Bulfor</th><th>Estado</th><th></th></tr></thead>
          <tbody>${filasOf}</tbody></table></div>
        <h4 class="cmp-h4">Otras veces que ofertamos este producto${clave2.length ? ` <span class="cmp-gris">(descripción con "${cmpEsc(clave2.join(' ').toLowerCase())}")</span>` : ''}</h4>
        ${hist.length ? `<div class="table-card tabla-centrada cmp-tabla"><table>
          <thead><tr><th>Fecha</th><th>Producto</th><th>Unidad</th><th>Bulfor</th><th>Ganador</th></tr></thead>
          <tbody>${filasHist}</tbody></table></div>` : '<div class="cmp-gris">No hay otras licitaciones con este producto.</div>'}
      </div>
    </div>`;
  document.body.appendChild(modal);
  cmpEtiquetar(modal);
}

// ─── Excel de lo filtrado ───────────────────────────────────────────────────
function cmpExcel() {
  const comp = cmpActivos();
  const filas = cmpFiltradas().map(l => {
    const f = {
      'Fecha publicación': l.fecha_publicacion, 'Licitación': l.licitacion, 'Organismo': l.organismo,
      'Producto': l.descripcion || l.producto_generico, 'Unidad': l.unidad_medida, 'Cantidad pedida': l.cantidad,
      'Precio Bulfor': l._bulfor,
    };
    comp.forEach(c => { f['Precio ' + c.nombre] = cmpPrecioDe(l.clave, c.rut); });
    f['Ganador'] = cmpNombreGanador(l);
    f['Precio ganador'] = l._precioGanador;
    f['Resultado Bulfor'] = { gano: 'Ganó', perdio: 'Perdió', sin: 'Sin adjudicar' }[l._resultado];
    f['Ficha Mercado Público'] = l.link;
    return f;
  });
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Nuestras ofertas');
  XLSX.writeFile(libro, `competencia_licitaciones_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── Competidores ───────────────────────────────────────────────────────────
// Lista editable (solo editores). Abajo, sugerencias: empresas que más se
// cruzan con Bulfor y que no están en la lista.
function cmpHtmlCompetidores() {
  const ed = cmpEditor();
  const seguidos = new Set(cmpState.competidores.map(c => c.rut));
  const conteo = new Map();
  cmpState.ofertas.forEach(o => {
    if (o.rut_proveedor === CMP_RUT_BULFOR || seguidos.has(o.rut_proveedor) || o.estado_oferta === 'Rechazada') return;
    const c = conteo.get(o.rut_proveedor) || { rut: o.rut_proveedor, nombre: o.nombre_fantasia || o.proveedor, razon: o.proveedor, n: 0 };
    c.n++; conteo.set(o.rut_proveedor, c);
  });
  const sugeridos = [...conteo.values()].filter(c => c.n >= 5).sort((a, b) => b.n - a.n).slice(0, 15);
  return `
    <div class="table-card tabla-centrada cmp-tabla">
      <table>
        <thead><tr><th>Competidor</th><th>Razón social</th><th>RUT</th><th>Productos en común</th><th>Seguir</th>${ed ? '<th></th>' : ''}</tr></thead>
        <tbody>${cmpState.competidores.map(c => `
          <tr>
            <td class="cmp-izq"><strong>${cmpEsc(c.nombre)}</strong></td><td class="cmp-izq">${cmpEsc(c.razon_social || '')}</td>
            <td class="mono">${cmpEsc(c.rut)}</td><td>${cmpEstadisticas(c.rut).productos}</td>
            <td><input type="checkbox" ${c.activo ? 'checked' : ''} ${ed ? '' : 'disabled'} onchange="cmpActivar('${cmpEsc(c.rut)}',this.checked)" aria-label="Seguir a ${cmpEsc(c.nombre)}"></td>
            ${ed ? `<td><button class="page-btn" onclick="cmpQuitar('${cmpEsc(c.rut)}')">Quitar</button></td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p class="cmp-ayuda">Los competidores "seguidos" salen en el Resumen y en las columnas del Excel. ${ed ? '' : 'Solo los editores pueden cambiar la lista.'}</p>
    ${sugeridos.length ? `
    <h4 class="cmp-h4">Otras empresas que se cruzan con Bulfor</h4>
    <div class="table-card tabla-centrada cmp-tabla">
      <table>
        <thead><tr><th>Empresa</th><th>RUT</th><th>Productos en común</th>${ed ? '<th></th>' : ''}</tr></thead>
        <tbody>${sugeridos.map(s => `
          <tr><td class="cmp-izq">${cmpEsc(s.nombre)}${s.razon && s.razon !== s.nombre ? `<div class="cmp-gris">${cmpEsc(s.razon)}</div>` : ''}</td>
            <td class="mono">${cmpEsc(s.rut)}</td><td>${s.n}</td>
            ${ed ? `<td><button class="page-btn" onclick="cmpAgregar('${cmpEsc(s.rut)}')">＋ Seguir</button></td>` : ''}</tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}`;
}

async function cmpGuardarCompetidor(metodo, rut, cuerpo) {
  const ruta = 'lic_competidores' + (rut ? `?rut=eq.${encodeURIComponent(rut)}` : '');
  const res = await sb(ruta, { method: metodo, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (!res.ok) { toast('No se pudo guardar el cambio.', 'err'); return false; }
  return true;
}

async function cmpActivar(rut, activo) {
  if (!await cmpGuardarCompetidor('PATCH', rut, { activo })) { cmpRender(); return; }
  const c = cmpState.competidores.find(x => x.rut === rut);
  if (c) c.activo = activo;
  toast(activo ? 'Competidor seguido' : 'Competidor oculto del resumen');
  cmpRender();
}

async function cmpQuitar(rut) {
  const c = cmpState.competidores.find(x => x.rut === rut);
  if (!c || !await confirmModal(`¿Quitar a ${escapeHtml(c.nombre)} de la lista de competidores?\nSus ofertas siguen guardadas; puedes volver a agregarlo.`, { textoOk: 'Quitar' })) return;
  if (!await cmpGuardarCompetidor('DELETE', rut)) return;
  cmpState.competidores = cmpState.competidores.filter(x => x.rut !== rut);
  toast('Competidor quitado');
  cmpRender();
}

async function cmpAgregar(rut) {
  const o = cmpState.ofertas.find(x => x.rut_proveedor === rut);
  if (!o) return;
  const propuesto = o.nombre_fantasia || o.proveedor;
  const nombre = await promptModal('Nombre corto para mostrar:', propuesto);
  if (!nombre) return;
  const fila = { rut, nombre: nombre.trim(), razon_social: o.proveedor, activo: true };
  if (!await cmpGuardarCompetidor('POST', null, fila)) return;
  cmpState.competidores.push(fila);
  cmpState.competidores.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  toast(`${fila.nombre} agregado a los competidores`);
  cmpRender();
}
