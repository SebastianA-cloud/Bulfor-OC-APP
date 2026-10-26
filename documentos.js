// ═══ Creación de documentos: factura (33) y guía de despacho (52) ════════
// Formularios parecidos a los de GDExpress. Arman el XML del DTE en el mismo
// formato SII que usan las facturas y guías que ya se emiten (el molde salió
// de las facturas reales guardadas en documentos_gdexpress). La emisión va
// por una función del servidor con la llave de GDExpress (nunca desde el
// navegador): hasta que esa función exista, solo se puede revisar el XML.

// Regiones → provincias (la "ciudad" de GDExpress) → comunas de Chile.
const DTE_GEO = [["Arica y Parinacota",[["Arica",["Arica","Camarones"]],["Parinacota",["Putre","General Lagos"]]]],["Tarapacá",[["Iquique",["Iquique","Alto Hospicio"]],["Tamarugal",["Pozo Almonte","Camiña","Colchane","Huara","Pica"]]]],["Antofagasta",[["Antofagasta",["Antofagasta","Mejillones","Sierra Gorda","Taltal"]],["El Loa",["Calama","Ollagüe","San Pedro de Atacama"]],["Tocopilla",["Tocopilla","María Elena"]]]],["Atacama",[["Copiapó",["Copiapó","Caldera","Tierra Amarilla"]],["Chañaral",["Chañaral","Diego de Almagro"]],["Huasco",["Vallenar","Alto del Carmen","Freirina","Huasco"]]]],["Coquimbo",[["Elqui",["La Serena","Coquimbo","Andacollo","La Higuera","Paiguano","Vicuña"]],["Choapa",["Illapel","Canela","Los Vilos","Salamanca"]],["Limarí",["Ovalle","Combarbalá","Monte Patria","Punitaqui","Río Hurtado"]]]],["Valparaíso",[["Valparaíso",["Valparaíso","Casablanca","Concón","Juan Fernández","Puchuncaví","Quintero","Viña del Mar"]],["Isla de Pascua",["Isla de Pascua"]],["Los Andes",["Los Andes","Calle Larga","Riconada","San Esteban"]],["Petorca",["La Ligua","Cabildo","Papudo","Petorca","Zapallar"]],["Quillota",["Quillota","Calera","Hijuelas","La Cruz","Nogales"]],["San Antonio",["San Antonio","Algarrobo","Cartagena","El Quisco","El Tabo","Santo Domingo"]],["San Felipe de Aconcagua",["San Felipe","Catemu","Llaillay","Panquehue","Putaendo","Santa María"]],["Marga Marga",["Quilpué","Limache","Olmué","Villa Alemana"]]]],["Región del Libertador Gral. Bernardo O'Higgins",[["Cachapoal",["Rancagua","Codegua","Coinco","Coltauco","Doñihue","Graneros","Las Cabras","Machalí","Malloa","Mostazal","Olivar","Peumo","Pichidegua","Quinta de Tilcoco","Rengo","Requínoa","San Vicente"]],["Cardenal Caro",["Pichilemu","La Estrella","Litueche","Marichihue","Navidad","Paredones"]],["Colchagua",["San Fernando","Chépica","Chimbarongo","Lolol","Nancagua","Palmilla","Peralillo","Placilla","Pumanque","Santa Cruz"]]]],["Región del Maule",[["Talca",["Talca","Constitución","Curepto","Empedrado","Maule","Pelarco","Pencahue","Río Claro","San Clemente","San Rafael"]],["Cauquenes",["Cauquenes","Chanco","Pelluhue"]],["Curicó",["Curicó","Hualañé","Licantén","Molina","Rauco","Romeral","Sagrada Familia","Teno","Vichuquén"]],["Linares",["Linares","Colbún","Longaví","Parral","Retiro","San Javier","Villa Alegre","Yerbas Buenas"]]]],["Región del Biobío",[["Concepción",["Concepción","Coronel","Chiguayante","Florida","Hualqui","Lota","Penco","San Pedro de la Paz","Santa Juana","Talcahuano","Tomé","Hualpén"]],["Arauco",["Lebu","Arauco","Cañete","Contulmo","Curanilahue","Los Álamos","Tirúa"]],["Biobío",["Los Ángeles","Antuco","Cabrero","Laja","Mulchén","Nacimiento","Negrete","Quilaco","Quilleco","San Rosendo","Santa Bárbara","Tucapel","Yumbel","Alto Biobío"]]]],["Región del Ñuble",[["Diguillín",["Bulnes","Chillán","Chillán Viejo","El Carmen","Pemuco","Pinto","Quillón","San Ignacio","Yungay"]],["Itata",["Cobquecura","Coelemu","Ninhue","Portezuelo","Quirihue","Ránquil","Treguaco"]],["Punilla",["Coihueco","Ñiquén","San Carlos","San Fabián","San Nicolas"]]]],["Región de la Araucanía",[["Cautín",["Temuco","Carahu","Cunco","Curarrehue","Freire","Galvarin","Gorbea","Lautaro","Loncoche","Melipeuco","Nueva Imperial","Padre las Casa","Perquenco","Pitrufquén","Pucó","Saavedra","Teodoro Schmid","Toltén","Vilcún","Villarrica","Cholchol"]],["Malleco",["Angol","Collipulli","Curacautín","Ercilla","Lonquimay","Los Sauces","Lumaco","Purén","Renaico","Traiguén","Victoria"]]]],["Región de los Ríos",[["Valdivia",["Valdivia","Corral","Lanco","Los Lagos","Máfil","Mariquina","Paillaco","Panguipulli"]],["Ranco",["La Unión","Futrono","Lago Ranco","Río Bueno"]]]],["Región de los Lagos",[["Llanquihue",["Puerto Montt","Calbuco","Cochamó","Fresia","Frutillar","Los Muermos","Llanquihue","Maullín","Puerto Varas"]],["Chiloé",["Castro","Ancud","Chonchi","Curaco de Vélez","Dalcahue","Puqueldón","Queilén","Quellón","Quemchi","Quinchao"]],["Osorno",["Osorno","Puerto Octay","Purranque","Puyehue","Río Negro","San Juan de la Costa","San Pablo"]],["Palena",["Chaitén","Futaleufú","Hualaihué","Palena"]]]],["Región Aisén del Gral. Carlos Ibañez del Campo",[["Coyhaique",["Coyhaique","Lago Verde"]],["Aysén",["Aisén","Cisnes","Guaitecas"]],["Capitán Pratt",["Cochrane","O’Higgins","Tortel"]],["General Carrera",["Chile Chico","Río Ibáñez"]]]],["Región de Magallanes y de la Antártica Chilena",[["Magallanes",["Punta Arenas","Laguna Blanca","Río Verde","San Gregorio"]],["Antártica Chilena",["Cabo de Hornos (Ex. Navarino)","Antártica"]],["Tierra del Fuego",["Porvenir","Primavera","Timaukel"]],["Última Esperanza",["Natales","Torres del Paine"]]]],["Región Metropolitana de Santiago",[["Santiago",["Santiago","Cerrillos","Cerro Navia","Conchalí","El Bosque","Estación Central","Huechuraba","Independencia","La Cisterna","La Florida","La Granja","La Pintana","La Reina","Las Condes","Lo Barnechea","Lo Espejo","Lo Prado","Macul","Maipú","Ñuñoa","Pedro Aguirre Cerda","Peñalolén","Providencia","Pudahuel","Quilicura","Quinta Normal","Recoleta","Renca","San Joaquín","San Miguel","San Ramón","Vitacura"]],["Cordillera",["Puente Alto","Pirque","San José de Maipo"]],["Chacabuco",["Colina","Lampa","Tiltil"]],["Maipo",["San Bernardo","Buin","Calera de Tango","Paine"]],["Mellipilla",["Melipilla","Alhué","Curacaví","María Pinto","San Pedro"]],["Talagante",["Talagante","El Monte","Isla de Maipo","Padre Hurtado","Peñaflor"]]]]];
const DTE_EMISOR = {
  rut: '76186755-5', rzn: ' SOCIEDAD FARMACEUTICA BULFOR LIMITADA',
  giro: 'VENTA AL POR MAYOR DE PRODUCTOS FARMACEUTICOS, FARMACIAS.', acteco: '464907',
  sucursal: 'Casa Matríz', dir: 'Coquimbo 35', cmna: 'SANTIAGO', ciudad: 'Santiago',
};
const DTE_RESOLUCION = { fecha: '2014-08-22', numero: 80 };
const DTE_GLOSA_PAGO = 'DEPOSITAR CTA CTE BANCO BCI 86993984';
const DTE_MEDIOS_PAGO = [['PE', 'Pago a cuenta corriente'], ['CH', 'Cheque'], ['CF', 'Cheque a fecha'], ['LT', 'Letra'], ['EF', 'Efectivo'], ['TC', 'Tarjeta de crédito'], ['TD', 'Tarjeta de débito'], ['OT', 'Otro']];
const DTE_FORMAS_PAGO = [['2', 'Crédito'], ['1', 'Contado'], ['3', 'Sin costo']];
const DTE_TIPOS_REF = [['801', '801 · Orden de compra'], ['33', '33 · Factura electrónica'], ['52', '52 · Guía de despacho electrónica'], ['61', '61 · Nota de crédito electrónica'], ['56', '56 · Nota de débito electrónica'], ['802', '802 · Nota de pedido'], ['803', '803 · Contrato'], ['HES', 'HES · Hoja de entrada de servicio']];
const DTE_TRASLADOS = [['2', 'Ventas por efectuar'], ['1', 'Operación constituye venta'], ['3', 'Consignaciones'], ['4', 'Entrega gratuita'], ['5', 'Traslados internos'], ['6', 'Otros traslados no venta'], ['7', 'Guía de devolución']];
const DTE_DESPACHOS = [['1', 'Por cuenta del receptor'], ['2', 'Por cuenta del emisor a instalaciones del cliente'], ['3', 'Por cuenta del emisor a otras instalaciones']];
const DTE_NOMBRES = { 33: 'factura', 52: 'guía de despacho' };
// Transporte de las guías: el de siempre, editable en cada guía.
const DTE_TRANSPORTE = { patente: 'THWG-96', rutTrans: '20337523-9', rutChofer: '20337523-9', nombreChofer: 'Benjamin Yañez' };

const dteEstado = {};

const dteNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const dteEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const dteAttr = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const dteClp = n => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-CL');
function dteMasDias(fecha, dias) { const d = new Date(fecha + 'T12:00:00'); d.setDate(d.getDate() + dias); return d.toLocaleDateString('sv-SE'); }
function dteHora() { return new Date().toLocaleTimeString('es-CL', { hour12: false }); }
function dteFechaCL(ts) { return ts ? new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }) : ''; }
function dteDmy(iso) { return iso ? iso.split('-').reverse().join('-') : ''; }

// RUT: sin puntos, con guion y dígito verificador en mayúscula.
function dteRutLimpio(rut) {
  const s = String(rut || '').replace(/[.\s]/g, '').toUpperCase();
  if (!s) return '';
  if (s.includes('-')) return s;
  return s.length > 1 ? s.slice(0, -1) + '-' + s.slice(-1) : s;
}
function dteRutValido(rut) {
  const m = /^(\d{6,8})-([\dK])$/.exec(rut || '');
  if (!m) return false;
  let suma = 0, mul = 2;
  for (let i = m[1].length - 1; i >= 0; i--) { suma += Number(m[1][i]) * mul; mul = mul === 7 ? 2 : mul + 1; }
  const dv = 11 - (suma % 11);
  return (dv === 11 ? '0' : dv === 10 ? 'K' : String(dv)) === m[2];
}

const dteRefNueva = () => ({ tipo: '801', folio: '', fecha: '', razon: 'ORDEN DE COMPRA' });
// "Vencimiento" en la app es la Descripción del ítem en GDExpress (DscItem):
// texto libre que se envía tal cual, ej. "V:30-11-2026".
const dteDetNuevo = () => ({ tpoCod: 'RM', cod: '', nombre: '', dsc: '', qty: '', unidad: 'UN', precio: '', ocMax: null, ocCodigo: '' });

