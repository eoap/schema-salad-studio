'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {inspect,mutate,serializeInDependencyOrder}=require('../src/model');
let chromium;try{({chromium}=require('@playwright/test'));}catch{({chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'));}
(async()=>{
let text=fs.readFileSync('examples/starter.salad.yml','utf8'),version=1,history=[text],index=0;
const errors=[];
const server=http.createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/media/studio.css"></head><body><div id="app"></div><script>window.acquireVsCodeApi=()=>({getState:()=>window.savedState,setState:s=>window.savedState=s,postMessage:m=>window.bridge(m)})</script><script src="/media/type-utils.js"></script><script src="/media/studio.js"></script></body></html>');}
 else if(['/media/studio.css','/media/studio.js','/media/type-utils.js'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,'..',req.url)));}else{res.writeHead(404);res.end();}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']}).catch(e=>{server.close();throw e;});
try{
 const page=await browser.newPage({viewport:{width:1540,height:1000}});page.setDefaultTimeout(8000);page.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR',e.message);});
 const publish=()=>page.evaluate(s=>(document.body.dataset.testVersion=String(s.version),window.dispatchEvent(new MessageEvent('message',{data:{kind:'state',state:s}}))),inspect(text,version));
 await page.exposeFunction('bridge',async m=>{if(m.kind==='ready')await publish();if(m.kind==='edit'){try{assert.equal(m.version,version);text=mutate(text,m.operation);version++;history=history.slice(0,index+1);history.push(text);index++;await publish();}catch(e){await publish();await page.evaluate(message=>window.dispatchEvent(new MessageEvent('message',{data:{kind:'error',message}})),e.message);}}if(m.kind==='save'){const result=serializeInDependencyOrder(text);if(result.changed){text=result.text;version++;history=history.slice(0,index+1);history.push(text);index++;await publish();}}if(m.kind==='undo'&&index){text=history[--index];version++;await publish();}if(m.kind==='redo'&&index<history.length-1){text=history[++index];version++;await publish();}});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.card').first().waitFor();
 const waitEdit=async(old)=>{await page.waitForFunction(v=>document.body.dataset.testVersion===String(v),old+1);await page.waitForFunction(n=>document.querySelectorAll('.edge').length===n,inspect(text).edges.length);};
 const change=async(label,value)=>{const old=version;await page.getByLabel(label,{exact:true}).fill(value);await page.getByLabel(label,{exact:true}).press('Enter');await waitEdit(old);};
 const card=name=>page.getByRole('article',{name:name+' type',exact:true});
 assert.equal(await page.locator('.inspector').count(),0);assert.equal(await page.getByRole('button',{name:'Apply',exact:true}).count(),0);assert.equal(await page.locator('.card').count(),5);assert.equal(await page.locator('.edge').count(),5);
 await page.locator('.viewport').click({button:'right',position:{x:420,y:760}});await page.getByRole('menuitem',{name:'Add  ›',exact:true}).click();
 for(const name of ['Enum','Record','Mapping','Union','Documentation'])assert.equal(await page.getByRole('menuitem',{name,exact:true}).count(),1);
 await page.screenshot({path:'../schema-salad-studio-preview.png',fullPage:true});
 let old=version;await page.getByRole('menuitem',{name:'Enum',exact:true}).click();await waitEdit(old);assert.equal(await page.locator('.card').count(),6);
 await change('Type name NewEnum','Quality');
 old=version;await page.getByRole('textbox',{name:'New enum value for Quality',exact:true}).fill('good');await page.getByRole('textbox',{name:'New enum value for Quality',exact:true}).press('Enter');await waitEdit(old);
 old=version;await page.getByRole('textbox',{name:'New enum value for Quality',exact:true}).fill('bad');await page.getByRole('button',{name:'Add enum value to Quality',exact:true}).click();await waitEdit(old);
 await change('Enum value good','excellent');assert.deepEqual(inspect(text).definitions.at(-1).value.symbols,['excellent','bad']);
 old=version;await page.getByRole('button',{name:'Remove enum value bad',exact:true}).click();await waitEdit(old);assert.deepEqual(inspect(text).definitions.at(-1).value.symbols,['excellent']);
 await page.getByRole('textbox',{name:'New enum value for ProductKind',exact:true}).fill('radar');await page.getByRole('button',{name:'Add enum value to ProductKind',exact:true}).click();await page.getByRole('alert').filter({hasText:'already exists'}).waitFor();
 old=version;await page.getByRole('button',{name:'Add field to CatalogItem',exact:true}).click();await waitEdit(old);await change('Field name newField','quality');assert.match(text,/name: quality/);
 await page.getByRole('textbox',{name:'Field name quality',exact:true}).fill('cancelled');await page.getByRole('textbox',{name:'Field name quality',exact:true}).press('Escape');assert.doesNotMatch(text,/name: cancelled/);
 old=version;await page.getByRole('textbox',{name:'Field name quality',exact:true}).fill('rating');await page.locator('.canvas-toolbar').click({position:{x:30,y:20}});await waitEdit(old);assert.match(text,/name: rating/);
 await change('Type of rating','ProductKind');assert.equal(await page.locator('.edge').count(),6);await change('Type of rating','string');assert.equal(await page.locator('.edge').count(),5);
 const wire=async(field,target)=>{await page.locator('.viewport').evaluate(e=>{e.scrollTop=0;e.scrollLeft=0;});await page.getByRole('button',{name:'Connect '+field,exact:true}).scrollIntoViewIfNeeded();const from=await page.getByRole('button',{name:'Connect '+field,exact:true}).boundingBox(),to=await card(target).boundingBox();await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+100,to.y+25,{steps:12});assert.equal(await page.locator('.wire-preview').count(),1);const v=version;await page.mouse.up();await waitEdit(v);};
 await wire('rating','Asset');assert.match(text,/name: rating\s+type: Asset/);assert.equal(await page.locator('.edge').count(),6);
 old=version;await page.getByRole('button',{name:'Undo',exact:true}).click();await waitEdit(old);assert.equal(await page.locator('.edge').count(),5);old=version;await page.getByRole('button',{name:'Redo',exact:true}).click();await waitEdit(old);assert.equal(await page.locator('.edge').count(),6);
 await change('Type name Asset','Resource');assert.match(text,/name: rating\s+type: Resource/);assert.equal(await page.locator('.edge').count(),6);
 await page.getByRole('textbox',{name:'Field name rating',exact:true}).focus();const beforeCancel=text,from=await page.getByRole('button',{name:'Connect rating',exact:true}).boundingBox();await page.mouse.move(from.x+7,from.y+7);await page.mouse.down();await page.mouse.move(from.x+50,from.y+50);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(text,beforeCancel);assert.equal(await page.locator('.wire-preview').count(),0);
 await card('Resource').locator('.card-kind').click({button:'right'});await page.getByRole('menuitem',{name:'Delete definition…',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('alert').filter({hasText:'reference'}).waitFor();assert.equal(inspect(text).definitions.length,6);
 const field=card('CatalogItem').locator('[data-field]').filter({has:page.getByRole('textbox',{name:'Field name rating',exact:true})});await field.click({button:'right',position:{x:2,y:2}});await page.getByRole('menuitem',{name:'Delete field…',exact:true}).click();old=version;await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click();await waitEdit(old);assert.doesNotMatch(text,/name: rating/);
 const head=card('CatalogItem').locator('.card-kind'),before=await head.boundingBox();await page.mouse.move(before.x+40,before.y+4);await page.mouse.down();await page.mouse.move(before.x+70,before.y+80,{steps:8});await page.mouse.up();const after=await head.boundingBox();assert.ok(after.y>before.y+40);
 await page.getByRole('textbox',{name:'Find a type or field',exact:true}).fill('radar');assert.equal(await page.locator('.tree .tree-item:not(.root)').count(),1);await page.getByRole('textbox',{name:'Find a type or field',exact:true}).fill('');
 await page.getByRole('button',{name:'−',exact:true}).click();await wire('mediaType','ProductKind');assert.equal(await page.locator('.edge').count(),6);
 // Dependency serialization must preserve the selected field and visual layout.
 old=version;await page.getByRole('button',{name:'Add field to CatalogItem',exact:true}).click();await waitEdit(old);
 await change('Type of newField','Quality');
 const priorNames=inspect(text).definitions.map(d=>d.value.name);assert.ok(priorNames.indexOf('CatalogItem')<priorNames.indexOf('Quality'));
 const beforeSave=await card('CatalogItem').boundingBox();
 old=version;await page.getByRole('button',{name:'Save',exact:true}).click();await waitEdit(old);
 const savedNames=inspect(text).definitions.map(d=>d.value.name);assert.ok(savedNames.indexOf('Quality')<savedNames.indexOf('CatalogItem'));
 const afterSave=await card('CatalogItem').boundingBox();assert.ok(Math.abs(beforeSave.x-afterSave.x)<1);assert.ok(Math.abs(beforeSave.y-afterSave.y)<1);
 assert.equal(await card('CatalogItem').locator('.field-row.selected').getByRole('textbox',{name:'Field name newField',exact:true}).count(),1);
 await change('Field name newField','orderedField');assert.ok(inspect(text).definitions.find(d=>d.value.name==='CatalogItem').value.fields.some(f=>f.name==='orderedField'&&f.type==='Quality'));
 // New fields default to false; saved schemas expose their existing flags.
 assert.equal(await page.getByRole('checkbox',{name:'Array for orderedField',exact:true}).isChecked(),false);
 assert.equal(await page.getByRole('checkbox',{name:'Nullable for orderedField',exact:true}).isChecked(),false);
 assert.equal(await page.getByRole('checkbox',{name:'Array for assets',exact:true}).isChecked(),true);
 assert.equal(await page.getByRole('checkbox',{name:'Nullable for description',exact:true}).isChecked(),true);
 const toggle=async(label,on)=>{const v=version;await page.getByRole('checkbox',{name:label,exact:true}).setChecked(on);await waitEdit(v);};
 await toggle('Array for orderedField',true);await toggle('Nullable for orderedField',true);
 await wire('orderedField','ProductKind');
 const valueField=()=>inspect(text).definitions.find(d=>d.value.name==='CatalogItem').value.fields.find(f=>f.name==='orderedField');
 assert.deepEqual(valueField().type,['null',{type:'array',items:'ProductKind'}]);
 const properties=async(type,name)=>{const row=card(type).locator('[data-field]').filter({has:page.getByRole('textbox',{name:'Field name '+name,exact:true})});await row.click({button:'right',position:{x:2,y:2}});await page.getByRole('menuitem',{name:'Properties…',exact:true}).click();await page.getByRole('dialog').waitFor();};
 const saveDefault=async()=>{const v=version;await page.getByRole('button',{name:'Save default',exact:true}).click();await waitEdit(v);await page.getByRole('dialog').waitFor({state:'hidden'});};
 await properties('CatalogItem','orderedField');await page.getByLabel('Default mode',{exact:true}).selectOption('value');await page.getByRole('button',{name:'+ Add item',exact:true}).click();await page.getByLabel('Default item',{exact:true}).selectOption('radar');
 await page.locator('.toast').evaluateAll(es=>es.forEach(e=>e.remove()));await page.screenshot({path:'../schema-salad-studio-defaults-preview.png',fullPage:true});
 await saveDefault();assert.deepEqual(valueField().default,['radar']);
 await properties('CatalogItem','orderedField');await page.getByLabel('Default mode',{exact:true}).selectOption('null');await saveDefault();assert.equal(valueField().default,null);
 await properties('CatalogItem','orderedField');await page.getByLabel('Default mode',{exact:true}).selectOption('none');await saveDefault();assert.equal(Object.hasOwn(valueField(),'default'),false);
 await properties('Resource','href');await page.getByLabel('Default mode',{exact:true}).selectOption('value');await page.getByLabel('Default',{exact:true}).fill('null');await saveDefault();
 const href=()=>inspect(text).definitions.find(d=>d.value.name==='Resource').value.fields.find(f=>f.name==='href');assert.equal(href().default,'null');
 await change('Type of href','boolean');await properties('Resource','href');assert.equal(await page.getByRole('checkbox',{name:'Default',exact:true}).isChecked(),false);await saveDefault();assert.equal(href().default,false);
 await change('Type of href','int');await properties('Resource','href');await page.getByLabel('Default',{exact:true}).fill('1.5');await page.getByRole('button',{name:'Save default',exact:true}).click();assert.ok(await page.getByRole('dialog').getByRole('alert').textContent());await page.getByLabel('Default',{exact:true}).fill('0');await saveDefault();assert.equal(href().default,0);
 // Removing flags never requires a YAML expression.
 await toggle('Array for orderedField',false);await toggle('Nullable for orderedField',false);assert.equal(valueField().type,'ProductKind');
 // A local record default is entered through named field controls.
 await change('Type of orderedField','Resource');await properties('CatalogItem','orderedField');await page.getByLabel('Default mode',{exact:true}).selectOption('value');await page.getByRole('checkbox',{name:'Include href',exact:true}).check();await page.getByLabel('href',{exact:true}).fill('13');await saveDefault();assert.deepEqual(valueField().default,{href:13});
 await properties('CatalogItem','orderedField');await page.getByLabel('Default mode',{exact:true}).selectOption('none');await saveDefault();
 await change('Type of orderedField','AssetIndex');await properties('CatalogItem','orderedField');await page.getByLabel('Default mode',{exact:true}).selectOption('value');await page.getByRole('button',{name:'+ Add entry',exact:true}).click();await page.getByLabel('Default key',{exact:true}).fill('asset');await page.getByRole('checkbox',{name:'Include href',exact:true}).check();await page.getByLabel('href',{exact:true}).fill('42');await saveDefault();assert.deepEqual(valueField().default,{asset:{href:42}});
 assert.deepEqual(errors,[]);console.log('PASS: context submenu; inline Enter/blur/Escape; enum list CRUD; automatic edges; real mouse preview/drop/cancel at two zoom levels; undo/redo; guarded deletion; header drag; search; dependency-ordered Save; array/nullable controls; wrapper-preserving wiring; typed default forms and validation.');

}catch(e){const p=browser.contexts()[0]?.pages()[0];if(p){console.log(await p.locator('input').evaluateAll(es=>es.map(e=>[e.getAttribute('aria-label'),e.value])));await p.screenshot({path:'/tmp/salad-failure.png'});}throw e;}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
