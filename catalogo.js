// ─── CATÁLOGO DE PRECIOS (menú Precios › Catálogo) ──────────────────────────
// Un nombre por producto, revisado por Seba letra por letra (tablas cat_*).
// Cada venta (línea de OC o de factura) queda asignada a su producto con el
// precio por unidad (cápsula, papelillo, sobre, g o mL) y por envase, así el
// precio se puede rastrear hasta su OC, factura o RM.
// Solo lectura: esta primera versión muestra lo cargado (letras A y B).

let catProductos = [];      // cat_productos
let catLineas = [];         // cat_lineas (todas las ventas asignadas)
let catCargado = false;
let catCargando = null;
let catFichaId = null;      // producto abierto en la ficha
let catFichaHosp = '';      // filtro de hospital dentro de la ficha
// Filtros de la lista (cada uno es un conjunto de valores marcados; vacío = todos)
const catFiltros = { letra: new Set(), forma: new Set(), unidad: new Set() };
const catAbiertos = new Set(); // grupos de filtros desplegados
const catDocDeItem = {};    // id de línea de factura → documento (para mostrar el N° y abrirla)

// Nombre para mostrar: sin la forma farmacéutica (va como filtro y en la línea gris).
function catNombreCorto(p) {
  if (!p.forma) return p.nombre;
  return p.nombre.replace(' ' + p.forma, '').replace(/\s+/g, ' ').trim();
}

const catClp = n => (n === null || n === undefined || n === '') ? '—'
  : '$ ' + Number(n).toLocaleString('es-CL', { maximumFractionDigits: Number(n) < 100 ? 1 : 0 });
const catFecha = f => f ? String(f).slice(0, 10).split('-').reverse().join('-') : '—';
const catSinTildes = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const catEsc = t => (typeof escapeHtml === 'function' ? escapeHtml(t) : String(t ?? ''));