function dteNuevo(tipo) {
  const hoy = fechaLocalISO();
  return {
    tipo, fchEmis: hoy, fchVenc: dteMasDias(hoy, 30), fmaPago: '2', indTraslado: '2', tipoDespacho: '1',
    rut: '', recepInfo: '', recep: { rzn: '', giro: '', dir: '', cmna: '', ciudad: '' },
    dest: { dir: '', region: '', ciudad: '', cmna: '' },
    trans: { ...DTE_TRANSPORTE, fchSalida: hoy, hraSalida: dteHora(), fchLlegada: hoy },
    refs: tipo === 33 ? [dteRefNueva()] : [],
    det: [dteDetNuevo()],
    pago: { medio: 'PE', fchPago: '', glosa: DTE_GLOSA_PAGO },
    refact: { on: false, folio: '' },
  };
}

// Días entre dos fechas ISO (días corridos).
function dteDiasEntre(desde, hasta) {
  if (!desde || !hasta) return '';
  return Math.round((new Date(hasta + 'T12:00:00') - new Date(desde + 'T12:00:00')) / 86400000);
}

// Líneas que se emiten. En una refacturación se agrega, en la descripción
// del último producto, un guion y "ESTA FACTURA REEMPLAZA A LA N° X" (igual
// que se hacía a mano en GDExpress).
function dteLineas(s) {
  const lineas = s.det.filter(d => d.nombre.trim()).map(d => ({ ...d }));
  const folio = String(s.refact?.folio || '').trim();
  if (s.tipo === 33 && s.refact?.on && folio && lineas.length) {
    const u = lineas[lineas.length - 1];
    u.dsc = [(u.dsc || '').trim(), '-', `ESTA FACTURA REEMPLAZA A LA N° ${folio}`].filter(Boolean).join('\n');
  }
  return lineas;
}

