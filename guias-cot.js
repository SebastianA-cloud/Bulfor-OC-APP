// Guías por facturar (COT). Aislado de los otros menús.
// Los datos reales se consultan con la sesión existente y RLS.
const gcState={year:2026,month:4,hospital:'65075485-9',cots:[],links:[],xml:new Map(),loaded:false,expanded:new Set(),demo:false,editId:null};
const gcMonths=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const gcEsc=v=>escapeHtml(v==null?'':String(v));
const gcMoney=n=>'$ '+Math.round(Number(n)||0).toLocaleString('es-CL');
const gcDate=s=>String(s||'').slice(0,10);
const gcDateDisplay=s=>{const a=gcDate(s).split('-');return a.length===3?a.reverse().join('-'):'—';};
const gcNorm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const gcRut=d=>String(d.rut_hospital||'').trim();
const gcHospital=d=>nombreHosp(d.hospital||'')||d.hospital||'';
const gcKey=d=>gcRut(d)||gcNorm(gcHospital(d));
const gcNum=d=>Number(d&&d.monto_total!=null?d.monto_total:d&&d.monto)||0;
const gcNet=d=>Number(d&&d.monto)||0;
const gcGuides=()=>documentosGdexpress.filter(d=>String(d.tipo_dte)==='52');
const gcInvoices=()=>documentosGdexpress.filter(d=>String(d.tipo_dte)==='33');
const gcEditor=()=>sesionActual&&sesionActual.rol==='editor';
const gcSameHospital=(a,b)=>!!(a&&b&&(gcRut(a)&&gcRut(a)===gcRut(b)||gcNorm(gcHospital(a))===gcNorm(gcHospital(b))));
const gcPeriod=d=>({month:gcDate(d.fecha_emision).slice(0,7),half:Number(gcDate(d.fecha_emision).slice(8,10))<=15?1:2});
const gcMonthKey=(y,m)=>String(y)+'-'+String(m+1).padStart(2,'0');
function gcHospitals(){
 const m=new Map();
 gcGuides().forEach(d=>{const k=gcKey(d);if(k&&!m.has(k))m.set(k,{id:k,name:gcHospital(d)});});
 return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name,'es'));
}
function gcSelected(d){
 return gcState.hospital==='todos'?!gcNorm(gcHospital(d)).includes('ROBERTO DEL RIO'):gcKey(d)===gcState.hospital;
}
function gcCotOcNumber(o){return String(o.nombreoc||'').match(/\b(\d{5,8}-\d+-COT\d{2})\b/i)?.[1]?.toUpperCase()||'';}
function gcGetOc(cot){
 if(!cot||!cot.numero_cot)return null;
 return oc.find(o=>gcCotOcNumber(o)===gcNorm(cot.numero_cot)&&(!o.rut_hospital||!cot.rut_hospital||o.rut_hospital===cot.rut_hospital))||null;
}
function gcRefs(xml){
 if(!xml)return [];
 const dom=new DOMParser().parseFromString(xml,'text/xml');
 if(dom.querySelector('parsererror'))return [];
 return [...dom.getElementsByTagName('*')].filter(n=>n.localName==='Referencia').flatMap(ref=>{
   const field=k=>[...ref.children].find(n=>n.localName===k)?.textContent?.trim()||'';
   return field('TpoDocRef')==='52'?[field('FolioRef')]:[];
 }).filter(Boolean);
}
function gcInvoice(group){
 // Una factura histórica verificada puede estar indicada en la nota de carga.
 const historic=group.cot?.nota?.match(/\bFACTURA_HISTORICA:(\d+)\b/);
 if(historic){
   const f=gcInvoices().find(d=>String(d.folio)===historic[1]&&gcSameHospital(d,group.guides[0]));
   if(f)return f;
 }
 const folios=new Set(group.guides.map(d=>String(d.folio)));
 const candidates=gcInvoices().filter(f=>gcSameHospital(f,group.guides[0]));
 const byRef=candidates.filter(f=>gcRefs(gcState.xml.get(String(f.id))).some(ref=>folios.has(ref)));
 if(byRef.length===1)return byRef[0];
 if(byRef.length>1)return null;
 if(group.oc){
   const byOc=candidates.filter(f=>gcNorm(f.orden_compra_ref)===gcNorm(group.oc));
   if(byOc.length===1)return byOc[0];
 }
 return null;
}
function gcPayment(f){
 if(!f)return null;
 return facturasPago.find(p=>String(p.factura)===String(f.folio)&&gcSameHospital(p,f))||null;
}
function gcGroups(y=gcState.year,m=gcState.month){
 const guides=gcGuides().filter(d=>gcSelected(d)&&gcDate(d.fecha_emision).slice(0,7)===gcMonthKey(y,m));
 const byLink=new Map(gcState.links.map(l=>[String(l.guia_documento_id),String(l.cot_id)]));
 const byCot=new Map(gcState.cots.map(c=>[String(c.id),c]));
 const groups=new Map();
 guides.forEach(g=>{
   const cot=byCot.get(byLink.get(String(g.id)))||null;
   const ocCode=String(g.orden_compra_ref||'').trim()||(gcGetOc(cot)?.codigooc||'');
   const key=cot?'cot-'+cot.id:ocCode?'oc-'+ocCode:'sin';
   if(!groups.has(key))groups.set(key,{key,cot,oc:ocCode,guides:[]});
   groups.get(key).guides.push(g);
 });
 return [...groups.values()].map(g=>{
   const invoice=gcInvoice(g);
   const stage=invoice?'facturada':g.oc?'conoc':g.cot?'encot':'sincot';
   const dates=g.guides.map(x=>gcDate(x.fecha_emision)).sort();
   return {...g,invoice,stage,amount:g.guides.reduce((s,d)=>s+gcNum(d),0),dates,half:gcPeriod(g.guides[0]).half};
 }).sort((a,b)=>a.half-b.half||a.dates[0].localeCompare(b.dates[0]));
}
function gcGoDocument(id){
 const ficha=fichaDocumento(Number(id));
 if(ficha)panelAbrir(ficha,true);
}
function gcDocLink(d){
 return d?'<button class="gc-doc" onclick="gcGoDocument('+Number(d.id)+')">'+gcEsc(d.folio)+'</button>':'—';
}
function gcStageMonth(y,m){
 if(y===2025)return 'facturado';
 const now=new Date();
 if(y>now.getFullYear()||y===now.getFullYear()&&m>now.getMonth())return 'futuro';
 const groups=gcGroups(y,m);
 if(!groups.length)return 'vacio';
 if(groups.every(g=>g.stage==='facturada'))return 'facturado';
 if(groups.every(g=>g.stage==='sincot'))return 'sincot';
 return 'parcial';
}
function gcMonthSelect(delta){
 const d=new Date(gcState.year,gcState.month+delta,1);
 gcState.year=d.getFullYear();gcState.month=d.getMonth();gcRender();
}
function gcJump(m){gcState.month=m;gcRender();}
function gcHospitalSelect(id){gcState.hospital=id;gcRender();}
function gcToggle(key){gcState.expanded.has(key)?gcState.expanded.delete(key):gcState.expanded.add(key);gcRender();}
function gcGroupHtml(g){
 const p=gcPayment(g.invoice);
 const paid=p&&p.fecha_pago?'Pagada '+gcDateDisplay(p.fecha_pago):'Sin pago registrado';
 const first=g.guides[0],shown=gcState.expanded.has(g.key)?g.guides:g.guides.slice(0,4);
 const label=g.cot?.numero_cot|| (g.cot?'COT histórica sin N°':g.oc?'Guías con OC':'Sin COT');
 const note=String(g.cot?.nota||'').replace(/FACTURA_HISTORICA:\d+/g,'').trim();
 let html='<section class="gc-group"><div class="gc-group-head"><div><b>'+gcEsc(label)+'</b><div class="gc-muted">Mes '+g.half+' · '+gcDateDisplay(g.dates[0])+' a '+gcDateDisplay(g.dates[g.dates.length-1])+' · '+g.guides.length+' guías</div></div><strong>'+gcMoney(g.amount)+'</strong></div>';
 html+='<div class="gc-flow"><span class="'+(g.cot?'gc-done':'gc-warn')+'">COT '+gcEsc(g.cot?.numero_cot||'—')+'</span><span>→</span><span class="'+(g.oc?'gc-done':'gc-muted')+'">OC '+gcEsc(g.oc||'—')+'</span><span>→</span><span class="'+(g.invoice?'gc-done':'gc-muted')+'">Factura '+gcDocLink(g.invoice)+'</span><span>→</span><span class="'+(p?.fecha_pago?'gc-done':'gc-muted')+'">'+gcEsc(paid)+'</span></div>';
 html+='<table class="gc-table"><thead><tr><th>Fecha</th><th>Guía</th><th>Neto</th><th>Total con IVA</th></tr></thead><tbody>';
 shown.forEach(d=>{html+='<tr><td>'+gcDateDisplay(d.fecha_emision)+'</td><td>'+gcDocLink(d)+'</td><td>'+gcMoney(gcNet(d))+'</td><td>'+gcMoney(gcNum(d))+'</td></tr>';});
 html+='</tbody></table>';
 if(g.guides.length>4)html+='<button class="gc-more" onclick="gcToggle('+JSON.stringify(g.key).replace(/"/g,'&quot;')+')">'+(gcState.expanded.has(g.key)?'Ver menos':'Ver todas ('+g.guides.length+')')+'</button>';
 if(g.guides.some(d=>String(d.folio)==='5392')&&!g.cot)html+='<div class="gc-note">Guía 5392 fuera de la factura 22309: diferencia verificada de $5.672.016.</div>';
 if(note)html+='<div class="gc-note">'+gcEsc(note)+'</div>';
 if(g.cot&&gcEditor()&&!gcState.demo)html+='<div class="gc-actions"><button onclick="gcEdit('+Number(g.cot.id)+')">Editar COT</button><button onclick="gcDelete('+Number(g.cot.id)+')">Borrar COT</button></div>';
 return html+'</section>';
}
function gcRender(){
 const el=document.getElementById('gc-content');if(!el)return;
 const y=gcState.year,m=gcState.month,groups=y===2025?[]:gcGroups();
 const opts=[{id:'todos',name:'Todos (sin Roberto del Río)'},...gcHospitals()];
 const selectors=opts.map(h=>'<option value="'+gcEsc(h.id)+'"'+(h.id===gcState.hospital?' selected':'')+'>'+gcEsc(h.name)+'</option>').join('');
 let html='<div class="gc-toolbar"><div class="gc-controls"><select aria-label="Hospital" onchange="gcHospitalSelect(this.value)">'+selectors+'</select><div class="gc-month-picker"><button onclick="gcMonthSelect(-1)">‹</button><b>'+gcMonths[m]+' '+y+'</b><button onclick="gcMonthSelect(1)">›</button></div></div><div class="gc-controls"><button class="page-btn" onclick="gcExcel()">Descargar Excel</button>';
 if(gcEditor()&&!gcState.demo)html+='<button class="gc-primary" onclick="gcRegister()">Registrar COT (pegar correo)</button>';
 if(gcState.demo)html+='<span class="gc-demo">Vista simulada: no guarda datos</span>';
 html+='</div></div><div class="gc-year"><div class="gc-muted">'+y+' · Estado por mes de despacho</div><div class="gc-months">';
 gcMonths.forEach((label,i)=>{const state=gcStageMonth(y,i);html+='<button class="gc-month gc-month-'+state+(i===m?' gc-current':'')+'" onclick="gcJump('+i+')"><b>'+label.slice(0,3)+'</b><small>'+({facturado:'Facturado',parcial:'Parcial',sincot:'Sin COT',futuro:'Futuro',vacio:'Sin guías'}[state])+'</small></button>';});
 html+='</div></div>';
 if(y===2025)html+='<div class="gc-historic">Facturado (histórico). No se muestra el detalle de las guías de 2025.</div>';
 else{
   const stages=[['sincot','Sin COT'],['encot','En COT, esperando OC'],['conoc','Con OC, sin factura'],['facturada','Facturada']];
   html+='<div class="gc-cards">';
   stages.forEach(([stage,label])=>{const gs=groups.filter(g=>g.stage===stage);html+='<div class="gc-card gc-card-'+stage+'"><div>'+label+'</div><strong>'+gcMoney(gs.reduce((s,g)=>s+g.amount,0))+'</strong><small>'+gs.reduce((s,g)=>s+g.guides.length,0)+' guías</small></div>';});
   html+='</div><div class="gc-groups">'+(groups.length?groups.map(gcGroupHtml).join(''):'<div class="gc-historic">No hay guías para este mes.</div>')+'</div>';
 }
 el.innerHTML=html;
}
async function gcInit(){
 if(gcState.loaded){gcRender();return;}
 const el=document.getElementById('gc-content');if(el)el.textContent='Cargando guías y COT…';
 try{
   if(!gcState.demo){
     const r=await Promise.all([fetchAll('guias_cot','select=*&order=creado_en.asc'),fetchAll('guias_cot_detalle','select=*')]);
     gcState.cots=r[0];gcState.links=r[1];
   }
   gcState.loaded=true;gcRender();
   if(!gcState.demo)gcFetchXml();
 }catch(e){if(el)el.textContent='No se pudo cargar el seguimiento. Revisa tu conexión e inténtalo nuevamente.';console.error('Guías COT:',e);}
}
// XML: se consulta solo cuando el usuario abre este menú y solo facturas de 2026.
// No se incluye XML en la carga general de la aplicación.
async function gcFetchXml(){
 try{
   const all=await fetchAll('documentos_gdexpress','select=id,xml_completo&tipo_dte=eq.33&fecha_emision=gte.2026-01-01');
   all.forEach(d=>{if(d.xml_completo)gcState.xml.set(String(d.id),d.xml_completo);});
   if(document.getElementById('page-guias-cot')?.classList.contains('active'))gcRender();
 }catch(e){console.warn('No se pudieron consultar las referencias XML de facturas. Se conserva vínculo por OC.',e);}
}
