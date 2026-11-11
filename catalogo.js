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
let catLetra = '';          // filtro por letra ('' = todas)
let catFichaId = null;      // producto abierto en la ficha
let catFichaHosp = '';      // filtro de hospital dentro de la ficha

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
  catRenderLetras();
  catRenderLista();
}

function catRenderLetras() {
  const letras = [...new Set(catProductos.map(p => p._letra))].sort();
  const cont = document.getElementById('cat-letras');
  cont.innerHTML = [['', 'Todas'], ...letras.map(l => [l, l])].map(([v, t]) =>
    `<button class="${catLetra === v ? 'active' : ''}" onclick="catLetra='${v}';catRenderLetras();catRenderLista()">${t}</button>`).join('');
}

function catRenderLista() {
  const q = document.getElementById('cat-buscar').value;
  const lista = catProductos.filter(p => (!catLetra || p._letra === catLetra)
    && coincideBusqueda(`${p.nombre} ${p.codigo}`, q));
  const ventas = lista.reduce((s, p) => s + p._lineas.length, 0);
  document.getElementById('cat-info').textContent =
    `${lista.length} producto${lista.length === 1 ? '' : 's'} · ${ventas.toLocaleString('es-CL')} ventas 2025–2026`;
  const body = document.getElementById('cat-body');
  if (!lista.length) { body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-2);padding:24px">Sin productos para esa búsqueda.</td></tr>'; return; }
  body.innerHTML = lista.map(p => {
    const u = p._ult;
    return `<tr class="cat-fila" onclick="catAbrirFicha(${p.id})" tabindex="0" onkeydown="if(event.key==='Enter')catAbrirFicha(${p.id})">
      <td data-label="Producto"><div class="cat-nombre">${catEsc(p.nombre)}</div><div class="cat-cod">${catEsc(p.codigo)}</div></td>
      <td class="cat-num" data-label="Típico por unidad"><b>${catClp(p._pu)}</b><div class="cat-iva">${p._pu ? catClp(p._pu * 1.19) + ' c/IVA' : ''}</div><div class="cat-cod">por ${catEsc(p.unidad_base || 'unidad')}</div></td>
      <td class="cat-num" data-label="Típico por envase">${catClp(p._pe)}<div class="cat-iva">${p._pe ? catClp(p._pe * 1.19) + ' c/IVA' : ''}</div></td>
      <td class="cat-num" data-label="Último precio">${u ? catClp(u.precio) : '—'}<div class="cat-cod">${u ? catFecha(u.fecha) : ''}</div></td>
      <td class="cat-num" data-label="Ventas">${p._lineas.length}</td>
      <td class="cat-num" data-label="Hospitales">${p._hosp}</td>
    </tr>`;
  }).join('');
}

function catAbrirFicha(id) {
  catFichaId = id; catFichaHosp = '';
  document.getElementById('cat-lista').style.display = 'none';
  document.getElementById('cat-ficha').style.display = '';
  catRenderFicha();
  window.scrollTo({ top: 0 });
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
    <div class="cat-ficha-tit">${catEsc(p.nombre)}</div>
    <div class="cat-cod" style="margin-bottom:14px">${catEsc(p.codigo)} · ${catEsc(p.forma || '')} · precio por ${catEsc(p.unidad_base || 'unidad')}</div>
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
      <thead><tr><th>Fecha</th><th>Hospital</th><th>Origen</th><th>OC / RM</th><th class="cat-num">Precio vendido</th><th class="cat-num">Neto por ${catEsc(p.unidad_base || 'unidad')}</th><th class="cat-num">Neto por envase</th><th>Envase</th></tr></thead>
      <tbody>${ls.map(l => {
        const h = catHospital(l.hospital_clave);
        const raro = pu && l.precio_unidad && (l.precio_unidad / pu >= 2.5 || pu / l.precio_unidad >= 2.5);
        return `<tr${raro ? ' class="cat-raro" title="Precio muy distinto al típico"' : ''}>
          <td data-label="Fecha">${catFecha(l.fecha)}</td>
          <td data-label="Hospital">${catEsc(h.nombre)}${h.region ? `<div class="cat-cod">${catEsc(h.region)}</div>` : ''}</td>
          <td data-label="Origen">${l.origen === 'oc' ? 'OC' : 'Factura'}</td>
          <td data-label="OC / RM">${l.ref ? catEsc(l.ref) : (l.origen === 'factura' ? '<span class="cat-sinoc">sin OC</span>' : '—')}${l.rm ? `<div class="cat-cod">RM ${catEsc(l.rm)}</div>` : ''}</td>
          <td class="cat-num" data-label="Precio vendido">${catClp(l.precio)}${l.unidad_venta ? `<div class="cat-cod">${catEsc(l.unidad_venta)}</div>` : ''}</td>
          <td class="cat-num" data-label="Neto por unidad"><b>${catClp(l.precio_unidad)}</b></td>
          <td class="cat-num" data-label="Neto por envase">${catClp(l.precio_envase)}</td>
          <td data-label="Envase">${catEsc(l.envase || '')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div></div>`;
}