// Borrador por tipo: se guarda en este navegador para no perder lo escrito.
function dteGuardarBorrador(t) { try { localStorage.setItem('bulfor_dte_' + t, JSON.stringify(dteEstado[t])); } catch (e) { /* sin almacenamiento */ } }
function dteCargarBorrador(t) { try { const s = localStorage.getItem('bulfor_dte_' + t); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

// ── Borradores guardados: listado aparte, como en GDExpress, en la tabla
// dte_borradores de Supabase (se ven desde cualquier computador). Se abren
// después con toda la información para seguir editando o enviarlos.
// Se borran al emitir el documento y a los 30 días.
const DTE_BORR_DIAS = 30;
const DTE_PAGINAS = { 33: 'doc-factura', 52: 'doc-guia' };
const DTE_TIPO_LARGO = { 33: '(33) Factura afecta', 52: '(52) Guía de despacho' };
let dteBorrCache = null;   // último listado leído, para el botón flotante
const dteUsuario = () => (typeof sesionActual !== 'undefined' && sesionActual?.email) || '';
const dteTieneDatos = s => !!(s && (s.rut || s.recep?.rzn || (s.det || []).some(d => d.nombre || d.qty || d.precio)));

async function dteBorradores() {
  const limite = new Date(Date.now() - DTE_BORR_DIAS * 864e5).toISOString();
  sb(`dte_borradores?editado_en=lt.${limite}`, { method: 'DELETE' }).catch(() => {});
  const r = await sb(`dte_borradores?select=*&editado_en=gte.${limite}&order=editado_en.desc`);
  if (!r.ok) throw new Error('No se pudieron leer los borradores (' + r.status + ').');
  dteBorrCache = await r.json();
  dteFabActualizar();
  return dteBorrCache;
}

let dteGuardandoBorr = false;
async function dteGuardarComoBorrador(t) {
  const s = dteEstado[t];
  if (!dteTieneDatos(s)) { toast('El documento está vacío: no hay nada que guardar.', 'err'); return; }
  if (dteGuardandoBorr) return;
  dteGuardandoBorr = true;
  const ahora = new Date().toISOString();
  const fila = { tipo: t, rut_receptor: s.rut || null, razon_social: s.recep?.rzn || null, total: dteTotales(s).total,
    datos: JSON.parse(JSON.stringify({ ...s, borradorId: undefined })), editado_en: ahora, editado_por: dteUsuario() };
  try {
    let r;
    if (s.borradorId) {
      r = await sb(`dte_borradores?id=eq.${s.borradorId}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
      // Si alguien lo borró mientras tanto, se crea de nuevo.
      if (r.ok && !(await r.clone().json()).length) r = null;
    }
    if (!r) r = await sb('dte_borradores', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...fila, creado_por: dteUsuario() }) });
    if (!r.ok) throw new Error('error ' + r.status);
    const [b] = await r.json();
    s.borradorId = b.id;
    dteGuardarBorrador(t);
    dteRender(t);
    toast('Borrador guardado correctamente.');
    dteBorradores().catch(() => {});
  } catch (e) {
    toast('No se pudo guardar el borrador: ' + e.message, 'err');
  } finally { dteGuardandoBorr = false; }
}

async function dteAbrirBorrador(id) {
  const r = await sb(`dte_borradores?id=eq.${id}&select=*`);
  const [b] = r.ok ? await r.json() : [];
  if (!b) { toast('Ese borrador ya no existe.', 'err'); dteBorradoresRender(); return; }
  const t = b.tipo;
  const actual = dteEstado[t] || dteCargarBorrador(t);
  if (actual && !actual.borradorId && dteTieneDatos(actual)
      && !confirm(`Tienes una ${DTE_NOMBRES[t]} a medio escribir que no está guardada como borrador. ¿Reemplazarla por este borrador?`)) return;
  dteEstado[t] = { ...dteNuevo(t), ...b.datos, borradorId: b.id };
  dteGuardarBorrador(t);
  irAModuloPagina('documentos', DTE_PAGINAS[t]);
}

async function dteQuitarDeBorradores(id) {
  if (!id) return true;
  const r = await sb(`dte_borradores?id=eq.${id}`, { method: 'DELETE' });
  [33, 52].forEach(t => { if (dteEstado[t] && dteEstado[t].borradorId === id) { delete dteEstado[t].borradorId; dteGuardarBorrador(t); } });
  if (dteBorrCache) { dteBorrCache = dteBorrCache.filter(b => b.id !== id); dteFabActualizar(); }
  return r.ok;
}
async function dteEliminarBorrador(id) {
  if (!confirm('¿Eliminar este borrador?')) return;
  if (!(await dteQuitarDeBorradores(id))) toast('No se pudo eliminar el borrador.', 'err');
  dteBorradoresRender();
}
async function dteEliminarTodosBorradores() {
  const l = dteBorrCache || [];
  if (!l.length || !confirm(`¿Eliminar los ${l.length} borradores?`)) return;
  for (const b of l) await dteQuitarDeBorradores(b.id);
  dteBorradoresRender();
}

function dteBorradoresInit() { dteBorradoresRender(); }
async function dteBorradoresRender() {
  const cont = document.getElementById('dte-borradores');
  if (!cont) return;
  if (!dteBorrCache) cont.innerHTML = '<div class="dte-card"><div class="empty-state"><span class="spinner"></span><p>Cargando borradores…</p></div></div>';
  let l;
  try { l = await dteBorradores(); }
  catch (e) { cont.innerHTML = `<div class="dte-card"><div class="dte-aviso-caja">${dteEsc(e.message)}</div></div>`; return; }
  const fecha = ts => new Date(ts).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const filas = l.map(b => `<tr class="dte-borr-fila" onclick="dteAbrirBorrador('${b.id}')">
      <td>${fecha(b.creado_en)}<small class="dte-sub">${dteEsc(b.creado_por || '')}</small></td>
      <td>${DTE_TIPO_LARGO[b.tipo] || b.tipo}</td>
      <td>${dteEsc(b.rut_receptor || '—')}</td>
      <td class="dte-borr-rzn">${dteEsc(b.razon_social || '—')}</td>
      <td style="text-align:right">${dteClp(b.total)}</td>
      <td>${fecha(b.editado_en)}<small class="dte-sub">${dteEsc(b.editado_por || '')}</small></td>
      <td class="dte-borr-acc" onclick="event.stopPropagation()">
        <button class="dte-icono" title="Abrir y editar" onclick="dteAbrirBorrador('${b.id}')"><i class="ti ti-pencil"></i></button>
        <button class="dte-icono dte-icono-rojo" title="Eliminar" onclick="dteEliminarBorrador('${b.id}')"><i class="ti ti-trash"></i></button>
      </td></tr>`).join('');
  cont.innerHTML = `
    <div class="dte-card">
      <div class="dte-borr-barra">
        <small class="dte-sub"><i class="ti ti-info-circle"></i> Los borradores se eliminan automáticamente luego de ${DTE_BORR_DIAS} días, y al emitir el documento.</small>
        <div style="display:flex;gap:8px">
          <button class="dte-btn" onclick="dteBorradoresRender()"><i class="ti ti-refresh"></i> Actualizar</button>
          ${l.length ? `<button class="dte-btn dte-btn-suave" onclick="dteEliminarTodosBorradores()"><i class="ti ti-trash"></i> Eliminar todo</button>` : ''}
        </div>
      </div>
      ${l.length ? `<div class="dte-borr-tabla"><table>
        <thead><tr><th>Creado</th><th>Tipo de documento</th><th>RUT receptor</th><th>Razón social</th><th style="text-align:right">Total</th><th>Última edición</th><th></th></tr></thead>
        <tbody>${filas}</tbody></table></div>`
      : `<div class="empty-state"><i class="ti ti-file-pencil"></i><h4>No hay borradores</h4><p>En una factura o guía, aprieta “Guardar borrador” para dejarla pendiente.</p></div>`}
    </div>`;
}

// Botón flotante (abajo a la derecha) con la cantidad de borradores.
// Solo aparece en las páginas de documentos y si hay alguno guardado.
let dtePaginaActual = '';
function dteFabActualizar(pagina) {
  if (pagina !== undefined) {
    const antes = dtePaginaActual;
    dtePaginaActual = pagina;
    // Al entrar a Creación de documentos se consulta cuántos hay.
    if (/^doc-/.test(pagina) && !/^doc-/.test(antes) && pagina !== 'doc-borradores') { dteBorradores().catch(() => {}); return; }
  }
  let fab = document.getElementById('dte-fab');
  const n = (dteBorrCache || []).length;
  const mostrar = n > 0 && /^doc-/.test(dtePaginaActual) && dtePaginaActual !== 'doc-borradores';
  if (!fab) {
    if (!mostrar) return;
    fab = document.createElement('button');
    fab.id = 'dte-fab';
    fab.className = 'dte-fab';
    fab.title = 'Borradores';
    fab.onclick = () => irAModuloPagina('documentos', 'doc-borradores');
    document.body.appendChild(fab);
  }
  fab.innerHTML = `<i class="ti ti-files"></i><span class="dte-fab-n">${n}</span>`;
  fab.style.display = mostrar ? '' : 'none';
}

function dteInit(tipo) {
  if (!dteEstado[tipo]) {
    const b = dteCargarBorrador(tipo);
    dteEstado[tipo] = b && b.tipo === tipo ? { ...dteNuevo(tipo), ...b } : dteNuevo(tipo);
    // Borradores anteriores guardaban el vencimiento como fecha: pasa a texto.
    dteEstado[tipo].det.forEach(d => { if (d.venc && !d.dsc) d.dsc = 'V:' + dteDmy(d.venc); delete d.venc; if (d.dsc === undefined) d.dsc = ''; });
    if (!dteEstado[tipo].refact) dteEstado[tipo].refact = { on: false, folio: '' };
    const tr = dteEstado[tipo].trans;
    if (!tr.patente && !tr.rutTrans && !tr.nombreChofer) Object.assign(tr, DTE_TRANSPORTE);
  }
  dteRender(tipo);
  if (!dteModoServidor) dteCargarModo().then(() => dteRender(tipo));
  // Los nombres facturados se cargan una vez; al llegar se actualiza la lista.
  if (typeof cargarItemsFacturasVenta === 'function' && !dteCatalogo) {
    cargarItemsFacturasVenta().then(() => { dteArmarCatalogo(); dteActualizarListaProductos(tipo); }).catch(() => {});
  }
}

function dteLimpiar(tipo) {
  if (!confirm(`¿Empezar una ${DTE_NOMBRES[tipo]} nueva? Se borra lo escrito.`)) return;
  dteEstado[tipo] = dteNuevo(tipo);
  dteGuardarBorrador(tipo);
  dteRender(tipo);
}

// Guarda un valor por ruta ("recep.rzn", "det.2.qty") sin redibujar todo,
// para no perder el foco mientras se escribe.
function dteSet(t, ruta, valor, redibujar) {
  const partes = ruta.split('.');
  let o = dteEstado[t];
  for (let i = 0; i < partes.length - 1; i++) o = o[partes[i]];
  o[partes[partes.length - 1]] = valor;
  dteGuardarBorrador(t);
  if (redibujar) dteRender(t); else dteActualizarCalculos(t);
}

// ── Receptor: al poner el RUT se traen los datos de su última factura o guía
// emitida en GDExpress (razón social, giro, dirección, comuna, ciudad).
async function dteBuscarRut(t, valor) {
  const s = dteEstado[t];
  if (dteRutLimpio(valor) === s.rut && s.recep.rzn) return;   // ya cargado
  s.rut = dteRutLimpio(valor);
  if (!s.rut) { s.recepInfo = ''; dteRender(t); return; }
  if (!dteRutValido(s.rut)) { s.recepInfo = 'El RUT no es válido (revisa el dígito verificador).'; dteRender(t); return; }
  s.recepInfo = 'Buscando datos del receptor…';
  dteRender(t);
  try {
    const res = await sb(`documentos_gdexpress?select=tipo_dte,fecha_emision,xml_completo&rut_hospital=eq.${encodeURIComponent(s.rut)}&xml_completo=not.is.null&order=fecha_emision.desc&limit=5`);
    const docs = res.ok ? await res.json() : [];
    const doc = docs.find(d => /<Receptor>/.test(d.xml_completo || ''));
    if (!doc) {
      s.recepInfo = 'No hay documentos anteriores de este RUT: completa los datos a mano.';
    } else {
      const x = new DOMParser().parseFromString(doc.xml_completo, 'application/xml');
      const tx = tag => (x.getElementsByTagName(tag)[0]?.textContent || '').trim();
      s.recep = { rzn: tx('RznSocRecep'), giro: tx('GiroRecep'), dir: tx('DirRecep'), cmna: tx('CmnaRecep'), ciudad: tx('CiudadRecep') };
      s.recepInfo = `Datos tomados de la ${doc.tipo_dte === '52' ? 'guía' : doc.tipo_dte === '61' ? 'nota de crédito' : 'factura'} del ${dteDmy(doc.fecha_emision)}.`;
      // La dirección de despacho parte igual a la del receptor (editable).
      const g = dteBuscarComuna(s.recep.cmna);
      s.dest = { dir: s.recep.dir, region: g ? g.region : '', ciudad: g ? g.provincia : s.recep.ciudad, cmna: g ? g.comuna : s.recep.cmna };
    }
  } catch (e) {
    s.recepInfo = 'No se pudieron traer los datos: ' + e.message;
  }
  dteGuardarBorrador(t);
  dteRender(t);
}

function dteBuscarComuna(nombre) {
  const n = dteNorm(nombre);
  if (!n) return null;
  for (const [region, provs] of DTE_GEO) for (const [provincia, comunas] of provs) {
    const c = comunas.find(c => dteNorm(c) === n);
    if (c) return { region, provincia, comuna: c };
  }
  return null;
}

// ── Órdenes de compra del RUT y sus productos ────────────────────────────
function dteOcsDelRut(rut) {
  if (!rut || typeof oc === 'undefined') return [];
  return oc.filter(o => dteRutLimpio(rutDeHospital(o.hospital)) === rut)
    .sort((a, b) => String(b.fechaoc).localeCompare(String(a.fechaoc)));
}

// Nombre corto para la factura: la especificación de la OC suele traer el
// producto y después condiciones ("debe contener…", "elaborado por…",
// "vence…", "despacho…"); se deja solo el producto (el SII permite 80).
function dteNombreItem(it) {
  const txt = String(it.especificacionproveedor || it.especificacioncomprador || it.productomp || '').replace(/\s+/g, ' ').trim();
  const corto = txt.split(/\s(?:debe|elaborado|elaborada|vence|vencimiento|despacho|envasado|envasada|marca|adjuntar|monto|favor|c[oó]digo)\b|[;:[\]]|,\s/i)[0].trim();
  return (corto || txt).slice(0, 60).trim();
}

// ── Nombres de producto: los de la facturación, no los de la OC ──────────
// 1) Si la OC ya se facturó, se usan los nombres de esa factura (con su
//    precio); cada uno se asocia al ítem de la OC de igual precio, para el
//    aviso de cantidad.
// 2) Si un ítem de la OC nunca se facturó, se busca entre todo lo facturado
//    el nombre más parecido (mismo principio activo, forma y concentración).
// 3) Si no hay nada parecido, queda el texto de la OC para editarlo a mano.
let dteCatalogo = null;   // { porOC: {codigo: [{nombre, precio}]}, nombres: [{nombre, tokens, veces, precio}] }

const DTE_STOP = new Set(['DE', 'DEL', 'LA', 'LAS', 'EL', 'LOS', 'Y', 'EN', 'CON', 'SIN', 'POR', 'PARA', 'AL', 'A', 'X', 'C', 'S', 'O', 'U', 'E', 'N', 'UNA', 'UN']);
// Unidades y envases: no definen el producto (sí sus números).
const DTE_UNIDADES = new Set(['MG', 'ML', 'G', 'GR', 'GRS', 'GRAMO', 'GRAMOS', 'MCG', 'UG', 'UI', 'L', 'LT', 'LTS', 'CC', 'KG', 'KILO', 'UN', 'UND', 'CAP', 'CAPS', 'CP', 'COMP', 'MEQ', 'MM', 'CM',
  'FCO', 'FC', 'FCOS', 'FRASCO', 'FRASCOS', 'POTE', 'PT', 'SACHET', 'SOBRE', 'SOBRES', 'BOLSA', 'ENVASE', 'CAJA', 'POLVO', 'USP', 'NO']);
// Abreviaturas y terminaciones que se escriben de distintas formas.
const DTE_SINONIMOS = { PEG: 'POLIETILENGLICOL', AC: 'ACIDO', SOL: 'SOLUCION', BICARB: 'BICARBONATO', NAC: 'ACETILCISTEINA' };
const dteRaiz = w => DTE_SINONIMOS[w] || w.replace(/(ICO|ICA)$/, 'IO');
function dteTokens(texto, soloNumerosDe) {
  // Fuera códigos de OC/catálogo (10-100-215-231-00, 2150171, $2170002$) y decimales con coma.
  const limpiar = x => dteNorm(x).replace(/\$[^$]*\$/g, ' ').replace(/\b\d+(?:-\d+){2,}\b/g, ' ').replace(/\b\d{5,}\b/g, ' ').replace(/(\d),(\d)/g, '$1.$2');
  const partir = x => limpiar(x).replace(/(\d)([A-Z])/g, '$1 $2').replace(/([A-Z])(\d)/g, '$1 $2').split(/[^A-Z0-9.]+/).map(w => w.replace(/^\.+|\.+$/g, '')).filter(Boolean);
  const nucleo = [], numeros = [];
  partir(texto).forEach(w => {
    if (/^[\d.]+$/.test(w)) { if (!soloNumerosDe) numeros.push(String(Number(w))); }
    else if (!DTE_STOP.has(w) && !DTE_UNIDADES.has(w) && w.length > 1) nucleo.push(dteRaiz(w));
  });
  if (soloNumerosDe) partir(soloNumerosDe).forEach(w => { if (/^[\d.]+$/.test(w)) numeros.push(String(Number(w))); });
  return { nucleo, numeros };
}
const dteCoincide = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a)));

function dteArmarCatalogo() {
  if (typeof facturaItemsRaw === 'undefined' || typeof documentosGdexpress === 'undefined') return;
  const ocPorDoc = new Map();
  documentosGdexpress.forEach(d => {
    if (d.tipo_dte === '33' && d.orden_compra_ref && (typeof estadoAceptacionFusionado !== 'function' || estadoAceptacionFusionado(d) !== 'N')) ocPorDoc.set(d.id, { oc: d.orden_compra_ref, folio: Number(d.folio) || 0 });
  });
  const porOC = {}, nombres = new Map();
  facturaItemsRaw.forEach(it => {
    const nombre = String(it.nombre_producto || '').trim();
    if (!nombre) return;
    const precio = Number(it.precio_unitario) || 0;
    const n = nombres.get(nombre) || { nombre, veces: 0, precio: 0, tokens: dteTokens(nombre) };
    n.veces++; if (precio) n.precio = precio;
    nombres.set(nombre, n);
    const ref = ocPorDoc.get(it.documento_id);
    if (!ref) return;
    const lista = porOC[ref.oc] || (porOC[ref.oc] = []);
    const ya = lista.find(x => x.nombre === nombre);
    if (ya) { if (ref.folio >= ya.folio) { ya.precio = precio || ya.precio; ya.folio = ref.folio; } }
    else lista.push({ nombre, precio, folio: ref.folio });
  });
  dteCatalogo = { porOC, nombres: [...nombres.values()] };
}

// El nombre facturado más parecido al texto de un ítem de OC, o null.
// textoOC: todo el texto del ítem (palabras); textoCorto: solo la parte del
// producto, de donde salen los números (para no confundir la presentación
// con fechas, plazos o montos de la OC).
function dteNombreParecido(textoOC, textoCorto) {
  if (!dteCatalogo) return null;
  const a = dteTokens(textoOC, textoCorto || textoOC);
  if (!a.nucleo.length) return null;
  let mejor = null;
  dteCatalogo.nombres.forEach(n => {
    const b = n.tokens;
    if (!b.nucleo.length) return;
    // La primera palabra del nombre facturado (el principio activo) tiene que estar.
    if (!a.nucleo.some(w => dteCoincide(w, b.nucleo[0]))) return;
    const nucleo = b.nucleo.filter(w => a.nucleo.some(x => dteCoincide(w, x))).length / b.nucleo.length;
    if (nucleo < 0.6) return;
    const acierta = b.numeros.filter(x => a.numeros.includes(x)).length;
    const falla = b.numeros.length - acierta;
    const nums = b.numeros.length ? acierta / b.numeros.length + 0.08 * acierta - 0.1 * falla : 0.3;
    const puntaje = nucleo + 0.4 * nums + Math.min(n.veces, 20) / 400;
    if (!mejor || puntaje > mejor.puntaje) mejor = { nombre: n.nombre, puntaje };
  });
  return mejor ? mejor.nombre : null;
}

function dteProductosRefs(s) {
  const codigos = [...new Set(s.refs.filter(r => r.tipo === '801' && r.folio).map(r => r.folio.trim()))];
  const lista = [];
  const agregar = p => { if (p.nombre && !lista.some(x => x.nombre === p.nombre && x.oc === p.oc)) lista.push(p); };
  codigos.forEach(cod => {
    const itemsOC = (typeof items !== 'undefined' ? items : []).filter(i => i.codigooc === cod);
    const facturados = (dteCatalogo && dteCatalogo.porOC[cod]) || [];
    const usados = new Set();
    facturados.forEach(f => {
      // Ítem de la OC con el mismo precio (o el único que tenga).
      let it = itemsOC.find((i, k) => !usados.has(k) && Math.abs((Number(i.preciounitario) || 0) - f.precio) < 0.5);
      if (!it && itemsOC.length === 1) it = itemsOC[0];
      if (it) usados.add(itemsOC.indexOf(it));
      agregar({ nombre: f.nombre, precio: f.precio || (it ? Number(it.preciounitario) : 0), qty: it ? Number(it.cantidad) || null : null, unidad: it ? it.unidad || '' : '', oc: cod, fuente: 'facturada' });
    });
    itemsOC.forEach((i, k) => {
      if (usados.has(k)) return;
      const base = { precio: Number(i.preciounitario) || 0, qty: Number(i.cantidad) || null, unidad: i.unidad || '', oc: cod };
      const corto = [i.especificacionproveedor, i.especificacioncomprador].map(x => dteNombreItem({ especificacionproveedor: x || '' })).join(' ');
      const parecido = dteNombreParecido(`${i.especificacionproveedor || ''} ${i.especificacioncomprador || ''} ${i.productomp || ''}`, corto);
      if (parecido) agregar({ ...base, nombre: parecido, fuente: 'parecido' });
      agregar({ ...base, nombre: dteNombreItem(i), fuente: 'oc' });
    });
  });
  return lista;
}

function dteElegirOC(t, i, valor) {
  const s = dteEstado[t];
  const r = s.refs[i];
  r.folio = valor.trim();
  if (r.tipo === '801') {
    const o = (typeof oc !== 'undefined' ? oc : []).find(o => o.codigooc === r.folio);
    if (o) { r.fecha = dteFechaCL(o.fechaoc); if (!r.razon) r.razon = 'ORDEN DE COMPRA'; }
  }
  dteGuardarBorrador(t);
  // Se actualiza solo lo que cambia: redibujar todo le quitaría el foco al
  // campo que el usuario acaba de tocar.
  const fila = document.querySelectorAll(`#dte-form-${t} .dte-ref-fecha`)[i];
  if (fila) fila.value = r.fecha;
  const razon = document.querySelectorAll(`#dte-form-${t} .dte-ref-razon`)[i];
  if (razon) razon.value = r.razon;
  dteActualizarListaProductos(t);
}

function dteActualizarListaProductos(t) {
  const dl = document.getElementById('dte-prod-' + t);
  if (dl) dl.innerHTML = dteOpcionesProductos(dteProductosRefs(dteEstado[t]));
}

function dteOpcionesProductos(productos) {
  const origen = { facturada: 'facturado en esta OC', parecido: 'parecido a lo facturado antes', oc: 'texto de la OC' };
  return productos.map(p => `<option value="${dteAttr(p.nombre)}" label="${dteAttr(`${origen[p.fuente]} · OC ${p.oc}${p.qty ? ' · ' + p.qty.toLocaleString('es-CL') + ' ' + (p.unidad || 'un.') : ''}${p.precio ? ' · ' + dteClp(p.precio) : ''}`)}"></option>`).join('');
}

function dteElegirProducto(t, i, valor) {
  const s = dteEstado[t];
  const d = s.det[i];
  d.nombre = valor;
  const p = dteProductosRefs(s).find(p => p.nombre === valor);
  if (p) {
    if (p.precio && !Number(d.precio)) d.precio = String(p.precio);
    d.ocMax = p.qty || null;
    d.ocCodigo = p.oc;
  }
  dteGuardarBorrador(t);
  const precio = document.querySelectorAll(`#dte-form-${t} .dte-det-precio`)[i];
  if (precio) precio.value = d.precio;
  const sub = document.querySelectorAll(`#dte-form-${t} .dte-det-oc`)[i];
  if (sub) sub.textContent = d.ocMax ? `OC ${d.ocCodigo}: ${d.ocMax.toLocaleString('es-CL')} unidades` : '';
  dteActualizarCalculos(t);
}

// ── Totales ──────────────────────────────────────────────────────────────
const dteMontoLinea = d => Math.round((Number(String(d.qty).replace(',', '.')) || 0) * (Number(String(d.precio).replace(',', '.')) || 0));
function dteTotales(s) {
  const neto = s.det.reduce((a, d) => a + dteMontoLinea(d), 0);
  const iva = Math.round(neto * 0.19);
  return { neto, iva, total: neto + iva };
}

function dteActualizarCalculos(t) {
  const s = dteEstado[t];
  const tot = dteTotales(s);
  s.det.forEach((d, i) => {
    const m = document.getElementById(`dte-${t}-monto-${i}`);
    if (m) m.textContent = dteClp(dteMontoLinea(d));
    const w = document.getElementById(`dte-${t}-aviso-${i}`);
    if (w) w.textContent = d.ocMax && Number(d.qty) > d.ocMax ? 'No hay suficiente stock para facturar esta cantidad de productos' : '';
  });
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set(`dte-${t}-neto`, dteClp(tot.neto));
  set(`dte-${t}-iva`, dteClp(tot.iva));
  set(`dte-${t}-total`, dteClp(tot.total));
  const mp = document.getElementById(`dte-${t}-mntpago`);
  if (mp) mp.value = dteClp(tot.total);
  const fp = document.getElementById(`dte-${t}-fchpago`);
  if (fp && !s.pago.fchPago) fp.value = s.fchVenc;
  // Indicador de pasos y números de sección: verde cuando la sección está completa.
  const pasos = document.getElementById(`dte-${t}-pasos`);
  if (pasos) pasos.innerHTML = dtePasosHtml(t);
  dteSecciones(t).forEach((x, i) => {
    const num = document.getElementById(`dte-${t}-num-${x.id}`);
    if (num) { num.classList.toggle('ok', x.ok); num.textContent = x.ok ? '✓' : String(i + 1); }
  });
}

// ── Controles ────────────────────────────────────────────────────────────
function dteCampo(label, control, req, ancho) {
  return `<label class="dte-campo"${ancho ? ` style="grid-column:span ${ancho}"` : ''}><span>${label}${req ? ' <b>*</b>' : ''}</span>${control}</label>`;
}
function dteInput(t, ruta, valor, extra = '') {
  return `<input type="text" class="dte-in" value="${dteAttr(valor)}" oninput="dteSet(${t},'${ruta}',this.value)" ${extra}>`;
}
function dteFecha(t, ruta, valor, redibujar) {
  return `<input type="date" class="dte-in" value="${dteAttr(valor)}" onchange="dteSet(${t},'${ruta}',this.value,${redibujar ? 'true' : 'false'})">`;
}
function dteSelect(t, ruta, valor, opciones, redibujar) {
  const ops = opciones.map(([v, l]) => `<option value="${dteAttr(v)}"${String(v) === String(valor) ? ' selected' : ''}>${dteEsc(l)}</option>`).join('');
  return `<select class="dte-in" onchange="dteSet(${t},'${ruta}',this.value,${redibujar ? 'true' : 'false'})">${ops}</select>`;
}

function dteGeoSelects(t, base) {
  const s = dteEstado[t];
  const v = s[base];
  const reg = DTE_GEO.find(r => r[0] === v.region);
  const regiones = [['', 'Seleccione una región'], ...DTE_GEO.map(r => [r[0], r[0].replace(/^Región (de la |de los |del |de )?/i, '').toUpperCase()])];
  const provs = reg ? reg[1] : [];
  let ciudades = [['', 'Seleccione una ciudad'], ...provs.map(p => [p[0], p[0]])];
  if (v.ciudad && !provs.some(p => p[0] === v.ciudad)) ciudades.push([v.ciudad, v.ciudad]);
  const prov = provs.find(p => p[0] === v.ciudad);
  const comunasLista = prov ? prov[1] : provs.flatMap(p => p[1]);
  let comunas = [['', 'Seleccione una comuna'], ...comunasLista.slice().sort((a, b) => a.localeCompare(b, 'es')).map(c => [c, c.toUpperCase()])];
  if (v.cmna && !comunasLista.includes(v.cmna)) comunas.push([v.cmna, v.cmna]);
  return dteCampo('Región', `<select class="dte-in" onchange="dteSetGeo(${t},'${base}','region',this.value)">${regiones.map(([a, b]) => `<option value="${dteAttr(a)}"${a === v.region ? ' selected' : ''}>${dteEsc(b)}</option>`).join('')}</select>`, true)
    + dteCampo('Ciudad', `<select class="dte-in" onchange="dteSetGeo(${t},'${base}','ciudad',this.value)">${ciudades.map(([a, b]) => `<option value="${dteAttr(a)}"${a === v.ciudad ? ' selected' : ''}>${dteEsc(b)}</option>`).join('')}</select>`, true)
    + dteCampo('Comuna', `<select class="dte-in" onchange="dteSetGeo(${t},'${base}','cmna',this.value)">${comunas.map(([a, b]) => `<option value="${dteAttr(a)}"${a === v.cmna ? ' selected' : ''}>${dteEsc(b)}</option>`).join('')}</select>`, true);
}

function dteSetGeo(t, base, campo, valor) {
  const v = dteEstado[t][base];
  v[campo] = valor;
  if (campo === 'region') { v.ciudad = ''; v.cmna = ''; }
  if (campo === 'ciudad') v.cmna = '';
  dteGuardarBorrador(t);
  dteRender(t);
}

function dteAgregarRef(t) { dteEstado[t].refs.push(dteRefNueva()); dteGuardarBorrador(t); dteRender(t); }
function dteQuitarRef(t, i) { dteEstado[t].refs.splice(i, 1); dteGuardarBorrador(t); dteRender(t); }
function dteAgregarDet(t) { dteEstado[t].det.push(dteDetNuevo()); dteGuardarBorrador(t); dteRender(t); }
function dteQuitarDet(t, i) { const s = dteEstado[t]; s.det.splice(i, 1); if (!s.det.length) s.det.push(dteDetNuevo()); dteGuardarBorrador(t); dteRender(t); }

// ── Formulario ───────────────────────────────────────────────────────────
// Una sola página con secciones numeradas y un indicador de pasos arriba que
// se marca en verde a medida que cada sección queda completa.
function dteSecciones(t) {
  const s = dteEstado[t];
  const esFactura = t === 33;
  const lineas = s.det.filter(d => d.nombre.trim() || Number(d.qty) || Number(d.precio));
  const secs = [
    { id: 'doc', nombre: 'Documento', ok: !!s.fchEmis && (!esFactura || !!s.fchVenc) && (!s.refact?.on || /^\d+$/.test(String(s.refact.folio || '').trim())) },
    { id: 'cli', nombre: 'Cliente', ok: dteRutValido(s.rut) && !!(s.recep.rzn.trim() && s.recep.giro.trim() && s.recep.dir.trim() && s.recep.cmna.trim()) },
  ];
  if (!esFactura) secs.push({ id: 'desp', nombre: 'Despacho', ok: !!(s.dest.dir.trim() && s.dest.cmna && s.trans.patente.trim()) });
  secs.push({ id: 'oc', nombre: 'Orden de compra', ok: s.refs.every(r => r.tipo && r.folio.trim() && r.fecha) });
  secs.push({ id: 'prod', nombre: 'Productos', ok: lineas.length > 0 && lineas.every(d => d.nombre.trim() && Number(d.qty) > 0 && Number(d.precio) > 0) });
  if (esFactura) secs.push({ id: 'pago', nombre: 'Pago', ok: !!(s.pago.medio && s.pago.glosa.trim()) });
  return secs;
}

function dtePasosHtml(t) {
  const secs = dteSecciones(t);
  const actual = secs.findIndex(x => !x.ok);
  return secs.map((x, i) => `${i ? '<span class="dte-paso-lin"></span>' : ''}<a class="dte-paso${x.ok ? ' ok' : i === actual ? ' act' : ''}" onclick="document.getElementById('dte-${t}-sec-${x.id}').scrollIntoView({behavior:'smooth',block:'start'})"><i>${x.ok ? '✓' : i + 1}</i>${x.nombre}</a>`).join('')
    + `<span class="dte-paso-lin"></span><span class="dte-paso${actual === -1 ? ' act' : ''}"><i>${secs.length + 1}</i>Revisar y emitir</span>`;
}

function dteSeccion(t, n, id, titulo, ok, cuerpo, nota) {
  return `<section class="dte-card" id="dte-${t}-sec-${id}"><h3 class="dte-h"><span class="dte-num${ok ? ' ok' : ''}" id="dte-${t}-num-${id}">${ok ? '✓' : n}</span>${titulo}${nota ? `<small>${nota}</small>` : ''}</h3>${cuerpo}</section>`;
}

// Fechas: emisión, vencimiento y días de vencimiento, que se calculan entre sí.
function dteSetEmis(t, v) {
  const s = dteEstado[t];
  const dias = dteDiasEntre(s.fchEmis, s.fchVenc);
  s.fchEmis = v;
  if (v && dias !== '') s.fchVenc = dteMasDias(v, dias);
  dteGuardarBorrador(t); dteRender(t);
}
function dteSetDias(t, v) {
  const s = dteEstado[t];
  const n = parseInt(v, 10);
  if (!isNaN(n) && n >= 0 && s.fchEmis) {
    s.fchVenc = dteMasDias(s.fchEmis, n);
    const f = document.getElementById(`dte-${t}-venc`);
    if (f) f.value = s.fchVenc;
    dteGuardarBorrador(t); dteActualizarCalculos(t);
  }
}
function dteSetVenc(t, v) {
  const s = dteEstado[t];
  s.fchVenc = v;
  const d = document.getElementById(`dte-${t}-dias`);
  if (d) d.value = dteDiasEntre(s.fchEmis, v);
  dteGuardarBorrador(t); dteActualizarCalculos(t);
}
function dteSetRefact(t, on) { dteEstado[t].refact.on = on; dteGuardarBorrador(t); dteRender(t); }

// ── Cliente: lista desplegable de RUT conocidos mientras se escribe ─────
let dteClientes = null;
function dteListaClientes() {
  if (dteClientes && dteClientes.length) return dteClientes;
  const mapa = {};
  const agregar = (rut, nombre, fecha) => {
    const r = dteRutLimpio(rut);
    if (!r || !nombre) return;
    if (!mapa[r] || (fecha && fecha > (mapa[r].fecha || ''))) mapa[r] = { rut: r, nombre: String(nombre).trim(), fecha: fecha || mapa[r]?.fecha || '' };
  };
  if (typeof hospitalesMaestro !== 'undefined') hospitalesMaestro.forEach(h => agregar(h.rut, h.nombre_estandar || h.nombre_original));
  if (typeof documentosGdexpress !== 'undefined') documentosGdexpress.forEach(d => agregar(d.rut_hospital, d.hospital, d.fecha_emision));
  dteClientes = Object.values(mapa);
  return dteClientes;
}
const dteRutClave = r => String(r || '').toUpperCase().replace(/[^0-9K]/g, '');
function dteRutSugerir(t, valor) {
  const caja = document.getElementById(`dte-${t}-rut-lista`);
  if (!caja) return;
  const q = dteRutClave(valor);
  if (q.length < 2) { caja.innerHTML = ''; caja.style.display = 'none'; return; }
  const hits = dteListaClientes().filter(c => dteRutClave(c.rut).startsWith(q)).slice(0, 8);
  caja.innerHTML = hits.length
    ? hits.map((c, i) => `<div class="dte-rut-op${i === 0 ? ' sel' : ''}" onmousedown="event.preventDefault();dteElegirCliente(${t},'${dteAttr(c.rut)}')"><b>${dteEsc(c.rut)}</b>${dteEsc(c.nombre)}</div>`).join('')
    : '<div class="dte-rut-vacio">Ningún cliente conocido con ese RUT: al terminar de escribirlo, completa los datos a mano.</div>';
  caja.style.display = 'block';
}
function dteRutTecla(t, ev) {
  if (ev.key === 'Enter') {
    const primera = document.querySelector(`#dte-${t}-rut-lista .dte-rut-op`);
    if (primera) { ev.preventDefault(); primera.dispatchEvent(new MouseEvent('mousedown')); }
    else ev.target.blur();
  }
  if (ev.key === 'Escape') dteRutCerrar(t);
}
function dteRutCerrar(t) { const c = document.getElementById(`dte-${t}-rut-lista`); if (c) c.style.display = 'none'; }
function dteElegirCliente(t, rut) {
  dteRutCerrar(t);
  // Se deja el RUT completo en el campo antes de buscar, para que el "change"
  // del campo (al perder el foco) no vuelva a buscar con lo escrito a medias.
  const inp = document.getElementById(`dte-${t}-rut`);
  if (inp) inp.value = rut;
  const s = dteEstado[t];
  if (dteRutLimpio(rut) === s.rut && s.recep.rzn) return;
  dteBuscarRut(t, rut);
}

function dteRender(t) {
  const cont = document.getElementById('dte-form-' + t);
  if (!cont) return;
  const s = dteEstado[t];
  const esFactura = t === 33;
  const ocs = dteOcsDelRut(s.rut);
  const productos = dteProductosRefs(s);
  const tot = dteTotales(s);
  const secs = dteSecciones(t);
  const ok = id => (secs.find(x => x.id === id) || {}).ok;
  let n = 0;

  const dias = dteDiasEntre(s.fchEmis, s.fchVenc);
  const documento = `
    <div class="dte-grid dte-grid-doc">
      ${dteCampo('Tipo de documento', `<input class="dte-in" value="${esFactura ? 'Factura Afecta (33)' : 'Guía de despacho (52)'}" disabled>`)}
      ${dteCampo('Fecha de emisión', `<input type="date" class="dte-in" value="${dteAttr(s.fchEmis)}" onchange="dteSetEmis(${t},this.value)">`, true)}
      ${dteCampo('Días de vencimiento', `<input type="number" min="0" step="1" class="dte-in" id="dte-${t}-dias" value="${dteAttr(dias)}" oninput="dteSetDias(${t},this.value)" placeholder="30">`)}
      ${dteCampo('Fecha de vencimiento', `<input type="date" class="dte-in" id="dte-${t}-venc" value="${dteAttr(s.fchVenc)}" onchange="dteSetVenc(${t},this.value)">`, esFactura)}
      ${esFactura
        ? dteCampo('Forma de pago', dteSelect(t, 'fmaPago', s.fmaPago, DTE_FORMAS_PAGO), true)
        : dteCampo('Tipo de traslado', dteSelect(t, 'indTraslado', s.indTraslado, DTE_TRASLADOS), true) + dteCampo('Tipo de despacho', dteSelect(t, 'tipoDespacho', s.tipoDespacho, DTE_DESPACHOS), true)}
    </div>
    ${esFactura ? `<div class="dte-refact">
      <label class="dte-switch"><input type="checkbox" ${s.refact.on ? 'checked' : ''} onchange="dteSetRefact(${t},this.checked)"><span></span> ¿Es refacturación?</label>
      ${s.refact.on ? `<div class="dte-refact-campo">${dteCampo('N° de la factura que reemplaza', `<input type="text" inputmode="numeric" class="dte-in" value="${dteAttr(s.refact.folio)}" placeholder="22354" oninput="dteSet(${t},'refact.folio',this.value.replace(/\\D/g,''))">`, true)}
        <small class="dte-sub">Se agregará en la descripción del último producto: “- ESTA FACTURA REEMPLAZA A LA N° ${dteEsc(s.refact.folio || '…')}”.</small></div>` : ''}
    </div>` : ''}`;

  const conocido = dteListaClientes().find(c => c.rut === s.rut);
  const cliente = `
    <div class="dte-grid dte-grid-cli">
      <div class="dte-rut-wrap">${dteCampo('RUT del cliente', `<input type="text" class="dte-in dte-rut" id="dte-${t}-rut" autocomplete="off" placeholder="Escribe el RUT, ej. 65075485-9" value="${dteAttr(s.rut)}" oninput="dteRutSugerir(${t},this.value)" onfocus="dteRutSugerir(${t},this.value)" onkeydown="dteRutTecla(${t},event)" onblur="setTimeout(()=>dteRutCerrar(${t}),150)" onchange="dteBuscarRut(${t},this.value)">`, true)}
        <div class="dte-rut-lista" id="dte-${t}-rut-lista"></div></div>
      ${dteCampo('Razón social', dteInput(t, 'recep.rzn', s.recep.rzn), true, 2)}
      ${dteCampo('Giro', dteInput(t, 'recep.giro', s.recep.giro, 'maxlength="40"'), true)}
      ${dteCampo('Dirección', dteInput(t, 'recep.dir', s.recep.dir), true, 2)}
      ${dteCampo('Comuna', dteInput(t, 'recep.cmna', s.recep.cmna), true)}
      ${dteCampo('Ciudad', dteInput(t, 'recep.ciudad', s.recep.ciudad), false)}
    </div>
    ${s.rut && dteRutValido(s.rut) && (s.recep.rzn || conocido) ? `<div class="dte-cliente-ok"><span class="ti ti-building-hospital"></span> <b>${dteEsc(s.recep.rzn || conocido?.nombre || '')}</b>${ocs.length ? ` · ${ocs.length} orden${ocs.length === 1 ? '' : 'es'} de compra en el programa` : ''}</div>` : ''}
    ${s.recepInfo ? `<div class="dte-info">${dteEsc(s.recepInfo)}</div>` : ''}`;

  const despacho = esFactura ? '' : `
      <div class="dte-grid">
        ${dteCampo('Dirección de despacho', dteInput(t, 'dest.dir', s.dest.dir), true, 2)}
        ${dteGeoSelects(t, 'dest')}
      </div>
      <div class="dte-sep">Transporte</div>
      <div class="dte-grid">
        ${dteCampo('Patente', dteInput(t, 'trans.patente', s.trans.patente, 'placeholder="ABCD-12"'), true)}
        ${dteCampo('RUT transportista', dteInput(t, 'trans.rutTrans', s.trans.rutTrans), false)}
        ${dteCampo('RUT chofer', dteInput(t, 'trans.rutChofer', s.trans.rutChofer), false)}
        ${dteCampo('Nombre chofer', dteInput(t, 'trans.nombreChofer', s.trans.nombreChofer), false)}
        ${dteCampo('Fecha salida', dteFecha(t, 'trans.fchSalida', s.trans.fchSalida), false)}
        ${dteCampo('Hora salida', `<input type="time" step="1" class="dte-in" value="${dteAttr(s.trans.hraSalida)}" onchange="dteSet(${t},'trans.hraSalida',this.value)">`, false)}
        ${dteCampo('Fecha llegada', dteFecha(t, 'trans.fchLlegada', s.trans.fchLlegada), false)}
      </div>`;

  const refs = `
      ${s.refs.length ? `<div class="dte-tabla dte-refs">
        <div class="dte-th">Tipo de documento <b>*</b></div><div class="dte-th">N° / Folio <b>*</b></div><div class="dte-th">Fecha <b>*</b></div><div class="dte-th">Razón</div><div></div>
        ${s.refs.map((r, i) => `
          <div>${dteSelect(t, `refs.${i}.tipo`, r.tipo, DTE_TIPOS_REF, true)}</div>
          <div><input type="text" class="dte-in" list="dte-ocs-${t}" value="${dteAttr(r.folio)}" placeholder="${r.tipo === '801' ? (ocs.length ? 'Elige la OC de la lista' : 'Primero ingresa el RUT del cliente') : ''}" onchange="dteElegirOC(${t},${i},this.value)"></div>
          <div><input type="date" class="dte-in dte-ref-fecha" value="${dteAttr(r.fecha)}" onchange="dteSet(${t},'refs.${i}.fecha',this.value)"></div>
          <div><input type="text" class="dte-in dte-ref-razon" maxlength="90" value="${dteAttr(r.razon)}" oninput="dteSet(${t},'refs.${i}.razon',this.value)"></div>
          <div><button class="dte-quitar" onclick="dteQuitarRef(${t},${i})" title="Quitar" aria-label="Quitar referencia"><i class="ti ti-trash"></i></button></div>`).join('')}
      </div>` : `<div class="dte-info">${esFactura ? 'Sin orden de compra: la factura no hará referencia a ningún documento.' : 'Sin referencias. Agrega una si la guía corresponde a una orden de compra.'}</div>`}
      <button class="dte-agregar" onclick="dteAgregarRef(${t})"><i class="ti ti-plus"></i> ${s.refs.length ? 'Agregar otra referencia' : 'Agregar orden de compra'}</button>
      <datalist id="dte-ocs-${t}">${ocs.map(o => `<option value="${dteAttr(o.codigooc)}" label="${dteAttr(dteDmy(dteFechaCL(o.fechaoc)) + ' · ' + dteClp(o.totaloc) + (o.nombreoc ? ' · ' + String(o.nombreoc).slice(0, 40) : ''))}"></option>`).join('')}</datalist>`;

  // Cada producto en un bloque de dos líneas: lo principal arriba (producto,
  // cantidad, precio, subtotal) y lo complementario abajo (código, vencimiento,
  // unidad), para que quepa cómodo en un notebook.
  const detalle = `
      <div class="dte-prods">
        ${s.det.map((d, i) => `
        <div class="dte-prod">
          <div class="dte-prod-n">${i + 1}</div>
          <div class="dte-prod-l1">
            <label class="dte-campo"><span>Producto <b>*</b></span><input type="text" class="dte-in" list="dte-prod-${t}" maxlength="80" value="${dteAttr(d.nombre)}" placeholder="${productos.length ? 'Elige un producto de la OC o escribe' : 'Nombre del producto'}" oninput="dteSet(${t},'det.${i}.nombre',this.value)" onchange="dteElegirProducto(${t},${i},this.value)">
              <small class="dte-sub dte-det-oc">${d.ocMax ? `OC ${dteEsc(d.ocCodigo)}: ${d.ocMax.toLocaleString('es-CL')} unidades` : ''}</small></label>
            <label class="dte-campo"><span>Cantidad <b>*</b></span><input type="number" min="0" step="any" class="dte-in" value="${dteAttr(d.qty)}" oninput="dteSet(${t},'det.${i}.qty',this.value)"><small class="dte-aviso" id="dte-${t}-aviso-${i}"></small></label>
            <label class="dte-campo"><span>Precio unit. <b>*</b></span><input type="number" min="0" step="any" class="dte-in dte-det-precio" value="${dteAttr(d.precio)}" oninput="dteSet(${t},'det.${i}.precio',this.value)"></label>
            <div class="dte-campo"><span>Subtotal</span><div class="dte-subtotal" id="dte-${t}-monto-${i}">${dteClp(dteMontoLinea(d))}</div></div>
          </div>
          <div class="dte-prod-l2">
            <label class="dte-campo"><span>Tipo cód.</span>${dteInput(t, `det.${i}.tpoCod`, d.tpoCod, 'maxlength="10"')}</label>
            <label class="dte-campo"><span>Código</span>${dteInput(t, `det.${i}.cod`, d.cod, 'maxlength="35" placeholder="7236/26"')}</label>
            <label class="dte-campo"><span>Vencimiento</span>${dteInput(t, `det.${i}.dsc`, d.dsc, 'maxlength="1000" placeholder="V:30-11-2026" title="Se envía como Descripción del producto en GDExpress"')}</label>
            <label class="dte-campo"><span>Unidad</span>${dteInput(t, `det.${i}.unidad`, d.unidad, 'maxlength="4"')}</label>
          </div>
          <button class="dte-quitar dte-prod-x" onclick="dteQuitarDet(${t},${i})" title="Quitar producto" aria-label="Quitar producto">✕</button>
        </div>`).join('')}
      </div>
      <button class="dte-agregar" onclick="dteAgregarDet(${t})"><i class="ti ti-plus"></i> Agregar producto</button>
      <datalist id="dte-prod-${t}">${dteOpcionesProductos(productos)}</datalist>`;

  const pago = !esFactura ? '' : `
      <div class="dte-grid">
        ${dteCampo('Medio de pago', dteSelect(t, 'pago.medio', s.pago.medio, DTE_MEDIOS_PAGO), true)}
        ${dteCampo('Fecha de pago', `<input type="date" class="dte-in" id="dte-${t}-fchpago" value="${dteAttr(s.pago.fchPago || s.fchVenc)}" onchange="dteSet(${t},'pago.fchPago',this.value)">`, true)}
        ${dteCampo('Monto', `<input class="dte-in" id="dte-${t}-mntpago" value="${dteClp(tot.total)}" disabled>`, true)}
        ${dteCampo('Glosa de pago', dteInput(t, 'pago.glosa', s.pago.glosa, 'maxlength="100"'), false, 3)}
      </div>`;

  const m = dteModoServidor;
  const modo = !m ? '' : !m.ok || !m.configurado
    ? '<div class="dte-modo-mini err">Sin conexión con GDExpress</div>'
    : m.ambiente === 'P' ? '<div class="dte-modo-mini p">● PRODUCCIÓN: se emite ante el SII</div>' : '<div class="dte-modo-mini t">● PRUEBAS (homologación): no es real</div>';

  cont.innerHTML = `
    <nav class="dte-pasos" id="dte-${t}-pasos">${dtePasosHtml(t)}</nav>
    <div class="dte-layout">
      <div class="dte-main">
        ${dteSeccion(t, ++n, 'doc', 'Documento', ok('doc'), documento)}
        ${dteSeccion(t, ++n, 'cli', 'Cliente', ok('cli'), cliente, 'Escribe el RUT y elige el cliente de la lista')}
        ${esFactura ? '' : dteSeccion(t, ++n, 'desp', 'Despacho', ok('desp'), despacho, 'Parte con la dirección del cliente; se puede cambiar')}
        ${dteSeccion(t, ++n, 'oc', 'Orden de compra', ok('oc'), refs)}
        ${dteSeccion(t, ++n, 'prod', 'Productos', ok('prod'), detalle, productos.length ? 'De la orden de compra elegida' : '')}
        ${esFactura ? dteSeccion(t, ++n, 'pago', 'Pago', ok('pago'), pago) : ''}
      </div>
      <aside class="dte-aside">
        <div class="dte-card dte-totales">
          <div class="dte-tot-tit">Resumen</div>
          <div><span>Neto</span><b id="dte-${t}-neto">${dteClp(tot.neto)}</b></div>
          <div><span>IVA 19%</span><b id="dte-${t}-iva">${dteClp(tot.iva)}</b></div>
          <div class="dte-total"><span>Total</span><b id="dte-${t}-total">${dteClp(tot.total)}</b></div>
          <button class="dte-btn-principal" onclick="dteEmitir(${t})"><i class="ti ti-eye-check"></i> Revisar y emitir</button>
          <button class="dte-btn" onclick="dteGuardarComoBorrador(${t})"><i class="ti ti-device-floppy"></i> Guardar borrador</button>
          <button class="dte-btn dte-btn-suave" onclick="dteLimpiar(${t})"><i class="ti ti-eraser"></i> Empezar de nuevo</button>
          ${modo}
          <small class="dte-sub">${s.borradorId ? '<i class="ti ti-file-pencil"></i> Está en Borradores. Si cambias algo, vuelve a apretar “Guardar borrador”.' : ''}</small>
        </div>
      </aside>
    </div>`;
  dteActualizarCalculos(t);
}

// ── XML del DTE (formato SII, mismo molde que los documentos ya emitidos) ─
function dteValidar(s) {
  const err = [];
  if (!dteRutValido(s.rut)) err.push('RUT del receptor válido');
  if (!s.recep.rzn.trim()) err.push('razón social');
  if (!s.recep.giro.trim()) err.push('giro');
  if (!s.recep.dir.trim()) err.push('dirección');
  if (!s.recep.cmna.trim()) err.push('comuna');
  if (!s.fchEmis) err.push('fecha de emisión');
  s.refs.forEach((r, i) => { if (!r.tipo || !r.folio.trim() || !r.fecha) err.push(`referencia ${i + 1} completa (tipo, folio y fecha)`); });
  const lineas = s.det.filter(d => d.nombre.trim() || Number(d.qty) || Number(d.precio));
  if (!lineas.length) err.push('al menos un producto');
  lineas.forEach((d, i) => { if (!d.nombre.trim() || !(Number(d.qty) > 0) || !(Number(d.precio) > 0)) err.push(`producto ${i + 1} con nombre, cantidad y precio`); });
  if (s.tipo === 33 && s.refact?.on && !/^\d+$/.test(String(s.refact.folio || '').trim())) err.push('N° de la factura que se reemplaza');
  if (s.tipo === 52) {
    if (!s.dest.dir.trim() || !s.dest.cmna) err.push('dirección y comuna de despacho');
    if (!s.trans.patente.trim()) err.push('patente');
  }
  return err;
}

function dteXml(s) {
  const tot = dteTotales(s);
  const e = (tag, v) => (v === '' || v === null || v === undefined) ? '' : `<${tag}>${dteEsc(v)}</${tag}>`;
  const lineas = dteLineas(s);
  const pagoXml = s.tipo === 33
    ? `<MntPagos><FchPago>${s.pago.fchPago || s.fchVenc}</FchPago><MntPago>${tot.total}</MntPago>${e('GlosaPagos', s.pago.glosa.trim())}</MntPagos>${e('MedioPago', s.pago.medio)}`
    : '';
  const idDoc = s.tipo === 33
    ? `<TipoDTE>33</TipoDTE><Folio>0</Folio><FchEmis>${s.fchEmis}</FchEmis><TpoTranVenta>1</TpoTranVenta><FmaPago>${s.fmaPago}</FmaPago>${pagoXml}${e('FchVenc', s.fchVenc)}`
    : `<TipoDTE>52</TipoDTE><Folio>0</Folio><FchEmis>${s.fchEmis}</FchEmis><TipoDespacho>${s.tipoDespacho}</TipoDespacho><IndTraslado>${s.indTraslado}</IndTraslado><TpoTranVenta>1</TpoTranVenta>${e('FchVenc', s.fchVenc)}`;
  const transporte = s.tipo !== 52 ? '' : `<Transporte>${e('Patente', s.trans.patente.trim().toUpperCase())}${e('RUTTrans', dteRutLimpio(s.trans.rutTrans))}${s.trans.rutChofer || s.trans.nombreChofer ? `<Chofer>${e('RUTChofer', dteRutLimpio(s.trans.rutChofer))}${e('NombreChofer', s.trans.nombreChofer.trim())}</Chofer>` : ''}${e('DirDest', s.dest.dir.trim())}${e('CmnaDest', s.dest.cmna.toUpperCase())}${e('CiudadDest', s.dest.ciudad)}${e('FchSalida', s.trans.fchSalida)}${e('HraSalida', s.trans.hraSalida)}${e('FchLlegada', s.trans.fchLlegada)}</Transporte>`;
  const detalle = lineas.map((d, i) => `<Detalle><NroLinDet>${i + 1}</NroLinDet>${d.cod.trim() ? `<CdgItem>${e('TpoCodigo', (d.tpoCod || 'INT').trim())}${e('VlrCodigo', d.cod.trim())}</CdgItem>` : ''}${e('NmbItem', d.nombre.trim())}${e('DscItem', (d.dsc || '').trim())}<QtyItem>${Number(d.qty)}</QtyItem>${e('UnmdItem', (d.unidad || '').trim())}<PrcItem>${Number(d.precio)}</PrcItem><MontoItem>${dteMontoLinea(d)}</MontoItem></Detalle>`).join('');
  const refs = s.refs.map((r, i) => `<Referencia><NroLinRef>${i + 1}</NroLinRef>${e('TpoDocRef', r.tipo)}${e('FolioRef', r.folio.trim())}${e('FchRef', r.fecha)}${e('RazonRef', r.razon.trim())}</Referencia>`).join('');
  return `<?xml version="1.0" encoding="ISO-8859-1"?>
<DTE version="1.0"><Documento ID="T${s.tipo}F0"><Encabezado><IdDoc>${idDoc}</IdDoc><Emisor>${e('RUTEmisor', DTE_EMISOR.rut)}${e('RznSoc', DTE_EMISOR.rzn)}${e('GiroEmis', DTE_EMISOR.giro)}${e('Acteco', DTE_EMISOR.acteco)}${e('Sucursal', DTE_EMISOR.sucursal)}${e('DirOrigen', DTE_EMISOR.dir)}${e('CmnaOrigen', DTE_EMISOR.cmna)}${e('CiudadOrigen', DTE_EMISOR.ciudad)}</Emisor><Receptor>${e('RUTRecep', s.rut)}${e('RznSocRecep', s.recep.rzn.trim().slice(0, 100))}${e('GiroRecep', s.recep.giro.trim().slice(0, 40))}${e('DirRecep', s.recep.dir.trim().slice(0, 70))}${e('CmnaRecep', s.recep.cmna.trim().toUpperCase())}${e('CiudadRecep', s.recep.ciudad.trim())}</Receptor>${transporte}<Totales><MntNeto>${tot.neto}</MntNeto><MntExe>0</MntExe><TasaIVA>19</TasaIVA><IVA>${tot.iva}</IVA><MntTotal>${tot.total}</MntTotal></Totales></Encabezado>${detalle}${refs}</Documento></DTE>`;
}

function dteModal(titulo, cuerpo, pie) {
  cerrarTodosLosModales();
  document.querySelectorAll('#dte-modal-overlay').forEach(m => m.remove());
  const m = document.createElement('div');
  m.className = 'modal-overlay';
  m.id = 'dte-modal-overlay';
  m.onclick = ev => { if (ev.target === m) m.remove(); };
  m.innerHTML = `<div class="modal-shell modal-xl" style="max-width:900px" onclick="event.stopPropagation()">
    <div class="modal-header"><div><div class="modal-title">${titulo}</div></div><button class="modal-close" onclick="document.getElementById('dte-modal-overlay').remove()" aria-label="Cerrar">✕</button></div>
    <div class="modal-body">${cuerpo}</div>${pie ? `<div class="modal-footer">${pie}</div>` : ''}</div>`;
  document.body.appendChild(m);
}

function dteVerXml(t) {
  const s = dteEstado[t];
  const err = dteValidar(s);
  const xml = dteXml(s).replace(/></g, '>\n<');
  dteModal(`XML de la ${DTE_NOMBRES[t]}`, `${err.length ? `<div class="dte-aviso-caja">Falta completar: ${dteEsc(err.join(', '))}.</div>` : ''}
    <pre class="dte-xml">${dteEsc(xml)}</pre>`);
}

function dteEmitir(t) { dteVistaPrevia(t); }

// Llama a la función del servidor que habla con GDExpress (la llave nunca
// pasa por el navegador). Devuelve { ok, ambiente, folio, pdfBase64?, pdfUrl?, error? }.
async function dteFuncion(cuerpo) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/emitir-dte`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sesionActual?.access_token || SUPABASE_KEY}`, 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  let d = {};
  try { d = await r.json(); } catch (e) { d = { ok: false, error: `El servidor respondió ${r.status}` }; }
  return d;
}

// Modo de emisión (homologación o producción) para mostrarlo antes de enviar.
let dteModoServidor = null;
async function dteCargarModo() {
  try { dteModoServidor = await dteFuncion({ accion: 'estado' }); } catch (e) { dteModoServidor = { ok: false }; }
  const el = document.getElementById('dte-modo');
  if (el) el.outerHTML = dteModoHtml();
}
function dteModoHtml() {
  const m = dteModoServidor;
  if (!m) return '<div class="dte-modo" id="dte-modo">Revisando la conexión con GDExpress…</div>';
  if (!m.ok) return '<div class="dte-modo dte-modo-err" id="dte-modo">No se pudo contactar la función de emisión.</div>';
  if (!m.configurado) return '<div class="dte-modo dte-modo-err" id="dte-modo">Falta guardar la llave de GDExpress en Supabase: todavía no se puede enviar.</div>';
  return m.ambiente === 'P'
    ? '<div class="dte-modo dte-modo-p" id="dte-modo"><b>PRODUCCIÓN</b> · el documento se emite de verdad ante el SII.</div>'
    : '<div class="dte-modo dte-modo-t" id="dte-modo"><b>HOMOLOGACIÓN (pruebas)</b> · el documento no es real ni va al SII como venta.</div>';
}

let dteEnviando = false;
async function dteEnviar(t) {
  const s = dteEstado[t];
  if (dteEnviando || dteValidar(s).length) return;
  if (s.det.some(d => d.ocMax && Number(d.qty) > d.ocMax) && !confirm('Hay productos con más cantidad que la orden de compra. ¿Continuar igual?')) return;
  if (dteModoServidor && dteModoServidor.ambiente === 'P' && !confirm(`Se va a emitir una ${DTE_NOMBRES[t]} REAL ante el SII por ${dteClp(dteTotales(s).total)}. ¿Confirmas?`)) return;
  dteEnviando = true;
  const btn = document.querySelector('#dte-modal-overlay .dte-btn-principal');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-color:rgba(255,255,255,.4);border-top-color:#fff"></span> Enviando…'; }
  let r;
  try { r = await dteFuncion({ tipo: t, xml: dteXml(s) }); }
  catch (e) { r = { ok: false, error: 'No se pudo conectar con el servidor: ' + e.message }; }
  dteEnviando = false;
  if (!r.ok || !r.folio) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-send"></i> Enviar'; }
    dteModal('No se pudo emitir', `<div class="dte-aviso-caja">${dteEsc(r.error || (r.ok ? 'GDExpress aceptó el documento pero no devolvió el folio.' : 'Error desconocido.'))}</div>
      ${/foliado/i.test(r.error || '') ? '<p style="font-size:13px">No es un error del documento: GDExpress tiene que habilitar en su sistema la asignación automática de folios (punto de foliado local) para el RUT de Bulfor. Hay que pedírselo a su soporte. No se emitió nada ni se usó ningún folio.</p>' : ''}
      <p style="font-size:13px;color:var(--text-2)">El borrador sigue guardado: puedes corregirlo y volver a enviarlo.</p>
      ${r.respuesta ? `<pre class="dte-xml">${dteEsc(JSON.stringify(r.respuesta, null, 2))}</pre>` : ''}`);
    return;
  }
  dteMostrarEmitido(t, r);
  // Emitido: el formulario parte de nuevo para no enviarlo dos veces,
  // y su borrador sale del listado.
  dteQuitarDeBorradores(s.borradorId);
  dteEstado[t] = dteNuevo(t);
  dteGuardarBorrador(t);
  dteRender(t);
}

// ── Hoja del documento (vista previa y emitido) ──────────────────────────
// Imita el PDF de GDExpress. En la vista previa el folio es 0 y lleva la
// marca "VISTA PREVIA"; el documento emitido muestra su folio, pero el que
// vale para imprimir es el PDF oficial de GDExpress (trae el timbre del SII).
const DTE_EMISOR_HOJA = { giro: 'Farmacia y Droguería', dir: 'Coquimbo - 35, 1 - Santiago', email: 'genoveva@farmaciabulfor.cl', fono: '22 6355809', sii: 'S.I.I. - SANTIAGO CENTRO' };
const DTE_TITULOS = { 33: 'FACTURA ELECTRONICA', 52: 'GUIA DE DESPACHO ELECTRONICA' };
const DTE_NOMBRE_REF = { ...Object.fromEntries(DTE_TIPOS_REF.map(([v, l]) => [v, l.replace(/^\S+ · /, '')])), 801: 'Orden de Compra' };
const DTE_HOJA_CSS = `
.dh-hoja { position: relative; background: #fff; color: #111; width: 780px; max-width: 100%; margin: 0 auto; padding: 28px 30px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; box-sizing: border-box; }
.dh-cab { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
.dh-emisor { display: flex; gap: 12px; align-items: flex-start; }
.dh-emisor img { width: 168px; height: auto; }
.dh-emisor h1 { font-size: 16px; margin: 0 0 4px; line-height: 1.2; }
.dh-emisor div { font-size: 13px; line-height: 1.35; }
.dh-caja { border: 2.5px solid #D0021B; color: #D0021B; text-align: center; padding: 12px 18px; min-width: 250px; font-weight: 700; }
.dh-caja div { margin: 6px 0; font-size: 14px; }
.dh-sii { color: #D0021B; text-align: center; font-weight: 700; font-size: 12px; margin-top: 8px; }
.dh-tabla { width: 100%; border-collapse: collapse; margin-top: 12px; }
.dh-tabla th, .dh-tabla td { border: 1px solid #111; padding: 3px 6px; text-align: left; vertical-align: top; font-size: 10.5px; }
.dh-tabla th { background: #fff !important; color: #111 !important; font-weight: 700; text-align: center; text-transform: none; letter-spacing: 0; white-space: nowrap; }
.dh-hoja td { color: #111; }
.dh-datos { border: 1px solid #111; margin-top: 14px; padding: 6px 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
.dh-datos div { display: grid; grid-template-columns: 92px 10px 1fr; font-size: 10.5px; line-height: 1.55; }
.dh-datos b { font-weight: 700; }
.dh-titulo { font-weight: 700; font-size: 10.5px; margin-top: 10px; }
.dh-det td { height: 18px; }
.dh-det .dh-relleno td { height: 120px; }
.dh-num { text-align: right !important; white-space: nowrap; }
.dh-pie { display: flex; justify-content: space-between; gap: 18px; margin-top: 14px; align-items: flex-start; }
.dh-timbre { width: 330px; border: 1px dashed #999; color: #555; text-align: center; padding: 16px 10px; font-size: 10px; line-height: 1.5; }
.dh-totales { min-width: 240px; border: 1px solid #111; }
.dh-totales div { display: flex; justify-content: space-between; padding: 3px 8px; font-size: 11px; }
.dh-totales div:last-child { font-weight: 700; border-top: 1px solid #111; }
.dh-pago { font-size: 10.5px; margin-top: 8px; }
.dh-marca { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; font-size: 86px; font-weight: 800; color: rgba(208, 2, 27, .08); transform: rotate(-28deg); letter-spacing: 6px; }
@media print { @page { size: A4; margin: 10mm; } body { margin: 0; } .dh-hoja { width: auto; padding: 0; } }`;

function dteRutPuntos(rut) {
  const m = /^(\d+)-([\dK])$/.exec(rut || '');
  return m ? Number(m[1]).toLocaleString('es-CL') + '-' + m[2] : (rut || '');
}
function dteFechaLarga(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return `${d.getDate()} de ${d.toLocaleDateString('es-CL', { month: 'long' })} del ${d.getFullYear()}`;
}
const dteNum = n => (Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 3 });

function dteHojaHtml(s, folio) {
  const tot = dteTotales(s);
  const lineas = dteLineas(s);
  const fila = (k, v) => `<div><b>${k}</b><span>:</span><span>${dteEsc(v || '')}</span></div>`;
  const forma = dteNorm((DTE_FORMAS_PAGO.find(f => f[0] === s.fmaPago) || [, ''])[1]);
  const izquierda = fila('SEÑOR(ES)', s.recep.rzn) + fila('R.U.T.', s.rut) + fila('DIRECCIÓN', s.recep.dir) + fila('GIRO', s.recep.giro)
    + (s.tipo === 52 ? fila('TRASLADO', (DTE_TRASLADOS.find(x => x[0] === s.indTraslado) || [, ''])[1].toUpperCase()) : fila('VENDEDOR', ''));
  const derecha = fila('FECHA EMISIÓN', dteFechaLarga(s.fchEmis)) + fila('FECHA VENC.', dteFechaLarga(s.fchVenc)) + fila('COMUNA', s.recep.cmna)
    + (s.tipo === 33 ? fila('FORMA DE PAGO', forma) : fila('DESPACHO', (DTE_DESPACHOS.find(x => x[0] === s.tipoDespacho) || [, ''])[1].toUpperCase())) + fila('CIUDAD', s.recep.ciudad) + fila('CONTACTO', '');
  const transporte = s.tipo !== 52 ? '' : `<div class="dh-titulo">TRANSPORTE</div>
    <table class="dh-tabla" style="margin-top:2px"><tr><th>DIRECCIÓN DESTINO</th><th>COMUNA</th><th>CIUDAD</th><th>PATENTE</th><th>CHOFER</th></tr>
    <tr><td>${dteEsc(s.dest.dir)}</td><td>${dteEsc(String(s.dest.cmna || '').toUpperCase())}</td><td>${dteEsc(s.dest.ciudad)}</td><td>${dteEsc(s.trans.patente)}</td><td>${dteEsc(s.trans.nombreChofer)} ${s.trans.rutChofer ? '(' + dteEsc(s.trans.rutChofer) + ')' : ''}</td></tr></table>`;
  const refs = s.refs.length ? `<div class="dh-titulo">DOCUMENTOS</div>
    <table class="dh-tabla" style="margin-top:2px"><tr><th>TIPO DOCUMENTO</th><th>FOLIO</th><th>FECHA</th><th>RAZON REF</th></tr>
    ${s.refs.map(r => `<tr><td>${dteEsc(DTE_NOMBRE_REF[r.tipo] || r.tipo)}</td><td style="text-align:center">${dteEsc(r.folio)}</td><td style="text-align:center">${dteDmy(r.fecha)}</td><td>${dteEsc(r.razon)}</td></tr>`).join('')}</table>` : '';
  return `<div class="dh-hoja">
    ${folio ? '' : '<div class="dh-marca">VISTA PREVIA</div>'}
    <div class="dh-cab">
      <div class="dh-emisor"><img src="logo-bulfor.jpg" alt="Farmacia Bulfor">
        <div><h1>SOCIEDAD FARMACEUTICA<br>BULFOR LIMITADA</h1>
          <div>Giro: ${DTE_EMISOR_HOJA.giro}<br>Dirección: ${DTE_EMISOR_HOJA.dir}<br>E-mail: ${DTE_EMISOR_HOJA.email}<br>Teléfono: ${DTE_EMISOR_HOJA.fono}</div></div></div>
      <div><div class="dh-caja"><div>R.U.T.: ${dteRutPuntos(DTE_EMISOR.rut)}</div><div>${DTE_TITULOS[s.tipo]}</div><div>Nº ${folio || 0}</div></div><div class="dh-sii">${DTE_EMISOR_HOJA.sii}</div></div>
    </div>
    <div class="dh-datos"><div style="display:block">${izquierda}</div><div style="display:block">${derecha}</div></div>
    ${transporte}
    ${refs}
    <table class="dh-tabla dh-det"><tr><th style="width:90px">CÓDIGO</th><th>DETALLE</th><th style="width:34px">UM</th><th style="width:70px">CANTIDAD</th><th style="width:76px">PRECIO</th><th style="width:84px">Total</th></tr>
      ${lineas.map(d => `<tr><td style="text-align:center">${d.cod.trim() ? dteEsc((d.tpoCod || '').trim() + ' - ' + d.cod.trim()) : ''}</td><td>${dteEsc(d.nombre)}${d.dsc && d.dsc.trim() ? '<br>' + dteEsc(d.dsc.trim()).replace(/\n/g, '<br>') : ''}</td><td style="text-align:center">${dteEsc(d.unidad)}</td><td class="dh-num">${dteNum(d.qty)}</td><td class="dh-num">${(Number(d.precio) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="dh-num">${dteNum(dteMontoLinea(d))}</td></tr>`).join('')}
      <tr class="dh-relleno"><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    </table>
    <div class="dh-pie">
      <div><div class="dh-timbre">${folio ? 'Timbre Electrónico SII<br>(en el PDF oficial de GDExpress)' : 'Timbre Electrónico SII<br>Se genera al emitir el documento'}<br>Res. ${DTE_RESOLUCION.numero} de ${DTE_RESOLUCION.fecha.slice(0, 4)} · Verifique documento: www.sii.cl</div>
        ${s.tipo === 33 ? `<div class="dh-pago"><b>Pago:</b> ${dteEsc((DTE_MEDIOS_PAGO.find(m => m[0] === s.pago.medio) || [, ''])[1])} · ${dteDmy(s.pago.fchPago || s.fchVenc)}<br>${dteEsc(s.pago.glosa)}</div>` : ''}</div>
      <div class="dh-totales"><div><span>MONTO NETO $</span><span>${dteNum(tot.neto)}</span></div><div><span>MONTO EXENTO $</span><span>0</span></div><div><span>I.V.A. 19% $</span><span>${dteNum(tot.iva)}</span></div><div><span>TOTAL $</span><span>${dteNum(tot.total)}</span></div></div>
    </div>
  </div>`;
}

function dteEstilosHoja() {
  if (document.getElementById('dte-hoja-css')) return;
  const st = document.createElement('style');
  st.id = 'dte-hoja-css';
  st.textContent = DTE_HOJA_CSS;
  document.head.appendChild(st);
}

// Imprime solo la hoja, en un iframe aparte (sin el resto de la app).
function dteImprimirHoja(html) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const base = location.href.replace(/[^/]*$/, '');
  f.contentDocument.open();
  f.contentDocument.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${base}"><style>${DTE_HOJA_CSS}</style></head><body>${html}</body></html>`);
  f.contentDocument.close();
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1000); }, 300);
}

