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
const dteDetNuevo = () => ({ tpoCod: 'RM', cod: '', nombre: '', venc: '', qty: '', unidad: 'UN', precio: '', ocMax: null, ocCodigo: '' });

function dteNuevo(tipo) {
  const hoy = fechaLocalISO();
  return {
    tipo, fchEmis: hoy, fchVenc: dteMasDias(hoy, 30), fmaPago: '2', indTraslado: '2', tipoDespacho: '1',
    rut: '', recepInfo: '', recep: { rzn: '', giro: '', dir: '', cmna: '', ciudad: '' },
    dest: { dir: '', region: '', ciudad: '', cmna: '' },
    trans: { patente: '', rutTrans: '', rutChofer: '', nombreChofer: '', fchSalida: hoy, hraSalida: dteHora(), fchLlegada: hoy },
    refs: tipo === 33 ? [dteRefNueva()] : [],
    det: [dteDetNuevo()],
    pago: { medio: 'PE', fchPago: '', glosa: DTE_GLOSA_PAGO },
  };
}

// Borrador por tipo: se guarda en este navegador para no perder lo escrito.
function dteGuardarBorrador(t) { try { localStorage.setItem('bulfor_dte_' + t, JSON.stringify(dteEstado[t])); } catch (e) { /* sin almacenamiento */ } }
function dteCargarBorrador(t) { try { const s = localStorage.getItem('bulfor_dte_' + t); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

function dteInit(tipo) {
  if (!dteEstado[tipo]) {
    const b = dteCargarBorrador(tipo);
    dteEstado[tipo] = b && b.tipo === tipo ? { ...dteNuevo(tipo), ...b } : dteNuevo(tipo);
    if (tipo === 52 && !dteEstado[tipo].trans.patente) dteTransporteAnterior(tipo);
  }
  dteRender(tipo);
}

function dteLimpiar(tipo) {
  if (!confirm(`¿Empezar una ${DTE_NOMBRES[tipo]} nueva? Se borra lo escrito.`)) return;
  dteEstado[tipo] = dteNuevo(tipo);
  dteGuardarBorrador(tipo);
  if (tipo === 52) dteTransporteAnterior(tipo);
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

// Transporte (patente y chofer) de la última guía emitida, como punto de partida.
async function dteTransporteAnterior(t) {
  try {
    const res = await sb(`documentos_gdexpress?select=xml_completo&tipo_dte=eq.52&xml_completo=not.is.null&order=fecha_emision.desc,folio.desc&limit=1`);
    const d = res.ok ? (await res.json())[0] : null;
    if (!d) return;
    const x = new DOMParser().parseFromString(d.xml_completo, 'application/xml');
    const tx = tag => (x.getElementsByTagName(tag)[0]?.textContent || '').trim();
    const s = dteEstado[t];
    if (s.trans.patente) return;
    Object.assign(s.trans, { patente: tx('Patente'), rutTrans: tx('RUTTrans'), rutChofer: tx('RUTChofer'), nombreChofer: tx('NombreChofer') });
    dteGuardarBorrador(t);
    if (document.getElementById('dte-form-' + t)) dteRender(t);
  } catch (e) { /* sin transporte previo */ }
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
  const corto = txt.split(/\s(?:debe|elaborado|elaborada|vence|vencimiento|despacho|envasado|envasada|marca)\b|[,;:]/i)[0].trim();
  return (corto || txt).slice(0, 60).trim();
}

function dteProductosRefs(s) {
  const codigos = s.refs.filter(r => r.tipo === '801' && r.folio).map(r => r.folio.trim());
  const lista = [];
  codigos.forEach(cod => {
    (typeof items !== 'undefined' ? items : []).filter(i => i.codigooc === cod).forEach(i => {
      lista.push({ nombre: dteNombreItem(i), qty: Number(i.cantidad) || 0, unidad: i.unidad || '', precio: Number(i.preciounitario) || 0, oc: cod });
    });
    // Nombres usados en facturas anteriores de esa misma OC.
    ((typeof nombresFacturaPorOC !== 'undefined' && nombresFacturaPorOC[cod]) || []).forEach(n => {
      if (!lista.some(p => p.nombre === n)) lista.push({ nombre: n, qty: null, precio: null, oc: cod, usado: true });
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
  return productos.map(p => `<option value="${dteAttr(p.nombre)}" label="${dteAttr(p.usado ? 'usado en facturas de la OC ' + p.oc : `OC ${p.oc} · ${p.qty.toLocaleString('es-CL')} ${p.unidad || 'un.'} · ${dteClp(p.precio)}`)}"></option>`).join('');
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
    if (m) m.value = dteClp(dteMontoLinea(d));
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
function dteRender(t) {
  const cont = document.getElementById('dte-form-' + t);
  if (!cont) return;
  const s = dteEstado[t];
  const esFactura = t === 33;
  const ocs = dteOcsDelRut(s.rut);
  const productos = dteProductosRefs(s);
  const tot = dteTotales(s);

  const docCampos = esFactura
    ? dteCampo('Tipo de documento', `<input class="dte-in" value="Factura afecta sin despacho (33)" disabled>`, false, 2)
      + dteCampo('Fecha emisión', dteFecha(t, 'fchEmis', s.fchEmis), true)
      + dteCampo('Fecha vencimiento', dteFecha(t, 'fchVenc', s.fchVenc), true)
      + dteCampo('Forma de pago', dteSelect(t, 'fmaPago', s.fmaPago, DTE_FORMAS_PAGO), true)
      + dteCampo('Tipo venta', `<input class="dte-in" value="Ventas del giro" disabled>`)
    : dteCampo('Tipo de documento', `<input class="dte-in" value="Guía de despacho electrónica (52)" disabled>`, false, 2)
      + dteCampo('Fecha emisión', dteFecha(t, 'fchEmis', s.fchEmis), true)
      + dteCampo('Fecha vencimiento', dteFecha(t, 'fchVenc', s.fchVenc), false)
      + dteCampo('Tipo de traslado', dteSelect(t, 'indTraslado', s.indTraslado, DTE_TRASLADOS), true)
      + dteCampo('Tipo de despacho', dteSelect(t, 'tipoDespacho', s.tipoDespacho, DTE_DESPACHOS), true);

  const receptor = `
    <div class="dte-grid">
      ${dteCampo('RUT', `<input type="text" class="dte-in" placeholder="61602248-2" value="${dteAttr(s.rut)}" onchange="dteBuscarRut(${t},this.value)">`, true)}
      ${dteCampo('Razón social', dteInput(t, 'recep.rzn', s.recep.rzn), true, 2)}
      ${dteCampo('Giro', dteInput(t, 'recep.giro', s.recep.giro, 'maxlength="40"'), true)}
      ${dteCampo('Dirección', dteInput(t, 'recep.dir', s.recep.dir), true, 2)}
      ${dteCampo('Comuna', dteInput(t, 'recep.cmna', s.recep.cmna), true)}
      ${dteCampo('Ciudad', dteInput(t, 'recep.ciudad', s.recep.ciudad), false)}
    </div>
    ${s.recepInfo ? `<div class="dte-info">${dteEsc(s.recepInfo)}</div>` : ''}
    ${s.rut && dteRutValido(s.rut) ? `<div class="dte-info">${ocs.length ? `${ocs.length} orden${ocs.length === 1 ? '' : 'es'} de compra de este RUT en el programa.` : 'No hay órdenes de compra de este RUT en el programa.'}</div>` : ''}`;

  const despacho = esFactura ? '' : `
    <section class="dte-card">
      <h3>Dirección de despacho</h3>
      <div class="dte-grid">
        ${dteCampo('Dirección', dteInput(t, 'dest.dir', s.dest.dir), true, 2)}
        ${dteGeoSelects(t, 'dest')}
      </div>
    </section>
    <section class="dte-card">
      <h3>Transporte</h3>
      <div class="dte-grid">
        ${dteCampo('Patente', dteInput(t, 'trans.patente', s.trans.patente, 'placeholder="ABCD-12"'), true)}
        ${dteCampo('RUT transportista', dteInput(t, 'trans.rutTrans', s.trans.rutTrans), false)}
        ${dteCampo('RUT chofer', dteInput(t, 'trans.rutChofer', s.trans.rutChofer), false)}
        ${dteCampo('Nombre chofer', dteInput(t, 'trans.nombreChofer', s.trans.nombreChofer), false)}
        ${dteCampo('Fecha salida', dteFecha(t, 'trans.fchSalida', s.trans.fchSalida), false)}
        ${dteCampo('Hora salida', `<input type="time" step="1" class="dte-in" value="${dteAttr(s.trans.hraSalida)}" onchange="dteSet(${t},'trans.hraSalida',this.value)">`, false)}
        ${dteCampo('Fecha llegada', dteFecha(t, 'trans.fchLlegada', s.trans.fchLlegada), false)}
      </div>
    </section>`;

  const refs = `
    <section class="dte-card">
      <h3>Referencias</h3>
      ${s.refs.length ? `<div class="dte-tabla dte-refs">
        <div class="dte-th">Tipo doc. <b>*</b></div><div class="dte-th">Folio <b>*</b></div><div class="dte-th">Fecha <b>*</b></div><div class="dte-th">Razón de referencia</div><div></div>
        ${s.refs.map((r, i) => `
          <div>${dteSelect(t, `refs.${i}.tipo`, r.tipo, DTE_TIPOS_REF, true)}</div>
          <div><input type="text" class="dte-in" list="dte-ocs-${t}" value="${dteAttr(r.folio)}" placeholder="${r.tipo === '801' ? (ocs.length ? 'Elige la OC' : 'Ingresa el RUT para ver sus OC') : ''}" onchange="dteElegirOC(${t},${i},this.value)"></div>
          <div><input type="date" class="dte-in dte-ref-fecha" value="${dteAttr(r.fecha)}" onchange="dteSet(${t},'refs.${i}.fecha',this.value)"></div>
          <div><input type="text" class="dte-in dte-ref-razon" maxlength="90" value="${dteAttr(r.razon)}" oninput="dteSet(${t},'refs.${i}.razon',this.value)"></div>
          <div><button class="dte-quitar" onclick="dteQuitarRef(${t},${i})" title="Quitar referencia" aria-label="Quitar referencia"><i class="ti ti-trash"></i></button></div>`).join('')}
      </div>` : `<div class="dte-info">${esFactura ? 'Sin referencias: la factura no hará referencia a ningún documento.' : 'Sin referencias. Agrega una si la guía corresponde a una orden de compra.'}</div>`}
      <button class="dte-agregar" onclick="dteAgregarRef(${t})"><i class="ti ti-plus"></i> Agregar referencia</button>
      <datalist id="dte-ocs-${t}">${ocs.map(o => `<option value="${dteAttr(o.codigooc)}" label="${dteAttr(dteDmy(dteFechaCL(o.fechaoc)) + ' · ' + dteClp(o.totaloc) + (o.nombreoc ? ' · ' + String(o.nombreoc).slice(0, 40) : ''))}"></option>`).join('')}</datalist>
    </section>`;

  const detalle = `
    <section class="dte-card">
      <h3>Detalle</h3>
      <div class="dte-tabla dte-det">
        <div class="dte-th">Tipo código</div><div class="dte-th">Código</div><div class="dte-th">Nombre del producto <b>*</b></div><div class="dte-th">Vencimiento</div><div class="dte-th">Cantidad <b>*</b></div><div class="dte-th">Unidad</div><div class="dte-th">Precio unitario <b>*</b></div><div class="dte-th">Monto ítem</div><div></div>
        ${s.det.map((d, i) => `
          <div>${dteInput(t, `det.${i}.tpoCod`, d.tpoCod, 'maxlength="10"')}</div>
          <div>${dteInput(t, `det.${i}.cod`, d.cod, 'maxlength="35" placeholder="7236/26"')}</div>
          <div><input type="text" class="dte-in" list="dte-prod-${t}" maxlength="80" value="${dteAttr(d.nombre)}" placeholder="${productos.length ? 'Elige un producto de la OC o escribe' : 'Nombre del producto'}" oninput="dteSet(${t},'det.${i}.nombre',this.value)" onchange="dteElegirProducto(${t},${i},this.value)">
            <small class="dte-sub dte-det-oc">${d.ocMax ? `OC ${dteEsc(d.ocCodigo)}: ${d.ocMax.toLocaleString('es-CL')} unidades` : ''}</small></div>
          <div>${dteFecha(t, `det.${i}.venc`, d.venc)}</div>
          <div><input type="number" min="0" step="any" class="dte-in" value="${dteAttr(d.qty)}" oninput="dteSet(${t},'det.${i}.qty',this.value)"><small class="dte-aviso" id="dte-${t}-aviso-${i}"></small></div>
          <div>${dteInput(t, `det.${i}.unidad`, d.unidad, 'maxlength="4"')}</div>
          <div><input type="number" min="0" step="any" class="dte-in dte-det-precio" value="${dteAttr(d.precio)}" oninput="dteSet(${t},'det.${i}.precio',this.value)"></div>
          <div><input class="dte-in dte-monto" id="dte-${t}-monto-${i}" value="${dteClp(dteMontoLinea(d))}" disabled></div>
          <div><button class="dte-quitar" onclick="dteQuitarDet(${t},${i})" title="Quitar producto" aria-label="Quitar producto"><i class="ti ti-trash"></i></button></div>`).join('')}
      </div>
      <button class="dte-agregar" onclick="dteAgregarDet(${t})"><i class="ti ti-plus"></i> Agregar producto</button>
      <datalist id="dte-prod-${t}">${dteOpcionesProductos(productos)}</datalist>
    </section>`;

  const pago = !esFactura ? '' : `
    <section class="dte-card">
      <h3>Medio de pago</h3>
      <div class="dte-grid">
        ${dteCampo('Medio de pago', dteSelect(t, 'pago.medio', s.pago.medio, DTE_MEDIOS_PAGO), true)}
        ${dteCampo('Fecha de pago', `<input type="date" class="dte-in" id="dte-${t}-fchpago" value="${dteAttr(s.pago.fchPago || s.fchVenc)}" onchange="dteSet(${t},'pago.fchPago',this.value)">`, true)}
        ${dteCampo('Monto', `<input class="dte-in" id="dte-${t}-mntpago" value="${dteClp(tot.total)}" disabled>`, true)}
        ${dteCampo('Glosa de pago', dteInput(t, 'pago.glosa', s.pago.glosa, 'maxlength="100"'), false, 2)}
      </div>
    </section>`;

  cont.innerHTML = `
    <div class="dte-layout">
      <div class="dte-main">
        <section class="dte-card"><h3>Documento</h3><div class="dte-grid">${docCampos}</div></section>
        <section class="dte-card"><h3>Receptor</h3>${receptor}</section>
        ${despacho}
        ${refs}
        ${detalle}
        ${pago}
      </div>
      <aside class="dte-aside">
        <div class="dte-card dte-totales">
          <div><span>Neto</span><b id="dte-${t}-neto">${dteClp(tot.neto)}</b></div>
          <div><span>IVA 19%</span><b id="dte-${t}-iva">${dteClp(tot.iva)}</b></div>
          <div class="dte-total"><span>Total</span><b id="dte-${t}-total">${dteClp(tot.total)}</b></div>
          <button class="dte-btn-principal" onclick="dteEmitir(${t})"><i class="ti ti-send"></i> Emitir ${DTE_NOMBRES[t]}</button>
          <button class="dte-btn" onclick="dteVerXml(${t})"><i class="ti ti-code"></i> Ver XML</button>
          <button class="dte-btn dte-btn-suave" onclick="dteLimpiar(${t})"><i class="ti ti-eraser"></i> Empezar de nuevo</button>
          <small class="dte-sub">El borrador se guarda solo en este navegador.</small>
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
  if (s.tipo === 52) {
    if (!s.dest.dir.trim() || !s.dest.cmna) err.push('dirección y comuna de despacho');
    if (!s.trans.patente.trim()) err.push('patente');
  }
  return err;
}

function dteXml(s) {
  const tot = dteTotales(s);
  const e = (tag, v) => (v === '' || v === null || v === undefined) ? '' : `<${tag}>${dteEsc(v)}</${tag}>`;
  const lineas = s.det.filter(d => d.nombre.trim());
  const pagoXml = s.tipo === 33
    ? `<MntPagos><FchPago>${s.pago.fchPago || s.fchVenc}</FchPago><MntPago>${tot.total}</MntPago>${e('GlosaPagos', s.pago.glosa.trim())}</MntPagos>${e('MedioPago', s.pago.medio)}`
    : '';
  const idDoc = s.tipo === 33
    ? `<TipoDTE>33</TipoDTE><Folio>0</Folio><FchEmis>${s.fchEmis}</FchEmis><TpoTranVenta>1</TpoTranVenta><FmaPago>${s.fmaPago}</FmaPago>${pagoXml}${e('FchVenc', s.fchVenc)}`
    : `<TipoDTE>52</TipoDTE><Folio>0</Folio><FchEmis>${s.fchEmis}</FchEmis><TipoDespacho>${s.tipoDespacho}</TipoDespacho><IndTraslado>${s.indTraslado}</IndTraslado><TpoTranVenta>1</TpoTranVenta>${e('FchVenc', s.fchVenc)}`;
  const transporte = s.tipo !== 52 ? '' : `<Transporte>${e('Patente', s.trans.patente.trim().toUpperCase())}${e('RUTTrans', dteRutLimpio(s.trans.rutTrans))}${s.trans.rutChofer || s.trans.nombreChofer ? `<Chofer>${e('RUTChofer', dteRutLimpio(s.trans.rutChofer))}${e('NombreChofer', s.trans.nombreChofer.trim())}</Chofer>` : ''}${e('DirDest', s.dest.dir.trim())}${e('CmnaDest', s.dest.cmna.toUpperCase())}${e('CiudadDest', s.dest.ciudad)}${e('FchSalida', s.trans.fchSalida)}${e('HraSalida', s.trans.hraSalida)}${e('FchLlegada', s.trans.fchLlegada)}</Transporte>`;
  const detalle = lineas.map((d, i) => `<Detalle><NroLinDet>${i + 1}</NroLinDet>${d.cod.trim() ? `<CdgItem>${e('TpoCodigo', (d.tpoCod || 'INT').trim())}${e('VlrCodigo', d.cod.trim())}</CdgItem>` : ''}${e('NmbItem', d.nombre.trim())}${d.venc ? `<DscItem>V:${dteDmy(d.venc)}</DscItem>` : ''}<QtyItem>${Number(d.qty)}</QtyItem>${e('UnmdItem', (d.unidad || '').trim())}<PrcItem>${Number(d.precio)}</PrcItem><MontoItem>${dteMontoLinea(d)}</MontoItem></Detalle>`).join('');
  const refs = s.refs.map((r, i) => `<Referencia><NroLinRef>${i + 1}</NroLinRef>${e('TpoDocRef', r.tipo)}${e('FolioRef', r.folio.trim())}${e('FchRef', r.fecha)}${e('RazonRef', r.razon.trim())}</Referencia>`).join('');
  return `<?xml version="1.0" encoding="ISO-8859-1"?>
<DTE version="1.0"><Documento ID="T${s.tipo}F0"><Encabezado><IdDoc>${idDoc}</IdDoc><Emisor>${e('RUTEmisor', DTE_EMISOR.rut)}${e('RznSoc', DTE_EMISOR.rzn)}${e('GiroEmis', DTE_EMISOR.giro)}${e('Acteco', DTE_EMISOR.acteco)}${e('Sucursal', DTE_EMISOR.sucursal)}${e('DirOrigen', DTE_EMISOR.dir)}${e('CmnaOrigen', DTE_EMISOR.cmna)}${e('CiudadOrigen', DTE_EMISOR.ciudad)}</Emisor><Receptor>${e('RUTRecep', s.rut)}${e('RznSocRecep', s.recep.rzn.trim().slice(0, 100))}${e('GiroRecep', s.recep.giro.trim().slice(0, 40))}${e('DirRecep', s.recep.dir.trim().slice(0, 70))}${e('CmnaRecep', s.recep.cmna.trim().toUpperCase())}${e('CiudadRecep', s.recep.ciudad.trim())}</Receptor>${transporte}<Totales><MntNeto>${tot.neto}</MntNeto><MntExe>0</MntExe><TasaIVA>19</TasaIVA><IVA>${tot.iva}</IVA><MntTotal>${tot.total}</MntTotal></Totales></Encabezado>${detalle}${refs}</Documento></DTE>`;
}

function dteModal(titulo, cuerpo) {
  cerrarTodosLosModales();
  const m = document.createElement('div');
  m.className = 'modal-overlay';
  m.id = 'dte-modal-overlay';
  m.onclick = ev => { if (ev.target === m) m.remove(); };
  m.innerHTML = `<div class="modal-shell modal-xl" onclick="event.stopPropagation()">
    <div class="modal-header"><div><div class="modal-title">${titulo}</div></div><button class="modal-close" onclick="document.getElementById('dte-modal-overlay').remove()" aria-label="Cerrar">✕</button></div>
    <div class="modal-body">${cuerpo}</div></div>`;
  document.body.appendChild(m);
}

function dteVerXml(t) {
  const s = dteEstado[t];
  const err = dteValidar(s);
  const xml = dteXml(s).replace(/></g, '>\n<');
  dteModal(`XML de la ${DTE_NOMBRES[t]}`, `${err.length ? `<div class="dte-aviso-caja">Falta completar: ${dteEsc(err.join(', '))}.</div>` : ''}
    <pre class="dte-xml">${dteEsc(xml)}</pre>`);
}

function dteEmitir(t) {
  const s = dteEstado[t];
  const err = dteValidar(s);
  if (err.length) {
    dteModal(`No se puede emitir todavía`, `<div class="dte-aviso-caja">Falta completar: ${dteEsc(err.join(', '))}.</div>`);
    return;
  }
  if (s.det.some(d => d.ocMax && Number(d.qty) > d.ocMax) && !confirm('Hay productos con más cantidad que la orden de compra. ¿Continuar igual?')) return;
  dteModal(`Emisión pendiente de conectar`, `<p style="font-size:13px;line-height:1.6">La ${DTE_NOMBRES[t]} está completa y su XML está listo, pero la app todavía no está conectada a GDExpress para emitir.
    Falta crear la función del servidor que guarda la llave de GDExpress y envía el documento (primero en homologación). Mientras tanto, puedes revisar el XML con el botón "Ver XML".</p>`);
}