function catMediana(xs) {
  const v = xs.filter(x => x !== null && x !== undefined && !isNaN(x)).map(Number).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Nombre del hospital a partir de su RUT (hospitales_maestro); si no está, lo guardado.
function catHospital(clave) {
  const rut = String(clave || '').replace(/\./g, '').toUpperCase();
  const h = (typeof hospitalesMaestro !== 'undefined' ? hospitalesMaestro : [])
    .find(x => String(x.rut || '').replace(/\./g, '').toUpperCase() === rut);
  if (h) return { nombre: h.nombre_estandar || h.nombre_original, region: h.region || '' };
  // Clientes que no están en el maestro (ej. clínicas): el nombre que trae su factura.
  const d = (typeof documentosGdexpress !== 'undefined' ? documentosGdexpress : [])
    .find(x => String(x.rut_hospital || '').replace(/\./g, '').toUpperCase() === rut);
  return { nombre: d ? d.hospital : (clave || '—'), region: '' };
}

async function catCargar() {
  if (catCargado) return;
  if (catCargando) return catCargando;
  catCargando = (async () => {
    const [prods, lineas] = await Promise.all([
      fetchAll('cat_productos', 'select=id,codigo,nombre,activo,concentracion,forma,presentacion_cantidad,unidad_base,notas&order=nombre.asc'),
      fetchAll('cat_lineas', 'select=producto_id,origen,linea_id,fecha,hospital_clave,precio,unidad_venta,precio_unidad,precio_envase,envase,ref,rm,fuente&order=fecha.desc'),
    ]);
    catProductos = Array.isArray(prods) ? prods : [];
    catLineas = Array.isArray(lineas) ? lineas : [];
    // Resumen por producto para la lista (precio típico = mediana de las ventas).
    const por = {};
    catLineas.forEach(l => (por[l.producto_id] = por[l.producto_id] || []).push(l));
    catProductos.forEach(p => {
      const ls = por[p.id] || [];
      p._lineas = ls;
      p._pu = catMediana(ls.map(l => l.precio_unidad));
      p._pe = catMediana(ls.map(l => l.precio_envase));
      p._ult = ls[0] || null;
      p._hosp = new Set(ls.map(l => l.hospital_clave)).size;
      p._letra = catSinTildes(p.nombre).charAt(0);
    });
    catProductos.sort((a, b) => catSinTildes(a.nombre).localeCompare(catSinTildes(b.nombre)));
    catCargado = true;
  })();
  try { await catCargando; } finally { catCargando = null; }
}

async function catInit() {
  catFichaId = null;
  document.getElementById('cat-ficha').style.display = 'none';
  document.getElementById('cat-lista').style.display = '';
  if (!catCargado) {
    document.getElementById('cat-cargando').style.display = '';
    try { await catCargar(); } catch (e) { console.error(e); toast('No se pudo cargar el catálogo.', 'err'); }
    document.getElementById('cat-cargando').style.display = 'none';
  }
  catRenderFiltros();
  catRenderLista();
}

function catRenderFiltros() {
  const grupos = [
    ['letra', 'Letra', [...new Set(catProductos.map(p => p._letra))].sort()],
    ['forma', 'Forma farmacéutica', [...new Set(catProductos.map(p => p.forma || 'sin forma'))].sort()],
    ['unidad', 'Precio por', [...new Set(catProductos.map(p => p.unidad_base || 'unidad'))].sort()],
  ];
  const activos = Object.values(catFiltros).reduce((n, st) => n + st.size, 0);
  document.getElementById('cat-filtros').innerHTML = `
    <div class="cat-filtros-cab"><b><i class="ti ti-filter"></i> Filtros</b>
      ${activos ? `<button class="cat-limpiar" onclick="catLimpiarFiltros()">Quitar filtros (${activos})</button>` : '<span class="cat-cod">Toca un filtro para abrirlo</span>'}</div>
    ${grupos.map(([clave, titulo, valores]) => `
      <details class="cat-grupo" ${catAbiertos.has(clave) ? 'open' : ''} ontoggle="this.open ? catAbiertos.add('${clave}') : catAbiertos.delete('${clave}')">
        <summary>${titulo}${catFiltros[clave].size ? ` <span class="cat-cuenta">${catFiltros[clave].size}</span>` : ''}</summary>
        <div class="cat-chips">${valores.map(v => `<button class="cat-chip ${catFiltros[clave].has(v) ? 'on' : ''}"
          onclick="catToggleFiltro('${clave}', '${catEsc(v).replace(/'/g, "\\'")}')">${catEsc(v)}</button>`).join('')}</div>
      </details>`).join('')}`;
}

function catToggleFiltro(clave, valor) {
  const st = catFiltros[clave];
  st.has(valor) ? st.delete(valor) : st.add(valor);
  catRenderFiltros(); catRenderLista();
}

function catLimpiarFiltros() {
  Object.values(catFiltros).forEach(st => st.clear());
  catRenderFiltros(); catRenderLista();
}

function catRenderLista() {
  const q = document.getElementById('cat-buscar').value;
  const f = catFiltros;
  const lista = catProductos.filter(p => (!f.letra.size || f.letra.has(p._letra))
    && (!f.forma.size || f.forma.has(p.forma || 'sin forma'))
    && (!f.unidad.size || f.unidad.has(p.unidad_base || 'unidad'))
    && coincideBusqueda(`${p.nombre} ${p.codigo}`, q));
  const ventas = lista.reduce((s, p) => s + p._lineas.length, 0);
  document.getElementById('cat-info').textContent =
    `${lista.length} producto${lista.length === 1 ? '' : 's'} · ${ventas.toLocaleString('es-CL')} ventas 2025–2026`;
  const body = document.getElementById('cat-body');
  if (!lista.length) { body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-2);padding:24px">Sin productos para esa búsqueda.</td></tr>'; return; }
  body.innerHTML = lista.map(p => {
    const u = p._ult;
    return `<tr class="cat-fila" onclick="catAbrirFicha(${p.id})" tabindex="0" onkeydown="if(event.key==='Enter')catAbrirFicha(${p.id})">
      <td data-label="Producto"><div class="cat-nombre">${catEsc(catNombreCorto(p))}</div><div class="cat-cod">${catEsc(p.codigo)}${p.forma ? ' · ' + catEsc(p.forma) : ''}</div></td>
      <td class="cat-num" data-label="Típico por unidad"><b>${catClp(p._pu)}</b><div class="cat-iva">${p._pu ? catClp(p._pu * 1.19) + ' c/IVA' : ''}</div><div class="cat-cod">por ${catEsc(p.unidad_base || 'unidad')}</div></td>
      <td class="cat-num" data-label="Típico por envase">${catClp(p._pe)}<div class="cat-iva">${p._pe ? catClp(p._pe * 1.19) + ' c/IVA' : ''}</div></td>
      <td class="cat-num" data-label="Último precio">${u ? catClp(u.precio) : '—'}<div class="cat-cod">${u ? catFecha(u.fecha) : ''}</div></td>
      <td class="cat-num" data-label="Ventas">${p._lineas.length}</td>
      <td class="cat-num" data-label="Hospitales">${p._hosp}</td>
    </tr>`;
  }).join('');
}

async function catAbrirFicha(id) {
  catFichaId = id; catFichaHosp = '';
  document.getElementById('cat-lista').style.display = 'none';
  document.getElementById('cat-ficha').style.display = '';
  catRenderFicha();
  window.scrollTo({ top: 0 });
  // N° de factura de cada venta facturada: se busca su documento (una vez por línea).
  const p = catProductos.find(x => x.id === id);
  const faltan = (p ? p._lineas : []).filter(l => l.origen === 'factura' && !(l.linea_id in catDocDeItem)).map(l => l.linea_id);
  for (let k = 0; k < faltan.length; k += 150) {
    try {
      const r = await sb(`documentos_gdexpress_items?select=id,documento_id&id=in.(${faltan.slice(k, k + 150).join(',')})`);
      if (r.ok) (await r.json()).forEach(x => { catDocDeItem[x.id] = x.documento_id; });
    } catch (e) { console.error(e); }
  }
  if (faltan.length && catFichaId === id) catRenderFicha();
}

// Factura(s) de una venta: la propia (línea de factura) o las emitidas para esa OC (línea de OC).
function catFacturasDe(l) {
  const docs = typeof documentosGdexpress !== 'undefined' ? documentosGdexpress : [];
  if (l.origen === 'factura') {
    const d = docs.find(x => x.id === catDocDeItem[l.linea_id]);
    return d ? [d] : [];
  }
  return l.ref ? docs.filter(x => x.orden_compra_ref === l.ref && String(x.tipo_dte) === '33') : [];
}

function catAbrirOC(codigo) {
  if (typeof oc !== 'undefined' && oc.some(o => o.codigooc === codigo)) return openOCDetail(codigo);
  window.open(urlMercadoPublicoOC(codigo), '_blank', 'noopener');
}

function catVolver() {
  catFichaId = null;
  document.getElementById('cat-ficha').style.display = 'none';
  document.getElementById('cat-lista').style.display = '';
}

function catRenderFicha() {
  const p = catProductos.find(x => x.id === catFichaId);
  if (!p) return catVolver();
  const todas = p._lineas;
  const ls = catFichaHosp ? todas.filter(l => l.hospital_clave === catFichaHosp) : todas;
  const pu = catMediana(ls.map(l => l.precio_unidad));
  const pe = catMediana(ls.map(l => l.precio_envase));
  const pus = ls.map(l => Number(l.precio_unidad)).filter(x => x > 0);
  const u = ls[0];
  const hosp = {};
  todas.forEach(l => { hosp[l.hospital_clave] = (hosp[l.hospital_clave] || 0) + 1; });
  const opciones = Object.entries(hosp).map(([k, n]) => [k, catHospital(k).nombre, n])
    .sort((a, b) => a[1].localeCompare(b[1]));
  const sinOC = ls.filter(l => l.origen === 'factura' && !l.ref).length;
  document.getElementById('cat-ficha-cuerpo').innerHTML = `
    <div class="cat-ficha-tit">${catEsc(catNombreCorto(p))}</div>
    <div class="cat-cod" style="margin-bottom:14px">${catEsc(p.codigo)}${p.forma ? ' · ' + catEsc(p.forma) : ''} · precio por ${catEsc(p.unidad_base || 'unidad')}</div>
    <div class="stats">
      <div class="stat"><div class="stat-label">Precio típico neto (por ${catEsc(p.unidad_base || 'unidad')})</div><div class="stat-val">${catClp(pu)}</div><div class="cat-iva">${pu ? catClp(pu * 1.19) + ' con IVA' : ''}</div></div>
      <div class="stat"><div class="stat-label">Precio típico neto por envase</div><div class="stat-val">${catClp(pe)}</div><div class="cat-iva">${pe ? catClp(pe * 1.19) + ' con IVA' : ''}</div></div>
      <div class="stat"><div class="stat-label">Último precio vendido</div><div class="stat-val">${u ? catClp(u.precio) : '—'}</div><div class="cat-iva">${u ? catFecha(u.fecha) + ' · ' + catEsc(catHospital(u.hospital_clave).nombre) : ''}</div></div>
      <div class="stat"><div class="stat-label">Rango por unidad</div><div class="stat-val" style="font-size:16px">${pus.length ? catClp(Math.min(...pus)) + ' – ' + catClp(Math.max(...pus)) : '—'}</div><div class="cat-iva">${ls.length} ventas${sinOC ? ' · ' + sinOC + ' sin OC' : ''}</div></div>
    </div>
    <label for="cat-ficha-hosp" class="pv-buscar-label">Hospital</label>
    <div class="toolbar"><select id="cat-ficha-hosp" onchange="catFichaHosp=this.value;catRenderFicha()" style="max-width:420px">
      <option value="">Todos los hospitales (${todas.length} ventas)</option>
      ${opciones.map(([k, n, c]) => `<option value="${catEsc(k)}" ${k === catFichaHosp ? 'selected' : ''}>${catEsc(n)} (${c})</option>`).join('')}
    </select></div>
    <div class="table-card"><div class="cat-tabla-wrap"><table style="margin:0">
      <thead><tr><th>Fecha</th><th>Hospital</th><th>Factura</th><th>Orden de compra</th><th class="cat-num">Precio vendido</th><th class="cat-num">Neto por ${catEsc(p.unidad_base || 'unidad')}</th><th class="cat-num">Neto por envase</th><th>Envase</th></tr></thead>
      <tbody>${ls.map(l => {
        const h = catHospital(l.hospital_clave);
        const raro = pu && l.precio_unidad && (l.precio_unidad / pu >= 2.5 || pu / l.precio_unidad >= 2.5);
        return `<tr${raro ? ' class="cat-raro" title="Precio muy distinto al típico"' : ''}>
          <td data-label="Fecha">${catFecha(l.fecha)}</td>
          <td data-label="Hospital">${catEsc(h.nombre)}${h.region ? `<div class="cat-cod">${catEsc(h.region)}</div>` : ''}</td>
          <td data-label="Factura">${(() => {
            const fs = catFacturasDe(l);
            if (fs.length) return fs.map(d => `<a href="#" class="cat-link" onclick="event.preventDefault();abrirDetalleDocumentoGdexpress(${d.id})">${String(d.tipo_dte) === '52' ? 'Guía ' : ''}${catEsc(d.folio)}</a>`).join(' · ');
            return l.origen === 'factura' ? '…' : '<span class="cat-cod">sin facturar</span>';
          })()}</td>
          <td data-label="Orden de compra">${l.ref ? `<a href="#" class="cat-link" onclick="event.preventDefault();catAbrirOC('${catEsc(l.ref).replace(/'/g, '')}')">${catEsc(l.ref)}</a>` : '<span class="cat-sinoc">sin OC</span>'}</td>
          <td class="cat-num" data-label="Precio vendido">${catClp(l.precio)}${l.unidad_venta ? `<div class="cat-cod">${catEsc(l.unidad_venta)}</div>` : ''}</td>
          <td class="cat-num" data-label="Neto por unidad"><b>${catClp(l.precio_unidad)}</b></td>
          <td class="cat-num" data-label="Neto por envase">${catClp(l.precio_envase)}</td>
          <td data-label="Envase">${catEsc(l.envase || '')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div></div>`;
}