function dteDetallesHtml(s) {
  const tot = dteTotales(s);
  const fila = (k, v) => `<tr><td>${k}</td><td>${dteEsc(v || '')}</td></tr>`;
  return `<div class="dte-detalles">
    <div class="dte-card"><h3>${DTE_TITULOS[s.tipo].replace(' ELECTRONICA', '')}${s.tipo === 33 ? ' AFECTA' : ''}</h3>
      <p>Emitida el ${dteDmy(s.fchEmis)}, por un monto de ${dteClp(tot.total)}.</p><p>Número de folio pendiente de asignación: GDExpress lo asigna al enviar.</p></div>
    <div class="dte-detalles-2">
      <div class="dte-card"><h3>Emisor</h3><table class="clinical-grid">${fila('RUT', DTE_EMISOR.rut)}${fila('Razón social', DTE_EMISOR.rzn.trim())}${fila('Giro', DTE_EMISOR.giro)}${fila('Dirección', DTE_EMISOR.dir)}${fila('Comuna', DTE_EMISOR.cmna)}</table></div>
      <div class="dte-card"><h3>Receptor</h3><table class="clinical-grid">${fila('RUT', s.rut)}${fila('Razón social', s.recep.rzn)}${fila('Giro', s.recep.giro)}${fila('Dirección', s.recep.dir)}${fila('Comuna', s.recep.cmna)}</table></div>
      <div class="dte-card"><h3>Totales</h3><table class="clinical-grid">${fila('Monto neto', dteClp(tot.neto))}${fila('Monto exento', '$ 0')}${fila('IVA', dteClp(tot.iva))}${fila('Monto total', dteClp(tot.total))}</table></div>
      ${s.tipo === 52 ? `<div class="dte-card"><h3>Transporte</h3><table class="clinical-grid">${fila('Dirección', s.dest.dir)}${fila('Comuna', s.dest.cmna)}${fila('Ciudad', s.dest.ciudad)}${fila('Chofer', s.trans.nombreChofer)}${fila('Patente', s.trans.patente)}</table></div>` : ''}
    </div></div>`;
}

