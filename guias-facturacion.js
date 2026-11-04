// Guías por facturar: referencias explícitas y agrupaciones revisadas por el equipo.
// No se infiere una asociación por monto, fecha, producto ni proximidad de folios.
const gf = { hospital: '', mes: '', anio: new Date().getFullYear(), vista: 'facturas', docs: [], pagos: [], grupos: [], enlaces: [], referencias: new Map(), xml: new Map(), listo: false, guardado: false, ocupado: false, error: '', pagina: 1 };
const gfRut = v => String(v || '').replace(/[^0-9k]/gi, '').toUpperCase();
const gfEsc = v => panelEsc(String(v ?? ''));
const gfTotal = d => d?.monto_total == null ? null : Number(d.monto_total);
const gfMonto = d => gfTotal(d) == null ? 'Por confirmar' : clp(gfTotal(d));
const gfId = v => String(v);
const gfFechaHora = v => new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(v));
function gfPago(d) { return gf.pagos.find(p => String(p.factura) === String(d.folio) && gfRut(p.rut_hospital) === gfRut(d.rut_hospital)); }
function gfNoVigente(d) {
  const p = gfPago(d);
  return !!(p?.anulada || p?.factura_reemplazo || p?.nota_credito_asociada || d.estado_aceptacion === 'N' || d.estado_reclamo === 'RCD' || gf.docs.some(n => n.tipo_dte === '61' && String(n.nc_factura_ref) === String(d.folio) && gfRut(n.rut_hospital) === gfRut(d.rut_hospital)));
}
function gfReferencias(xml) {
  const dom = new DOMParser().parseFromString(xml || '', 'application/xml');
  if (dom.querySelector('parsererror')) throw new Error('XML no válido; no se puede verificar esta factura.');
  const todos = [...dom.getElementsByTagNameNS('*', 'Referencia')];
  const campo = (el, key) => el.getElementsByTagNameNS('*', key)[0]?.textContent.trim() || '';
  return todos.filter(el => campo(el, 'TpoDocRef') === '52').map(el => campo(el, 'FolioRef')).filter(Boolean);
}
// Lectura completa o error: una página fallida nunca se interpreta como “sin guías”.
async function gfLeer(tabla, query) {
  const filas = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await sb(`${tabla}?${query}`, { headers: { Range: `${offset}-${offset + 999}` } });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw Object.assign(new Error(err.message || `No se pudo leer ${tabla}.`), { code: err.code }); }
    const pagina = await res.json();
    if (!Array.isArray(pagina)) throw new Error('Respuesta incompleta; vuelve a cargar.');
    filas.push(...pagina); if (pagina.length < 1000) return filas;
  }
}
function gfInit() {
  const sel = document.getElementById('gf-hospital'); if (!sel) return;
  const hospitales = new Map();
  documentosGdexpress.filter(d => ['33', '52'].includes(d.tipo_dte) && gfRut(d.rut_hospital)).forEach(d => hospitales.set(gfRut(d.rut_hospital), nombreHosp(d.hospital)));
  sel.innerHTML = '<option value="">Selecciona un hospital</option>' + [...hospitales].sort((a,b) => a[1].localeCompare(b[1])).map(([rut,nombre]) => `<option value="${gfEsc(rut)}">${gfEsc(nombre)}</option>`).join('');
  sel.value = gf.hospital;
  document.getElementById('gf-anio').value = gf.anio;
  gfRender();
}
async function gfCargar() {
  if (gf.ocupado) return;
  gf.hospital = document.getElementById('gf-hospital').value;
  gf.anio = Number(document.getElementById('gf-anio').value);
  if (!gf.hospital || !Number.isInteger(gf.anio) || gf.anio < 2000 || gf.anio > 2100) return toast('Selecciona hospital y año válidos.', 'err');
  gf.ocupado = true; gf.listo = false; gf.guardado = false; gf.error = ''; gf.pagina = 1; gfRender();
  try {
    // Se releen resúmenes y pagos con paginación estricta. Un inicio parcial de
    // la app no debe confundirse con ausencia de documentos o de pagos.
    const base = gf.hospital.slice(0,-1), dv = gf.hospital.slice(-1);
    const ruts = new Set([gf.hospital,`${base}-${dv}`,`${base.replace(/\B(?=(\d{3})+(?!\d))/g,'.')}-${dv}`,...documentosGdexpress.filter(d=>gfRut(d.rut_hospital)===gf.hospital).map(d=>d.rut_hospital)]);
    const filtroRut = `or=(${[...ruts].map(r=>`rut_hospital.eq.${encodeURIComponent(r)}`).join(',')})`;
    const [resumenes,pagos] = await Promise.all([
      gfLeer('documentos_gdexpress',`select=id,tipo_dte,folio,rut_hospital,hospital,fecha_emision,monto_total,orden_compra_ref,estado_aceptacion,estado_reclamo,nc_factura_ref&${filtroRut}&order=id.asc`),
      gfLeer('facturas_pago',`select=factura,rut_hospital,estado_pago,fecha_pago,anulada,factura_reemplazo,nota_credito_asociada&${filtroRut}&order=id.asc`)
    ]);
    gf.docs = resumenes.filter(d=>gfRut(d.rut_hospital)===gf.hospital); gf.pagos=pagos;
    const facturas = gf.docs.filter(d => d.tipo_dte === '33' && !gfNoVigente(d));
    const referencias = new Map();
    for (let i = 0; i < facturas.length; i += 4) {
      await Promise.all(facturas.slice(i, i + 4).map(async d => {
        if (!gf.xml.has(d.id)) {
          const r = await gfLeer('documentos_gdexpress', `select=id,xml_completo&id=eq.${encodeURIComponent(d.id)}`);
          if (!r[0]?.xml_completo) throw new Error(`La factura ${d.folio} no tiene XML disponible; el cruce está incompleto.`);
          gf.xml.set(d.id, r[0].xml_completo);
        }
        referencias.set(d.id, gfReferencias(gf.xml.get(d.id)));
      }));
    }
    gf.referencias = referencias;
    try {
      const [grupos,enlaces] = await Promise.all([gfLeer('guias_facturacion_grupos','select=*&order=factura_id.asc'),gfLeer('guias_facturacion_enlaces','select=*&order=guia_id.asc')]);
      gf.grupos = grupos; gf.enlaces = enlaces; gf.guardado = true;
    } catch (e) {
      if (!['42P01','PGRST205'].includes(e.code)) throw e;
      gf.grupos = []; gf.enlaces = [];
      gf.error = 'El registro compartido de asociaciones aún no está habilitado. Solo se muestran referencias explícitas; los pendientes son provisionales.';
    }
    gf.listo = true;
  } catch(e) { gf.listo = false; gf.error = `Cruce incompleto: ${e.message} No se marcarán guías como pendientes.`; }
  finally { gf.ocupado = false; gfRender(); }
}
function gfGuias() { return gf.docs.filter(d => d.tipo_dte === '52' && String(d.fecha_emision).startsWith(String(gf.anio)) && (!gf.mes || d.fecha_emision.slice(5,7) === gf.mes)); }
function gfGrupo(id) { return gf.grupos.find(g => gfId(g.factura_id) === gfId(id)); }
function gfAsociadas(d) {
  const grupo = gfGrupo(d.id);
  const ids = grupo ? gf.enlaces.filter(e => gfId(e.factura_id) === gfId(d.id)).map(e => gfId(e.guia_id)) : [];
  const folios = gf.referencias.get(d.id) || [];
  // Una revisión manual sustituye las referencias XML; permite corregir errores del emisor.
  return gf.docs.filter(g => g.tipo_dte === '52' && (grupo ? ids.includes(gfId(g.id)) : folios.includes(String(g.folio))));
}
function gfFacturas() { return gf.docs.filter(d => d.tipo_dte === '33'); }
function gfCobertura(guia) { return gfFacturas().filter(f => !gfNoVigente(f) && gfAsociadas(f).some(g => gfId(g.id) === gfId(guia.id))); }
function gfCodigoOC(d) { return gfGrupo(d.id)?.orden_compra || d.orden_compra_ref || ''; }
function gfCOT(d) { const codigo = gfCodigoOC(d); return gfGrupo(d.id)?.cotizacion || oc.find(o => String(o.codigooc).toUpperCase() === codigo.toUpperCase())?.codigolicitacion || ''; }
function gfPeriodo(d) {
  const grupo = gfGrupo(d.id);
  if (grupo) return `${grupo.periodo.slice(0,7)} · ${grupo.etiqueta}`;
  const meses = [...new Set(gfAsociadas(d).map(g => g.fecha_emision.slice(0,7)))].sort();
  return meses.join(', ') || 'Por definir';
}
function gfRender() {
  const cont = document.getElementById('gf-resultados'); if (!cont) return;
  const aviso = document.getElementById('gf-aviso'); aviso.textContent = gf.error; aviso.hidden = !gf.error;
  document.getElementById('gf-cargar').disabled = gf.ocupado;
  document.getElementById('gf-hospital').disabled=gf.ocupado;document.getElementById('gf-anio').disabled=gf.ocupado;
  if (gf.ocupado) { cont.innerHTML = '<p role="status">Revisando referencias y asociaciones…</p>'; return; }
  if (!gf.listo) { document.getElementById('gf-resumen').textContent='Cruza guías y facturas por hospital y período de despacho.';cont.innerHTML = '<p>Selecciona un hospital y pulsa “Revisar guías”.</p>'; return; }
  const guias = gfGuias(), pendientes = guias.filter(g => gfCobertura(g).length === 0), conflictos = guias.filter(g => gfCobertura(g).length > 1);
  const q = document.getElementById('gf-buscar').value.trim();
  const filtro = r => !q || coincideBusqueda(r, q);
  document.getElementById('gf-resumen').textContent = `${guias.length} guías del período · ${pendientes.length} sin factura vinculada${gf.guardado ? '' : ' (provisional)'} · ${conflictos.length} con más de una factura`;
  let filas, cabecera;
  if (gf.vista === 'pendientes') {
    filas = [...pendientes,...conflictos].filter(g => filtro(`${g.folio} ${g.fecha_emision}`)).sort((a,b) => a.fecha_emision.localeCompare(b.fecha_emision));
    cabecera = '<th>Fecha guía</th><th>Guía</th><th>Total con IVA</th><th>Gestión</th>';
  } else {
    filas = gfFacturas().filter(d => {
      const grupo = gfGrupo(d.id), asociadas = gfAsociadas(d);
      const periodo = grupo ? grupo.periodo : '';
      // Facturas sin grupo aparecen por fecha de emisión, con período “Por definir”.
      const enPeriodo = grupo ? periodo.startsWith(String(gf.anio)) && (!gf.mes || periodo.slice(5,7) === gf.mes) : asociadas.length ? asociadas.some(g => guias.some(v => gfId(v.id) === gfId(g.id))) : String(d.fecha_emision).startsWith(String(gf.anio)) && (!gf.mes || d.fecha_emision.slice(5,7) === gf.mes);
      return enPeriodo && filtro(`${d.folio} ${gfCodigoOC(d)} ${gfCOT(d)} ${gfPeriodo(d)}`);
    }).sort((a,b) => gfPeriodo(a).localeCompare(gfPeriodo(b)) || a.fecha_emision.localeCompare(b.fecha_emision));
    cabecera = '<th>Fecha factura</th><th>Factura</th><th>OC</th><th>COT</th><th>Período despacho</th><th>Guías</th><th>Estado</th>';
  }
  const paginas = Math.max(1,Math.ceil(filas.length/15)); gf.pagina = Math.min(gf.pagina,paginas);
  const visibles = filas.slice((gf.pagina-1)*15,gf.pagina*15);
  cont.innerHTML = `<div class="gf-tabla"><table class="tabla-centrada"><thead><tr>${cabecera}</tr></thead><tbody>${visibles.map(d => gf.vista === 'pendientes' ? `<tr><td>${fDate(d.fecha_emision)}</td><td><button class="gf-link" onclick="gfVerDocumento(${Number(d.id)})">${gfEsc(d.folio)}</button></td><td>${gfMonto(d)}</td><td>${gfCobertura(d).length > 1 ? 'Revisar: más de una factura' : 'Confirmar OC y factura'}</td></tr>` : `<tr class="gf-fila" tabindex="0" role="button" aria-label="Abrir factura ${gfEsc(d.folio)}" onclick="gfAbrir(${Number(d.id)})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();gfAbrir(${Number(d.id)})}"><td>${fDate(d.fecha_emision)}</td><td>${gfEsc(d.folio)}</td><td>${gfEsc(gfCodigoOC(d)) || 'Por definir'}</td><td>${gfEsc(gfCOT(d)) || 'Por definir'}</td><td>${gfEsc(gfPeriodo(d))}</td><td>${gfAsociadas(d).length}</td><td>${gfNoVigente(d) ? 'Anulada / rechazada / con NC: revisar' : gfPago(d)?.estado_pago || 'Sin pago registrado'}</td></tr>`).join('') || `<tr><td colspan="7">Sin resultados para este filtro.</td></tr>`}</tbody></table></div><div class="gf-paginas"><button class="page-btn" ${gf.pagina===1?'disabled':''} onclick="gf.pagina--;gfRender()">Anterior</button><span>${gf.pagina} / ${paginas} · ${filas.length} resultados</span><button class="page-btn" ${gf.pagina===paginas?'disabled':''} onclick="gf.pagina++;gfRender()">Siguiente</button></div>`;
}
function gfVerDocumento(id) { const d = documentosGdexpress.find(d => gfId(d.id) === gfId(id)) || gf.docs.find(d=>gfId(d.id)===gfId(id)); if (d) { if(!documentosGdexpress.some(v=>gfId(v.id)===gfId(id)))documentosGdexpress.push(d);panelAbrir(fichaDocumento(d.id),true); } }
function gfAbrir(id) {
  const d = gf.docs.find(d => gfId(d.id) === gfId(id)); if (!d) return;
  const guias = gfAsociadas(d), grupo = gfGrupo(id);
  const total = guias.every(g => gfTotal(g) != null) ? guias.reduce((s,g) => s+gfTotal(g),0) : null;
  panelAbrir({titulo:`Factura ${d.folio}`,antetitulo:'Guías por facturar',sub:nombreHosp(d.hospital),cuerpo:`<div class="gf-ficha"><p><b>Fecha factura:</b> ${fDate(d.fecha_emision)} · <b>Período:</b> ${gfEsc(gfPeriodo(d))}</p><p><b>OC:</b> ${gfEsc(gfCodigoOC(d)) || 'Por definir'} · <b>COT:</b> ${gfEsc(gfCOT(d)) || 'Por definir'}</p><p>${gfNoVigente(d) ? 'Esta factura requiere revisión y no cubre las guías como facturación vigente.' : gfEsc(gfPago(d)?.estado_pago || 'Sin pago registrado')}</p><p>Asociación: ${grupo ? 'revisada manualmente' : 'referencias explícitas del documento'}. Total factura: ${gfMonto(d)}. Total guías: ${total == null ? 'Por confirmar' : clp(total)}.</p>${guias.length && total != null && gfTotal(d) != null && total !== gfTotal(d) ? '<p class="gf-alerta">Los montos no coinciden; revisa descuentos, facturación parcial o guías incorrectas.</p>' : ''}<details><summary>Guías de despacho asociadas (${guias.length})</summary>${guias.length ? `<div class="gf-tabla"><table><thead><tr><th>Fecha</th><th>Guía</th><th>Total con IVA</th></tr></thead><tbody>${guias.map(g => `<tr><td>${fDate(g.fecha_emision)}</td><td><button class="gf-link" onclick="gfVerDocumento(${Number(g.id)})">${gfEsc(g.folio)}</button></td><td>${gfMonto(g)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Aún no hay guías vinculadas. Selecciónalas en “Asociar guías”.</p>'}</details><div class="gf-acciones"><button class="page-btn" onclick="gfVerDocumento(${Number(id)})">Ver factura</button><button class="page-btn" onclick="gfHistorial(${Number(id)})" ${!gf.guardado?'disabled':''}>Historial de asociaciones</button>${sesionActual?.rol === 'editor' ? `<button class="page-btn" onclick="gfEditar(${Number(id)})" ${!gf.guardado?'disabled':''}>Asociar guías</button>`:''}</div></div>`});
}
async function gfHistorial(id) {
  try {
    const rows = await gfLeer('guias_facturacion_historial',`select=*&factura_id=eq.${encodeURIComponent(id)}&order=creado_en.desc,id.desc`);
    panelAbrir({titulo:'Historial de asociaciones',cuerpo: rows.length ? rows.map(r => {
      const v=r.detalle || {}, antes=v.antes || {}, despues=v.despues || {};
      const accion = v.guia ? `${r.accion.endsWith('DELETE') ? 'Retiró' : 'Asoció'} la guía ${v.guia}` : 'Actualizó el período y respaldo';
      return `<div class="doc-caja"><b>${gfEsc(gfFechaHora(r.creado_en))} · ${gfEsc(accion)}</b>${v.guia ? '' : `<p>Antes: ${gfEsc(antes.periodo || 'Sin período')} ${gfEsc(antes.etiqueta || '')}. Ahora: ${gfEsc(despues.periodo || '')} ${gfEsc(despues.etiqueta || '')}.</p><p>OC: ${gfEsc(despues.orden_compra || 'Sin definir')} · COT: ${gfEsc(despues.cotizacion || 'Sin definir')}</p><p>Respaldo: ${gfEsc(despues.motivo || '')}</p>`}</div>`;
    }).join('') : '<p>Sin cambios registrados.</p>'},true);
  } catch(e) { toast(e.message,'err'); }
}
function gfEditar(id) {
  if (!gf.guardado || sesionActual?.rol !== 'editor') return;
  const d = gf.docs.find(x => gfId(x.id) === gfId(id)), grupo = gfGrupo(id);
  const propias = new Set(gfAsociadas(d).map(g => gfId(g.id)));
  const guias = gf.docs.filter(g => g.tipo_dte === '52').sort((a,b) => a.fecha_emision.localeCompare(b.fecha_emision));
  const version = grupo?.version || 0;
  panelAbrir({titulo:`Asociar guías · factura ${d.folio}`,cuerpo:`<form id="gf-form" class="gf-ficha" onsubmit="event.preventDefault();gfGuardar(${Number(id)},${version})"><p>Selecciona guías completas del mismo hospital. No se permite asociar una guía a dos facturas. Para retirar todas las guías, desmárcalas y explica el motivo.</p><div class="gf-form-grid"><label>Mes de despacho<input id="gf-periodo" type="month" value="${gfEsc(grupo?.periodo.slice(0,7) || '')}" required></label><label>Parte del mes / período<input id="gf-etiqueta" maxlength="80" value="${gfEsc(grupo?.etiqueta || '')}" placeholder="Enero 1, Enero 2, mes completo…" required></label><label>OC<input id="gf-oc" maxlength="80" value="${gfEsc(gfCodigoOC(d))}"></label><label>COT<input id="gf-cot" maxlength="80" value="${gfEsc(gfCOT(d))}"></label></div><label>Motivo o respaldo<input id="gf-motivo" maxlength="500" placeholder="Listado del hospital, correo de regularización…" required></label><label>Buscar guía<input type="search" oninput="gfFiltrarSeleccion(this.value)" placeholder="Folio o fecha"></label><p id="gf-seleccion-resumen" role="status"></p><div class="gf-seleccion">${guias.map(g => { const otras=gfCobertura(g).filter(f => gfId(f.id)!==gfId(id));return `<label data-gf-guia="${gfEsc(g.folio)} ${gfEsc(g.fecha_emision)}"><input type="checkbox" name="guia" value="${Number(g.id)}" ${propias.has(gfId(g.id))?'checked':''} ${otras.length && !propias.has(gfId(g.id))?'disabled':''} onchange="gfResumenSeleccion()"> ${gfEsc(g.folio)} · ${fDate(g.fecha_emision)} · ${gfMonto(g)} ${otras.length?' · Ya referenciada por '+otras.map(f=>gfEsc(f.folio)).join(', '):''}</label>`;}).join('')}</div><p id="gf-guardar-error" role="alert"></p><button class="btn btn-primary" id="gf-guardar" type="submit">Guardar asociación</button></form>`},true);
  gfResumenSeleccion();
}
function gfFiltrarSeleccion(q) { document.querySelectorAll('[data-gf-guia]').forEach(el => { el.hidden = !coincideBusqueda(el.dataset.gfGuia,q); }); }
function gfResumenSeleccion() { const checked=[...document.querySelectorAll('#gf-form input[name="guia"]:checked')];document.getElementById('gf-seleccion-resumen').textContent=`${checked.length} guías seleccionadas (incluye las ocultas por la búsqueda).`; }
async function gfGuardar(id,version) {
  const boton=document.getElementById('gf-guardar'),error=document.getElementById('gf-guardar-error');boton.disabled=true;error.textContent='';
  try {
    const ids=[...document.querySelectorAll('#gf-form input[name="guia"]:checked')].map(el=>Number(el.value));
    const payload={p_factura:id,p_version:version,p_periodo:document.getElementById('gf-periodo').value+'-01',p_etiqueta:document.getElementById('gf-etiqueta').value.trim(),p_oc:document.getElementById('gf-oc').value.trim(),p_cot:document.getElementById('gf-cot').value.trim(),p_motivo:document.getElementById('gf-motivo').value.trim(),p_guias:ids};
    const r=await sb('rpc/guias_facturacion_guardar',{method:'POST',body:JSON.stringify(payload)});const body=await r.json();if(!r.ok)throw new Error(body.message || 'No se guardó la asociación.');
    // Cerrar únicamente tras éxito; si la recarga falla no se muestran resultados viejos.
    panelCerrar();await gfCargar();toast('Asociación guardada.');
  }catch(e){error.textContent=e.message;boton.disabled=false;}
}
