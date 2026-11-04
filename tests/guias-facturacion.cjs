const { chromium }=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');const assert=require('assert');const path=require('path');const os=require('os');
process.chdir(path.join(__dirname,'..'));const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'guias-ui-'));
(async()=>{
 const browser=await chromium.launchPersistentContext(path.join(tmp,'profile'),{headless:true,executablePath:process.env.CHROME_PATH || undefined,viewport:{width:1280,height:900}});const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let fail=false,missing=false,saveBody=null;
 const fact=(id,folio)=>({id,folio,tipo_dte:'33',rut_hospital:'65.075.485-9',hospital:'Hospital La Florida',fecha_emision:'2026-05-25',monto_total:300,estado_aceptacion:'A'});
 const docs=[{...fact(1,'21205'),orden_compra_ref:'812030-547-AG26'},{...fact(2,'21206')},{...fact(3,'21207'),estado_reclamo:'RCD'},...[10,11,12].map((id,i)=>({id,folio:String(5151+i),tipo_dte:'52',rut_hospital:'65075485-9',hospital:'Hospital La Florida',fecha_emision:'2026-01-0'+(5+i),monto_total:100}))];
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'){const file='./'+(u.pathname==='/'?'index.html':u.pathname.slice(1));return route.fulfill({status:200,body:fs.readFileSync(file),contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':'text/html'});}if(u.pathname.includes('/rest/v1/')){
 let result=[];let status=200;
 if(u.pathname.endsWith('documentos_gdexpress')){const id=u.searchParams.get('id')?.replace('eq.','');if(!id)result=docs;else if(fail && id==='2'){status=503;result={message:'Error simulado'};}else result=[{id:Number(id),xml_completo:`<DTE xmlns="urn:test"><Documento>${id==='1'?'<Referencia><TpoDocRef>52</TpoDocRef><FolioRef>5151</FolioRef></Referencia>':''}</Documento></DTE>`}];}
 if(u.pathname.endsWith('facturas_pago'))result=[{factura:'21205',rut_hospital:'65075485-9',estado_pago:'Pagado'}];
 if(u.pathname.endsWith('guias_facturacion_grupos')){if(missing){status=404;result={code:'PGRST205',message:'Tabla ausente'};}else result=[{factura_id:2,periodo:'2026-01-01',etiqueta:'Enero 2',orden_compra:'812030-602-AG26',cotizacion:'812030-642-COT26',version:1}];}
 if(u.pathname.endsWith('guias_facturacion_enlaces'))result=[{factura_id:2,guia_id:11}];
 if(u.pathname.endsWith('guias_facturacion_historial'))result=[{creado_en:'2026-11-04T14:00:00Z',accion:'guias_facturacion_enlaces INSERT',detalle:{guia:'5152'}}];
 if(u.pathname.endsWith('guias_facturacion_guardar')){saveBody=route.request().postDataJSON();status=409;result={message:'Otra persona modificó esta asociación. Recarga antes de guardar'};}
 return route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
 }return route.fulfill({status:200,body:'',contentType:u.pathname.endsWith('.css')?'text/css':'application/javascript'});});
 await page.goto('http://127.0.0.1:8765');
 await page.evaluate(d=>{documentosGdexpress=d;facturasPago=[{factura:'21205',rut_hospital:'65075485-9',estado_pago:'Pagado'}];oc=[{codigooc:'812030-547-AG26',codigolicitacion:'812030-554-COT26'}];sesionActual={rol:'editor'};document.querySelectorAll('body>div').forEach(e=>{if(e.id.includes('login'))e.style.display='none'});showPage('guias-facturacion');gfInit();},docs);
 await page.selectOption('#gf-hospital','650754859');await page.fill('#gf-anio','2026');await page.click('#gf-cargar');await page.waitForFunction(()=>gf.listo&&!gf.ocupado);
 assert.equal(await page.evaluate(()=>gfGuias().length),3);assert.equal(await page.evaluate(()=>gfCobertura(gf.docs.find(d=>d.id===10)).length),1);assert.equal(await page.evaluate(()=>gfCOT(gf.docs[0])),'812030-554-COT26');
 assert.equal(await page.evaluate(()=>gfPeriodo(gf.docs.find(d=>d.id===2))),'2026-01 · Enero 2');
 await page.selectOption('#gf-mes','01');assert(await page.locator('#gf-resultados').innerText().then(t=>t.includes('21205')));
 await page.evaluate(()=>gfAbrir(1));await page.getByText('Guías de despacho asociadas (1)',{exact:true}).click();assert(await page.locator('#panel-lateral').innerText().then(t=>t.includes('5151')));
 await page.evaluate(()=>{panelCerrar();gfEditar(2)});assert(await page.locator('input[name="guia"][value="10"]').isDisabled());
 await page.fill('#gf-etiqueta','Enero "2" <prueba>');await page.fill('#gf-motivo','Prueba simulada');await page.click('#gf-guardar');await page.waitForFunction(()=>document.getElementById('gf-guardar-error').textContent.includes('Otra persona'));assert.equal(saveBody.p_version,1);assert.equal(saveBody.p_guias[0],11);assert(await page.locator('#gf-form').isVisible());
 await page.evaluate(()=>panelCerrar());await page.selectOption('#gf-vista','pendientes');assert(await page.locator('#gf-resultados').innerText().then(t=>t.includes('5153')&&!t.includes('5151')));
 await page.selectOption('#gf-vista','facturas');await page.waitForTimeout(500);await page.screenshot({path:path.join(tmp,'desktop.png'),fullPage:true});
 await page.evaluate(()=>{gfAbrir(2)});await page.waitForTimeout(500);await page.screenshot({path:path.join(tmp,'ficha.png')});await page.evaluate(()=>panelCerrar());
 // Una referencia repetida no se oculta como pendiente ni se confirma silenciosamente.
 assert.equal(await page.evaluate(()=>{gf.referencias.set(2,['5151']);gf.grupos=[];gf.enlaces=[];return gfCobertura(gf.docs.find(d=>d.id===10)).length}),2);
 missing=true;await page.evaluate(()=>{gf.xml.clear()});await page.click('#gf-cargar');await page.waitForFunction(()=>!gf.ocupado);assert(await page.locator('#gf-aviso').innerText().then(t=>t.includes('provisionales')));
 missing=false;fail=true;await page.evaluate(()=>{gf.xml.clear()});await page.click('#gf-cargar');await page.waitForFunction(()=>!gf.ocupado);assert.equal(await page.evaluate(()=>gf.listo),false);assert(await page.locator('#gf-aviso').innerText().then(t=>t.includes('Cruce incompleto')));
 fail=false;await page.click('#gf-cargar');await page.waitForFunction(()=>gf.listo&&!gf.ocupado);await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:path.join(tmp,'mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.getElementById('page-guias-facturacion').scrollWidth<=document.getElementById('page-guias-facturacion').clientWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS: XML con namespace, OC/COT, período, exclusión rechazo, pendientes, conflicto, edición, guardado fallido conserva formulario, tabla ausente, error parcial, móvil; sin escrituras reales.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