function dteTabs(id, tabs) {
  return `<div class="modal-tabs" style="position:static;padding:0;margin-bottom:12px">${tabs.map(([k, l], i) => `<div class="modal-tab${i === 0 ? ' active' : ''}" onclick="dteTab('${id}','${k}',this)">${l}</div>`).join('')}</div>`
    + tabs.map(([k, , html], i) => `<div class="modal-tab-panel${i === 0 ? ' active' : ''}" data-tab="${id}-${k}">${html}</div>`).join('');
}
function dteTab(id, k, el) {
  el.parentElement.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t === el));
  document.querySelectorAll(`[data-tab^="${id}-"]`).forEach(p => p.classList.toggle('active', p.dataset.tab === `${id}-${k}`));
}

// Vista previa: lo que se va a enviar, con N° 0, antes de emitir.
function dteVistaPrevia(t) {
  const s = dteEstado[t];
  dteCargarModo();
  const err = dteValidar(s);
  dteEstilosHoja();
  const xml = dteXml(s).replace(/></g, '>\n<');
  dteModal(`Vista previa de la ${DTE_NOMBRES[t]}`, `
    ${dteModoHtml()}
    ${err.length ? `<div class="dte-aviso-caja">Falta completar antes de enviar: ${dteEsc(err.join(', '))}.</div>` : ''}
    ${dteTabs('dtevp', [['det', 'Detalles del documento', dteDetallesHtml(s)], ['doc', 'Ver documento', `<div class="dte-papel">${dteHojaHtml(s, 0)}</div>`], ['xml', 'Ver XML', `<pre class="dte-xml">${dteEsc(xml)}</pre>`]])}`,
    `<button class="dte-btn" style="width:auto;padding:0 16px" onclick="dteImprimirHoja(dteHojaHtml(dteEstado[${t}],0))"><i class="ti ti-printer"></i> Imprimir vista previa</button>
     <button class="dte-btn" style="width:auto;padding:0 16px" onclick="document.getElementById('dte-modal-overlay').remove()">Cancelar</button>
     <button class="dte-btn-principal" style="width:auto;padding:0 22px;margin:0" ${err.length ? 'disabled title="Completa los campos que faltan"' : ''} onclick="dteEnviar(${t})"><i class="ti ti-send"></i> Enviar</button>`);
}

