// Guías por facturar (COT). Aislado de los otros menús.
// Los datos reales se consultan con la sesión existente y RLS.
const gcState={year:2026,month:4,hospital:'65075485-9',cots:[],links:[],xml:new Map(),loaded:false,expanded:new Set(),demo:new URLSearchParams(location.search).get('guias_demo')==='1',editId:null};
const gcMonths=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const gcEsc=v=>escapeHtml(v==null?'':String(v));
const gcMoney=n=>'$ '+Math.round(Number(n)||0).toLocaleString('es-CL');
const gcDate=s=>String(s||'').slice(0,10);
const gcDateDisplay=s=>{const a=gcDate(s).split('-');return a.length===3?a.reverse().join('-'):'—';};
const gcNorm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const gcRut=d=>String(d.rut_hospital||'').trim();
const gcHospital=d=>nombreHosp(d.hospital||'')||d.hospital||'';
const gcKey=d=>gcRut(d)||gcNorm(gcHospital(d));
const gcNum=d=>Number(d&&d.monto_total!=null?d.monto_total:Math.round(Number(d&&d.monto||0)*1.19))||0;
const gcNet=d=>Number(d&&d.monto)||0;
// Las guías rechazadas por el SII (estado_aceptacion 'N', como en el resto de la app)
// no se despacharon de verdad: no cuentan en ninguna etapa ni al registrar una COT.
const gcGuides=()=>(gcState.demo?gcState.demoGuides:documentosGdexpress).filter(d=>String(d.tipo_dte)==='52'&&d.estado_aceptacion!=='N');
const gcInvoices=()=>(gcState.demo?gcState.demoInvoices:documentosGdexpress).filter(d=>String(d.tipo_dte)==='33');
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
 if(!cot)return null;
 if(cot.numero_cot)return oc.find(o=>gcCotOcNumber(o)===gcNorm(cot.numero_cot)&&(!o.rut_hospital||!cot.rut_hospital||o.rut_hospital===cot.rut_hospital))||null;
 // Históricos: la factura ya verificada da la OC, y nombreoc da la COT.
 const invoice=cot.nota?.match(/FACTURA_HISTORICA:(\d+)/)?.[1];
 if(invoice){
   const f=gcInvoices().find(x=>String(x.folio)===invoice&&gcRut(x)===cot.rut_hospital);
   return f?.orden_compra_ref?oc.find(o=>gcNorm(o.codigooc)===gcNorm(f.orden_compra_ref))||null:null;
 }
 // Solo completar número desde OC si la coincidencia de hospital y monto es única.
 // Si hay dos OC posibles, no inventar una asociación.
 const candidates=oc.filter(o=>gcCotOcNumber(o)&&Number(o.totaloc)===Number(cot.monto_total)
   &&(gcNorm(gcHospital(o))===gcNorm(cot.hospital)||String(o.rut_hospital||'')===cot.rut_hospital));
 return candidates.length===1?candidates[0]:null;
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
   const historicalInvoice=cot?.nota?.match(/FACTURA_HISTORICA:(\d+)/)?.[1];
   const pastInvoice=historicalInvoice&&gcInvoices().find(f=>String(f.folio)===historicalInvoice&&gcSameHospital(f,g));
   const ocCode=String(g.orden_compra_ref||'').trim()||(gcGetOc(cot)?.codigooc||'')||(pastInvoice?.orden_compra_ref||'');
   const key=cot?'cot-'+cot.id:ocCode?'oc-'+ocCode:'sin';
   if(!groups.has(key))groups.set(key,{key,cot,oc:ocCode,guides:[]});
   groups.get(key).guides.push(g);
 });
 return [...groups.values()].map(g=>{
   const invoice=gcInvoice(g);
   const stage=invoice?'facturada':g.oc?'conoc':g.cot?'encot':'sincot';
   const dates=g.guides.map(x=>gcDate(x.fecha_emision)).sort();
   return {...g,invoice,stage,amount:g.guides.reduce((s,d)=>s+gcNum(d),0),dates,half:g.cot?.quincena||gcPeriod(g.guides[0]).half};
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
 const paid=p&&p.fecha_pago?'Pagada '+gcDateDisplay(p.fecha_pago):p&&/pagad|cancelad/i.test(p.estado_pago||'')?'Pagada (fecha no registrada)':'Sin pago registrado';
 const first=g.guides[0],shown=gcState.expanded.has(g.key)?g.guides:g.guides.slice(0,4);
 const label=g.cot?.numero_cot||gcCotOcNumber(gcGetOc(g.cot)||{})|| (g.cot?'COT histórica sin N°':g.oc?'Guías con OC':'Sin COT');
 const note=String(g.cot?.nota||'').replace(/FACTURA_HISTORICA:\d+/g,'').replace(/^\s*[|;]\s*/,'').trim();
 let html='<section class="gc-group"><div class="gc-group-head"><div><b>'+gcEsc(label)+'</b><div class="gc-muted">'+gcEsc(gcMonths[Number(g.dates[0].slice(5,7))-1]||'Mes')+' '+g.half+' · '+gcDateDisplay(g.dates[0])+' a '+gcDateDisplay(g.dates[g.dates.length-1])+' · '+g.guides.length+' guías</div></div><strong>'+gcMoney(g.amount)+'</strong></div>';
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
 if(gcEditor()||gcState.demo)html+='<button class="gc-primary" onclick="gcRegister()">Registrar COT (pegar correo)</button>';
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
   if(gcState.demo){gcLoadDemo();}
   else{
     const r=await Promise.all([fetchAll('guias_cot','select=*&order=creado_en.asc'),fetchAll('guias_cot_detalle','select=*')]);
     gcState.cots=r[0];gcState.links=r[1];
   }
   if(!gcState.demo&&!gcState.mesElegido){
     const ult=gcGuides().filter(gcSelected).map(d=>gcDate(d.fecha_emision)).sort().pop();
     if(ult){gcState.year=Number(ult.slice(0,4));gcState.month=Number(ult.slice(5,7))-1;}
     gcState.mesElegido=true;
   }
   gcState.loaded=true;gcRender();
   if(!gcState.demo)gcFetchXml();
 }catch(e){if(el)el.textContent='No se pudo cargar el seguimiento. Revisa tu conexión e inténtalo nuevamente.';console.error('Guías COT:',e);}
}
// XML: se consulta solo cuando el usuario abre este menú y solo facturas de 2026.
// No se incluye XML en la carga general de la aplicación.
async function gcFetchXml(){
 try{
   // Solo se piden las facturas cuyo XML cita una guía (referencia tipo 52): son pocas
   // (~80) en vez de todas las de 2026 (~2.300, unos 25 MB).
   const all=await fetchAll('documentos_gdexpress','select=id,xml_completo&tipo_dte=eq.33&fecha_emision=gte.2026-01-01&xml_completo=ilike.'+encodeURIComponent('*TpoDocRef>52<*'));
   all.forEach(d=>{if(d.xml_completo)gcState.xml.set(String(d.id),d.xml_completo);});
   if(document.getElementById('page-guias-cot')?.classList.contains('active'))gcRender();
 }catch(e){console.warn('No se pudieron consultar las referencias XML de facturas. Se conserva vínculo por OC.',e);}
}


