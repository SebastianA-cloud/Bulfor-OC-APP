// Demostración aislada: datos inventados y guardado solo en memoria de esta página.
// No usa Supabase, credenciales, documentos reales ni almacenamiento compartido.
const nombreHosp = v => v;
const clp = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
const fDate = s => s ? String(s).slice(0,10).split('-').reverse().join('-') : 'Sin fecha';
const coincideBusqueda = (text,q) => String(q).toLowerCase().split(/\s+/).every(p => String(text).toLowerCase().includes(p));
const sesionActual = {rol:'editor'};
const hospitalManual='Hospital de prueba · regularización (ejemplo La Florida)';
const hospitalAuto='Hospital de prueba · referencias directas (ejemplo Fricke)';
const doc=(id,tipo,folio,rut,hospital,fecha,total,orden='')=>({id,tipo_dte:tipo,folio,rut_hospital:rut,hospital,fecha_emision:fecha,monto_total:total,estado_aceptacion:'A',orden_compra_ref:orden});
const documentosGdexpress=[
 doc(1,'33','900001','11111111-1',hospitalManual,'2026-05-25',300000,'DEMO-101-AG26'),
 doc(2,'33','900002','11111111-1',hospitalManual,'2026-06-05',450000,'DEMO-102-AG26'),
 doc(10,'52','800001','11111111-1',hospitalManual,'2026-01-05',100000),
 doc(11,'52','800002','11111111-1',hospitalManual,'2026-01-12',200000),
 doc(12,'52','800003','11111111-1',hospitalManual,'2026-01-23',150000),
 doc(13,'52','800004','11111111-1',hospitalManual,'2026-01-29',300000),
 doc(3,'33','900003','22222222-2',hospitalAuto,'2026-02-20',180000,'DEMO-201-AG26'),
 doc(20,'52','800005','22222222-2',hospitalAuto,'2026-02-10',180000),
 doc(21,'52','800006','22222222-2',hospitalAuto,'2026-02-22',120000)
];
const facturasPago=[{factura:'900001',rut_hospital:'11111111-1',estado_pago:'Pagado',fecha_pago:'2026-08-03'}];
const oc=[{codigooc:'DEMO-101-AG26',codigolicitacion:'DEMO-91-COT26'},{codigooc:'DEMO-102-AG26',codigolicitacion:'DEMO-92-COT26'},{codigooc:'DEMO-201-AG26',codigolicitacion:'DEMO-191-COT26'}];
let demoGrupos=[{factura_id:1,periodo:'2026-01-01',etiqueta:'Enero 1',orden_compra:'DEMO-101-AG26',cotizacion:'DEMO-91-COT26',motivo:'Ejemplo ficticio de listado del hospital',version:1}];
let demoEnlaces=[{factura_id:1,guia_id:10},{factura_id:1,guia_id:11}];
let demoHistorial=[];
function toast(text){document.getElementById('demo-estado').textContent=text;}
function fichaDocumento(id){const d=documentosGdexpress.find(d=>d.id===id);return {titulo:`${d.tipo_dte==='52'?'Guía':'Factura'} ${d.folio} · ejemplo ficticio`,cuerpo:`<p>${panelEsc(d.hospital)}</p><p>Fecha: ${fDate(d.fecha_emision)} · Total: ${clp(d.monto_total)}</p><p>Este documento es inventado para probar la navegación.</p>`};}
const sb=async(path,opts={})=>{
 const u=new URL(path,'https://ejemplo.invalid/');let rows=[];let status=200;
 if(u.pathname==='/documentos_gdexpress'){
  const id=Number(u.searchParams.get('id')?.replace('eq.',''));
  rows=u.searchParams.has('id')?[{id,xml_completo:`<DTE><Documento>${id===3?'<Referencia><TpoDocRef>52</TpoDocRef><FolioRef>800005</FolioRef></Referencia>':''}</Documento></DTE>`}]:documentosGdexpress;
 }else if(u.pathname==='/facturas_pago')rows=facturasPago;
 else if(u.pathname==='/guias_facturacion_grupos')rows=demoGrupos;
 else if(u.pathname==='/guias_facturacion_enlaces')rows=demoEnlaces;
 else if(u.pathname==='/guias_facturacion_historial')rows=demoHistorial.filter(r=>r.factura_id===Number(u.searchParams.get('factura_id')?.replace('eq.',''))).slice().reverse();
 else if(u.pathname==='/rpc/guias_facturacion_guardar'){
  const p=JSON.parse(opts.body),old=demoGrupos.find(g=>g.factura_id===p.p_factura),factura=documentosGdexpress.find(d=>d.id===p.p_factura);
  const error=(old?.version||0)!==p.p_version?'Otra edición cambió esta asociación; vuelve a cargar.':p.p_guias.some(id=>demoEnlaces.some(e=>e.guia_id===id&&e.factura_id!==p.p_factura))?'Una guía ya está vinculada a otra factura.':p.p_guias.some(id=>documentosGdexpress.find(d=>d.id===id)?.rut_hospital!==factura.rut_hospital)?'La guía pertenece a otro hospital.':!p.p_etiqueta||!p.p_motivo?'Completa período y respaldo.':'';
  if(error){status=409;rows={message:error};}else{
   const updated={factura_id:p.p_factura,periodo:p.p_periodo,etiqueta:p.p_etiqueta,orden_compra:p.p_oc,cotizacion:p.p_cot,motivo:p.p_motivo,version:p.p_version+1};
   const record=(accion,detalle)=>demoHistorial.push({id:demoHistorial.length+1,factura_id:p.p_factura,creado_en:new Date().toISOString(),accion,detalle});
   record('guias_facturacion_grupos UPDATE',{antes:old||null,despues:updated});
   demoEnlaces.filter(e=>e.factura_id===p.p_factura&&!p.p_guias.includes(e.guia_id)).forEach(e=>record('guias_facturacion_enlaces DELETE',{guia:documentosGdexpress.find(d=>d.id===e.guia_id).folio}));
   p.p_guias.filter(id=>!demoEnlaces.some(e=>e.guia_id===id&&e.factura_id===p.p_factura)).forEach(id=>record('guias_facturacion_enlaces INSERT',{guia:documentosGdexpress.find(d=>d.id===id).folio}));
   demoGrupos=demoGrupos.filter(g=>g.factura_id!==p.p_factura).concat(updated);
   demoEnlaces=demoEnlaces.filter(e=>e.factura_id!==p.p_factura).concat(p.p_guias.map(id=>({factura_id:p.p_factura,guia_id:id})));rows=updated.version;
  }
 }
 return {ok:status===200,status,json:async()=>JSON.parse(JSON.stringify(rows))};
};
gf.anio=2026;gf.hospital='111111111';gfInit();gfCargar();