// Documento ya emitido: se muestra e imprime el PDF de GDExpress tal cual
// (con su logo y el timbre del SII). La hoja de la app es solo la vista previa.
// resultado = { folio, pdfBase64?, pdfUrl? } (lo devuelve la función del servidor).
function dteMostrarEmitido(t, resultado) {
  const s = dteEstado[t];
  const titulo = `${DTE_TITULOS[s.tipo].replace(' ELECTRONICA', '')} N° ${resultado.folio}`;
  window._dteUltimoEmitido = { t, tipo: s.tipo, folio: resultado.folio, ambiente: resultado.ambiente, titulo, pdfSrc: '', pdfUrl: '' };
  dteModal(`${titulo} emitida`, `
    <div class="dte-ok"><i class="ti ti-circle-check"></i> ${titulo} emitida correctamente${resultado.ambiente === 'T' ? ' en HOMOLOGACIÓN (prueba, no es un documento real)' : ''}.</div>
    <div id="dte-emitido-pdf"></div>`,
    `<span id="dte-emitido-botones" style="display:contents"></span>
     <button class="dte-btn" style="width:auto;padding:0 16px" onclick="dteCerrarEmitido()">Cerrar</button>`);
  dteMostrarPdf(resultado);
  // GDExpress publica el documento unos minutos después de emitirlo: si el
  // PDF todavía no está, se vuelve a pedir solo cada 20 segundos (hasta 6 min).
  if (!resultado.pdfBase64 && !resultado.pdfUrl) dteEsperarPdf(0);
}