// Reconoce textos de correo como el enviado por La Florida. No lee el buzón.
function gcParseEmail(text){
 const amount=/\b(?:valor|monto(?:\s+total)?)\s*:?\s*\$?\s*([\d.]+)/i.exec(text);
 const expiration=/\bvence(?:\s+el)?\s+(\d{2})[-/](\d{2})[-/](\d{4})/i.exec(text);
 const cot=/\b(\d{5,8}-\d+-COT\d{2})\b/i.exec(text);
 const lines=[];
 text.split(/\r?\n/).forEach(line=>{
   const match=/^\s*(\d{2})[-/](\d{2})[-/](\d{4})\s+(\d{4,8})\s+\$?\s*([\d.]+)/.exec(line);
   if(match)lines.push({date:match[3]+'-'+match[2]+'-'+match[1],folio:match[4],amount:Number(match[5].replace(/\./g,''))});
 });
 return {amount:amount?Number(amount[1].replace(/\./g,'')):0,
   expiration:expiration?expiration[3]+'-'+expiration[2]+'-'+expiration[1]:'',
   number:cot?cot[1].toUpperCase():'',lines};
}
function gcRegister(){
 if(!gcEditor()&&!gcState.demo)return;
 gcState.editId=null;
 panelAbrir({antetitulo:'FACTURAS DE VENTA',titulo:'Registrar COT (pegar correo)',
   sub:'Pega el texto del hospital para encontrar guías y comparar el monto real.',
   cuerpo:'<div class="gc-form"><label>Texto del correo</label><textarea id="gc-email" rows="10" placeholder="Valor $ 6.790.201.- vence el 02-11-2026"></textarea><div class="gc-actions"><button class="gc-primary" onclick="gcAnalyze()">Reconocer guías</button></div><div id="gc-parsed"></div></div>'},true);
}
function gcAnalyze(){
 const input=document.getElementById('gc-email');if(!input)return;
 const parsed=gcParseEmail(input.value);
 const found=parsed.lines.map(line=>{
   const guide=gcGuides().find(g=>gcSelected(g)&&String(g.folio)===line.folio)||null;
   return {...line,guide,otraFecha:!!(guide&&line.date&&gcDate(guide.fecha_emision)!==line.date)};
 });
 const missing=found.filter(x=>!x.guide),duplicate=found.filter(x=>!gcState.demo&&x.guide&&gcState.links.some(l=>String(l.guia_documento_id)===String(x.guide.id)));
 const ids=found.filter(x=>x.guide).map(x=>String(x.guide.id));
 const repeated=ids.length!==new Set(ids).size;
 const sum=found.reduce((s,x)=>s+(x.guide?gcNum(x.guide):0),0);
 gcState.draft={...parsed,found,missing,duplicate,repeated,sum};
 const node=document.getElementById('gc-parsed');
 let html='<label>Número de COT (puede quedar vacío hasta recibir la OC)</label><input id="gc-number" value="'+gcEsc(parsed.number)+'" placeholder="Ej.: 812030-1038-COT26">';
 html+='<label>Valor total de COT, con IVA</label><input id="gc-amount" type="number" min="1" value="'+parsed.amount+'" oninput="gcCheckDifference()">';
 html+='<label>Fecha de vencimiento</label><input id="gc-expiration" type="date" value="'+parsed.expiration+'">';
 const base=found.find(x=>x.guide)?.guide;
 const mesBase=base?gcDate(base.fecha_emision).slice(0,7):'';
 const yaHay=base?gcState.cots.some(c=>String(c.periodo_mes||'').slice(0,7)===mesBase&&c.rut_hospital===gcRut(base)):false;
 html+='<label>Grupo del mes</label><select id="gc-half"><option value="1"'+(yaHay?'':' selected')+'>'+(base?gcMonths[Number(mesBase.slice(5,7))-1]:'Mes')+' 1</option><option value="2"'+(yaHay?' selected':'')+'>'+(base?gcMonths[Number(mesBase.slice(5,7))-1]:'Mes')+' 2</option></select>';
 html+='<table class="gc-table"><thead><tr><th>Guía</th><th>Correo</th><th>Base real</th></tr></thead><tbody>';
 found.forEach(x=>{html+='<tr><td>'+gcEsc(x.folio)+(x.otraFecha?' <small class="gc-muted">(en la base: '+gcDateDisplay(x.guide.fecha_emision)+')</small>':'')+'</td><td>'+gcMoney(x.amount)+'</td><td>'+(x.guide?gcMoney(gcNum(x.guide)):'No encontrada')+'</td></tr>';});
 html+='</tbody></table><div id="gc-diff"></div>';
 if(missing.length)html+='<p class="gc-alert">No se encontraron '+missing.length+' guías con ese número en este hospital. Corrige los datos antes de guardar.</p>';
 if(found.some(x=>x.otraFecha))html+='<p class="gc-alert">'+found.filter(x=>x.otraFecha).length+' guías tienen en la base una fecha distinta a la del correo (se muestra al lado). Se puede guardar igual.</p>';
 if(duplicate.length)html+='<p class="gc-alert">'+duplicate.length+' guías ya están asociadas a una COT.</p>';
 if(repeated)html+='<p class="gc-alert">Hay una guía repetida en el texto.</p>';
 html+='<label>Nota (obligatoria cuando los montos no coinciden)</label><textarea id="gc-note" rows="3"></textarea>';
 html+='<button class="gc-primary" onclick="gcSave()" '+(!found.length||missing.length||duplicate.length||repeated||gcState.demo?'disabled':'')+'>'+(gcState.demo?'Simulación: no se guarda':'Guardar COT')+'</button>';
 node.innerHTML=html;gcCheckDifference();
}
function gcCheckDifference(){
 const draft=gcState.draft;if(!draft)return;
 const amount=Number(document.getElementById('gc-amount')?.value)||0;
 const diff=draft.sum-amount,el=document.getElementById('gc-diff');if(!el)return;
 el.className='gc-diff '+(!diff?'gc-diff-ok':'gc-diff-warn');
 el.textContent=!diff?'Coincide: '+gcMoney(draft.sum)+' ('+draft.found.length+' guías)':'Diferencia de '+gcMoney(Math.abs(diff))+' ('+(diff>0?'guías superan COT':'COT supera guías')+'). Puedes guardar con una nota.';
}
async function gcSave(){
 if(!gcEditor()||gcState.demo)return;
 const draft=gcState.draft;if(!draft||draft.missing.length||draft.duplicate.length||draft.repeated||!draft.found.length)return;
 const amount=Number(document.getElementById('gc-amount')?.value);
 const number=document.getElementById('gc-number')?.value.trim().toUpperCase()||null;
 const expiration=document.getElementById('gc-expiration')?.value||null;
 const note=document.getElementById('gc-note')?.value.trim()||null;
 if(!Number.isSafeInteger(amount)||amount<=0){toast('Indica un monto válido en pesos.','err');return;}
 if(amount!==draft.sum&&!note){toast('Escribe una nota que explique la diferencia.','err');return;}
 const base=draft.found[0].guide,period=gcPeriod(base);
 if(draft.found.some(x=>!gcSameHospital(x.guide,base))){
   toast('Esta COT contiene guías de distintos hospitales. Revísalas.','err');return;
 }
 if(draft.found.some(x=>gcPeriod(x.guide).month!==period.month))
   toast('Ojo: la COT tiene guías de más de un mes. Se guarda en el mes de la primera guía.');
 const half=Number(document.getElementById('gc-half')?.value)===2?2:1;
 const cot={numero_cot:number,rut_hospital:gcRut(base),hospital:gcHospital(base),monto_total:amount,fecha_vencimiento:expiration,periodo_mes:period.month+'-01',quincena:half,nota:note};
 let createdId=null;
 try{
   const r=await sb('guias_cot',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(cot)});
   if(!r.ok)throw new Error('No se pudo crear la COT. Verifica el número y los permisos.');
   const data=await r.json();createdId=data[0]?.id;
   if(!createdId)throw new Error('No se recibió el identificador de la COT.');
   const links=draft.found.map(x=>({cot_id:createdId,guia_documento_id:x.guide.id}));
   const lr=await sb('guias_cot_detalle',{method:'POST',body:JSON.stringify(links)});
   if(!lr.ok)throw new Error('No se pudieron vincular las guías (quizás ya pertenecen a otra COT).');
   gcState.loaded=false;gcState.draft=null;panelCerrar();await gcInit();toast('COT registrada con '+links.length+' guías.');
 }catch(e){
   if(createdId){
     const undo=await sb('guias_cot?id=eq.'+createdId,{method:'DELETE'});
     if(!undo.ok)console.error('La COT quedó sin vinculación. Requiere revisión: ',createdId);
   }
   toast(e.message||'No se pudo registrar','err');
 }
}
function gcEdit(id){
 if(!gcEditor())return;
 const cot=gcState.cots.find(c=>Number(c.id)===Number(id));if(!cot)return;
 panelAbrir({antetitulo:'FACTURAS DE VENTA',titulo:'Editar COT',
   sub:'La lista de guías queda intacta. Para corregir una asociación errónea debes borrar la COT completa.',
   cuerpo:'<div class="gc-form"><label>Número</label><input id="gc-edit-number" value="'+gcEsc(cot.numero_cot||'')+'"><label>Monto con IVA</label><input id="gc-edit-amount" type="number" value="'+Number(cot.monto_total)+'"><label>Vencimiento</label><input id="gc-edit-exp" type="date" value="'+(cot.fecha_vencimiento||'')+'"><label>Nota</label><textarea id="gc-edit-note">'+gcEsc(cot.nota||'')+'</textarea><button class="gc-primary" onclick="gcSaveEdit('+Number(cot.id)+')">Guardar</button></div>'},true);
}
async function gcSaveEdit(id){
 if(!gcEditor())return;
 const row={numero_cot:document.getElementById('gc-edit-number').value.trim().toUpperCase()||null,monto_total:Number(document.getElementById('gc-edit-amount').value),
   fecha_vencimiento:document.getElementById('gc-edit-exp').value||null,nota:document.getElementById('gc-edit-note').value.trim()||null};
 if(!Number.isSafeInteger(row.monto_total)||row.monto_total<=0){toast('Monto no válido','err');return;}
 const res=await sb('guias_cot?id=eq.'+id,{method:'PATCH',body:JSON.stringify(row)});
 if(!res.ok){toast('No se pudo guardar la edición','err');return;}
 panelCerrar();gcState.loaded=false;await gcInit();toast('COT actualizada');
}
async function gcDelete(id){
 if(!gcEditor())return;
 if(!await confirmModal('Se eliminará esta COT y se liberarán sus guías. ¿Confirmas?',{textoOk:'Eliminar COT'}))return;
 const res=await sb('guias_cot?id=eq.'+id,{method:'DELETE'});
 if(!res.ok){toast('No se pudo borrar la COT','err');return;}
 gcState.loaded=false;await gcInit();toast('COT eliminada');
}
function gcExcel(){
 if(typeof XLSX==='undefined'){toast('No está disponible la descarga Excel.','err');return;}
 const book=XLSX.utils.book_new(),stages=[['sincot','Sin COT'],['encot','En COT'],['conoc','Con OC'],['facturada','Facturada']];
 const groups=gcState.year===2025?[]:gcGroups(),hospital=gcState.hospital==='todos'?'Todos salvo Roberto del Río':gcHospitals().find(h=>h.id===gcState.hospital)?.name||gcState.hospital;
 stages.forEach(([stage,name])=>{
   const rows=[['Hospital',hospital],['Período',gcMonths[gcState.month]+' '+gcState.year],['Emitido',new Date().toLocaleDateString('es-CL')],[],['Fecha guía','N° guía','Monto neto','Total con IVA','COT','OC','Factura']];
   let net=0,total=0;
   groups.filter(g=>g.stage===stage).forEach(g=>g.guides.forEach(d=>{
     const n=gcNet(d),t=gcNum(d);net+=n;total+=t;
     rows.push([gcDateDisplay(d.fecha_emision),String(d.folio),n,t,g.cot?.numero_cot||'',g.oc||'',g.invoice?.folio||'']);
   }));
   rows.push(['TOTAL','',net,total,'','','']);
   const ws=XLSX.utils.aoa_to_sheet(rows);
   ws['!cols']=[{wch:17},{wch:14},{wch:18},{wch:19},{wch:25},{wch:23},{wch:14}];
   XLSX.utils.book_append_sheet(book,ws,name);
 });
 XLSX.writeFile(book,'Guias_por_facturar_'+gcMonthKey(gcState.year,gcState.month)+'.xlsx');
}

// Vista simulada, aislada del servidor. Se activa con ?guias_demo=1#guias-cot.
function gcLoadDemo(){
 const amounts=[106446,6009500,160234,310709,56287,147025];
 const dates=['2026-06-02','2026-06-04','2026-06-05','2026-06-08','2026-06-09','2026-06-10'];
 gcState.demoGuides=amounts.map((amount,i)=>({id:95000+i,folio:String(5396+i),tipo_dte:'52',fecha_emision:dates[i],
   rut_hospital:'65075485-9',hospital:'Hospital Clínico La Florida',monto:Math.round(amount/1.19),monto_total:amount,orden_compra_ref:null}));
 gcState.demoInvoices=[];
 gcState.cots=[{id:99001,numero_cot:'812030-1038-COT26',rut_hospital:'65075485-9',hospital:'Hospital Clínico La Florida',
   monto_total:6790201,fecha_vencimiento:'2026-11-02',periodo_mes:'2026-06-01',quincena:1,nota:null}];
 gcState.links=gcState.demoGuides.map(g=>({cot_id:99001,guia_documento_id:g.id}));
 gcState.year=2026;gcState.month=5;gcState.hospital='65075485-9';
}