let dteEsperaPdf = null;
function dteCerrarEmitido() { clearTimeout(dteEsperaPdf); document.getElementById('dte-modal-overlay')?.remove(); }

function dteMostrarPdf(r) {
  const u = window._dteUltimoEmitido;
  const caja = document.getElementById('dte-emitido-pdf'), botones = document.getElementById('dte-emitido-botones');
  if (!u || !caja) return false;
  if (r.pdfBase64) {
    const bytes = Uint8Array.from(atob(r.pdfBase64), c => c.charCodeAt(0));
    u.pdfSrc = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  }
  if (r.pdfUrl) u.pdfUrl = r.pdfUrl;
  if (u.pdfSrc) {
    caja.innerHTML = `<iframe class="dte-pdf" src="${dteAttr(u.pdfSrc)}" title="PDF de GDExpress"></iframe>`;
    botones.innerHTML = `<button class="dte-btn-principal" style="width:auto;padding:0 22px;margin:0" onclick="dteImprimirPdf()"><i class="ti ti-printer"></i> Imprimir</button>
      <a class="dte-btn" style="width:auto;padding:0 16px;text-decoration:none" href="${dteAttr(u.pdfSrc)}" download="${u.tipo === 33 ? 'Factura' : 'Guia'}_${u.folio}.pdf"><i class="ti ti-download"></i> Descargar PDF</a>`;
    return true;
  }
  if (u.pdfUrl) {
    // GDExpress dio el enlace pero no se pudo traer el archivo: se abre en su portal.
    caja.innerHTML = `<div class="dte-aviso-caja" style="background:var(--green-light,#E8F5EE);color:var(--green,#2D6A4F)">El PDF oficial ya está disponible en GDExpress.</div>`;
    botones.innerHTML = `<a class="dte-btn-principal" style="width:auto;padding:0 22px;margin:0;text-decoration:none;display:inline-flex;align-items:center;gap:6px" href="${dteAttr(u.pdfUrl)}" target="_blank" rel="noopener"><i class="ti ti-file-type-pdf"></i> Abrir PDF para imprimir</a>`;
    return true;
  }
  caja.innerHTML = `<div class="dte-aviso-caja" style="display:flex;align-items:center;gap:10px"><span class="spinner" style="width:16px;height:16px;flex-shrink:0"></span>
    <span>GDExpress está preparando el PDF oficial (suele tardar unos minutos). Se mostrará aquí solo; puedes dejar esta ventana abierta.</span></div>`;
  botones.innerHTML = `<button class="dte-btn" style="width:auto;padding:0 16px" onclick="dteEsperarPdf(0)"><i class="ti ti-refresh"></i> Buscar ahora</button>`;
  return false;
}

async function dteEsperarPdf(intento) {
  clearTimeout(dteEsperaPdf);
  const u = window._dteUltimoEmitido;
  if (!u || !document.getElementById('dte-emitido-pdf')) return;
  let r = {};
  try { r = await dteFuncion({ accion: 'pdf', tipo: u.tipo, folio: u.folio, ambiente: u.ambiente }); } catch (e) { /* se reintenta */ }
  if (dteMostrarPdf(r || {})) return;
  if (intento < 18) { dteEsperaPdf = setTimeout(() => dteEsperarPdf(intento + 1), 20000); return; }
  const caja = document.getElementById('dte-emitido-pdf');
  if (caja) caja.innerHTML = `<div class="dte-aviso-caja">GDExpress todavía no publica este documento. Revísalo más tarde en Facturas → Documentos, o en el portal de GDExpress (folio ${dteEsc(u.folio)}).</div>`;
}

function dteImprimirPdf() {
  const u = window._dteUltimoEmitido;
  if (!u || !u.pdfSrc) return;
  const f = document.querySelector('#dte-modal-overlay iframe.dte-pdf');
  try { f.contentWindow.focus(); f.contentWindow.print(); }
  catch (e) { window.open(u.pdfSrc, '_blank'); }   // si el visor no deja imprimir desde aquí, se abre en otra pestaña
}
