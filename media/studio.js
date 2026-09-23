/* Browser UI; schema mutations are versioned WorkspaceEdits in the extension. */
'use strict';
const vscode=acquireVsCodeApi(),saved=vscode.getState()||{};
const Types=globalThis.SaladTypes;
let state,selection=saved.selection??null,positions=saved.positions||{},zoom=saved.zoom||1;
let filter='',showIssues=false,busy=false,linkFrom=null,gesture=null,focusAfter=null,afterEdit=null,pendingVersion=null;
const app=document.getElementById('app');
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),key=p=>JSON.stringify(p);
const at=p=>p.reduce((v,k)=>v?.[k],state.data);
const save=()=>vscode.setState({selection,positions,zoom});
const send=(kind,extra={})=>{if(kind==='save')document.activeElement?.blur?.();vscode.postMessage({kind,...extra});};
const fieldPath=p=>p.at(-2)==='fields';
function edit(operation,onSuccess){
  if(busy){toast('An edit is being saved. Please try again in a moment.');return false;}
  busy=true;afterEdit=onSuccess;pendingVersion=state.version;closeMenu();send('edit',{version:state.version,operation});return true;
}
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function button(text,fn,cls=''){const e=el('button',cls,text);e.type='button';e.onclick=fn;return e;}
function toast(text){document.querySelector('.toast')?.remove();const t=el('div','toast',text);t.role='alert';t.append(button('×',()=>t.remove()));document.body.append(t);setTimeout(()=>t.remove(),7000);}
function typeLabel(t){if(typeof t==='string')return t;if(Array.isArray(t))return t.map(typeLabel).join(' | ');if(obj(t)){if(t.type==='array')return typeLabel(t.items)+'[]';if(t.type==='map')return 'map<'+typeLabel(t.values)+'>';if(t.type==='union')return typeLabel(t.names);return t.name||t.type||'?';}return '?';}
function fields(v,p){if(Array.isArray(v?.fields))return v.fields.map((v,i)=>({value:v,path:[...p,'fields',i]}));if(obj(v?.fields))return Object.entries(v.fields).map(([n,v])=>({value:obj(v)?{...v,name:n}:{name:n,type:v},path:[...p,'fields',n]}));return [];}
function nodeValue(p){const raw=at(p);return typeof p.at(-1)==='string'&&fieldPath(p)?(obj(raw)?{...raw,name:p.at(-1)}:{name:p.at(-1),type:raw}):raw;}
function choose(p){selection=p;save();document.querySelectorAll('[data-path],[data-field]').forEach(e=>e.classList.toggle(e.classList.contains('card')?'active':'selected',equal(JSON.parse(e.dataset.field||e.dataset.path),p)));}
function docText(v){return typeof v==='string'?v:Array.isArray(v)?v.filter(x=>typeof x==='string').join('\n'):'';}
function inline(value,label,commit,cls='',id=label){
  const input=el('input','inline-input '+cls);input.value=value??'';input.setAttribute('aria-label',label);input.title='Edit inline · Enter or click away to save · Escape to cancel';input.dataset.focus=id;input.spellcheck=false;
  let initial=String(value??''),cancel=false;
  const submit=()=>{if(cancel||input.value===initial)return;const next=input.value;initial=next;commit(next);};
  input.onblur=submit;input.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();submit();input.blur();}if(e.key==='Escape'){cancel=true;input.value=String(value??'');input.blur();cancel=false;}};
  input.onpointerdown=e=>e.stopPropagation();input.onclick=e=>e.stopPropagation();return input;
}
function setProperty(p,k,value){
  const old=nodeValue(p);let oldName=old?.name;
  edit({kind:'set',path:p,key:k,value},()=>{
    if(k==='name'){
      if(positions[oldName]){positions[value]=positions[oldName];delete positions[oldName];}
      if(typeof p.at(-1)==='string'&&fieldPath(p)){selection=[...p.slice(0,-1),value];}else selection=p;
      save();
    }
  });
}
function typeInput(value,p,property,description){
  const shape=Types.split(value),shown=fieldPath(p)&&property==='type'?(shape.array?shape.core.items:shape.core??'null'):value;
  const input=inline(typeLabel(shown),description,text=>{
    const parts=text.split('|').map(s=>s.trim());if(parts.some(s=>!s)){toast('Enter a type name, or alternatives separated by |.');render();return;}
    let next=parts.length===1?parts[0]:parts;
    if(fieldPath(p)&&property==='type'&&!/[?\[\]]/.test(text))next=Types.replaceBase(nodeValue(p).type,next);
    setProperty(p,property,next);
  },'type-input',key(p)+':'+property);input.setAttribute('list','type-names');return input;
}
function focusControl(id){requestAnimationFrame(()=>{const e=[...document.querySelectorAll('[data-focus]')].find(e=>e.dataset.focus===id);e?.focus();e?.select?.();});}
function addField(p){edit({kind:'addField',path:p},()=>{const f=fields(at(p),p).at(-1);if(f){selection=f.path;focusAfter=key(f.path)+':name';}});}
function render(){
  closeMenu();const viewport=document.querySelector('.viewport'),scroll=viewport?{left:viewport.scrollLeft,top:viewport.scrollTop}:null;
  const focused=document.activeElement,focusId=focused?.dataset.focus,caret=focused?.selectionStart;
  app.replaceChildren();const header=el('header'),brand=el('div','brand');brand.append(el('b','','◈'),document.createTextNode('Schema Salad Studio'));header.append(brand,el('span','tag','SCHEMA DESIGNER'),el('div','spacer'));
  const tools=el('div','toolbar');tools.append(button('Undo',()=>send('undo')),button('Redo',()=>send('redo')),button('YAML ↗',()=>send('source')),button('Save',()=>send('save'),'primary'));header.append(tools);app.append(header);
  if(!state)return;
  if(state.error){const e=el('div','empty');e.append(el('h2','','Check the YAML document'),el('pre','',state.error),button('Open YAML',()=>send('source')));app.append(e);return;}
  if(selection&&at(selection)===undefined)selection=null;
  const names=el('datalist');names.id='type-names';for(const n of ['string','boolean','int','long','float','double','null','Any',...state.definitions.filter(d=>d.value?.type!=='documentation').map(d=>d.value?.name).filter(Boolean)]){const o=el('option');o.value=n;names.append(o);}app.append(names);
  const layout=el('div','workspace');layout.append(tree(),canvas());app.append(layout);
  if(scroll){const v=document.querySelector('.viewport');v.scrollLeft=scroll.left;v.scrollTop=scroll.top;}
  const footer=el('footer','status');footer.append(el('span','',`${state.definitions.length} definitions`),button(`${state.issues.length} local checks`,()=>{showIssues=!showIssues;render();}),el('span','','Right-click to add · Edit names in place · Drag ports to set types'),el('span','spacer'),el('span','','Local checks · imports not resolved'));app.append(footer);
  if(showIssues){const issues=el('div','issues');issues.append(el('strong','','Local structural checks'));for(const i of state.issues)issues.append(el('div','issue',i.severity.toUpperCase()+' · '+i.message));if(!state.issues.length)issues.append(el('p','','No local issues. Full Schema Salad validation is separate.'));app.append(issues);}
  requestAnimationFrame(drawEdges);
  if(focusAfter){focusControl(focusAfter);focusAfter=null;}else if(focusId){const input=[...document.querySelectorAll('[data-focus]')].find(e=>e.dataset.focus===focusId);input?.focus();if(typeof caret==='number')input?.setSelectionRange?.(caret,caret);}
}
function tree(){
  const aside=el('aside','tree-pane'),head=el('div','tree-head');head.append(el('h2','pane-title','Schema explorer'));
  const search=el('input');search.placeholder='Find a type or field…';search.setAttribute('aria-label','Find a type or field');search.dataset.focus='search';search.value=filter;search.oninput=()=>{filter=search.value;render();};head.append(search);aside.append(head);
  const body=el('div','tree');body.append(button('◇  Document metadata',()=>openProperties([]),'tree-item root'));
  function item(v,p,container,depth=0){
    if(!obj(v)||depth>12)return;
    const name=v.name||v.$import||v.$include||typeLabel(v),row=button('',()=>{choose(p);document.querySelectorAll('.card').forEach(c=>{const cp=JSON.parse(c.dataset.path);if(cp.every((k,i)=>p[i]===k))c.scrollIntoView({block:'nearest',inline:'nearest'});});},'tree-item'+(equal(selection,p)?' selected':''));row.dataset.path=key(p);row.title=name;row.append(el('span','badge',({record:'R',enum:'E',map:'M',union:'U',documentation:'D'})[v.type]||'·'),el('span','',name),el('small','',fieldPath(p)?typeLabel(v.type):''));row.oncontextmenu=e=>contextMenu(e,p);row.ondblclick=()=>openProperties(p);container.append(row);
    const child=el('div','children');fields(v,p).forEach(f=>item(f.value,f.path,child,depth+1));
    for(const k of ['type','items','values','names']){if(obj(v[k]))item(v[k],[...p,k],child,depth+1);else if(Array.isArray(v[k]))v[k].forEach((t,i)=>{if(obj(t))item(t,[...p,k,i],child,depth+1);});}
    if(child.childNodes.length)container.append(child);
  }
  state.definitions.filter(d=>JSON.stringify(d.value).toLowerCase().includes(filter.toLowerCase())).forEach(d=>item(d.value,d.path,body));aside.append(body);return aside;
}
function position(d,i){return positions[d.value?.name||key(d.path)]||{x:44+(i%3)*365,y:50+Math.floor(i/3)*530};}
function canvas(){
  const main=el('main'),bar=el('div','canvas-toolbar');bar.append(el('span','','Type diagram'),el('span','canvas-hint','Right-click the canvas to add a type'),el('span','spacer'));
  bar.append(button('−',()=>{zoom=Math.max(.4,zoom-.1);save();render();}),el('span','',Math.round(zoom*100)+'%'),button('+',()=>{zoom=Math.min(1.6,zoom+.1);save();render();}),button('Arrange',()=>{positions={};save();render();}));main.append(bar);
  const viewport=el('div','viewport');viewport.setAttribute('aria-label','Schema type diagram');viewport.tabIndex=0;viewport.oncontextmenu=e=>contextMenu(e,null);viewport.onkeydown=e=>{if((e.shiftKey&&e.key==='F10')||e.key==='ContextMenu'){e.preventDefault();const r=viewport.getBoundingClientRect();contextMenu({preventDefault(){},stopPropagation(){},clientX:r.left+35,clientY:r.top+35},null);}};
  const world=el('div','world');world.style.transform=`scale(${zoom})`;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('edges');world.append(svg);
  state.definitions.forEach((d,i)=>{
    const v=d.value;if(!obj(v))return;const pos=position(d,i),card=el('article','card '+v.type+(equal(selection,d.path)?' active':''));card.dataset.path=key(d.path);card.style.left=pos.x+'px';card.style.top=pos.y+'px';card.setAttribute('aria-label',(v.name||v.$import||'Definition')+' type');card.oncontextmenu=e=>contextMenu(e,d.path);card.onclick=()=>{if(linkFrom&&v.name&&v.type!=='documentation'){const from=linkFrom;linkFrom=null;edit({kind:'connect',path:from,target:d.path});}else choose(d.path);};
    const head=el('div','card-head');head.setAttribute('aria-label','Move '+(v.name||'definition'));const kind=el('div','card-kind',v.type==='map'?'mapping':v.type||'External reference');if(v.documentRoot)kind.append(el('span','root-tag','ROOT'));head.append(kind);
    if(v.name)head.append(inline(v.name,'Type name '+v.name,value=>setProperty(d.path,'name',value),'card-title',key(d.path)+':name'));else head.append(el('div','card-title',v.$import||v.$include||'?'));
    const menu=button('⋯',e=>{e.stopPropagation();const r=menu.getBoundingClientRect();contextMenu({preventDefault(){},stopPropagation(){},clientX:r.left,clientY:r.bottom},d.path);},'card-menu');menu.setAttribute('aria-label','Menu for '+(v.name||'definition'));menu.onpointerdown=e=>e.stopPropagation();head.append(menu);card.append(head);
    head.onpointerdown=e=>{if(e.button!==0||e.target.closest('input,button'))return;e.preventDefault();choose(d.path);const start={x:e.clientX,y:e.clientY},origin={x:card.offsetLeft,y:card.offsetTop};let moved=false;head.setPointerCapture(e.pointerId);head.onpointermove=m=>{if(Math.abs(m.clientX-start.x)+Math.abs(m.clientY-start.y)<4&&!moved)return;moved=true;const p={x:Math.max(0,origin.x+(m.clientX-start.x)/zoom),y:Math.max(0,origin.y+(m.clientY-start.y)/zoom)};positions[v.name||key(d.path)]=p;card.style.left=p.x+'px';card.style.top=p.y+'px';drawEdges();};head.onpointerup=()=>{head.onpointermove=null;save();};head.onpointercancel=()=>{head.onpointermove=null;};};
    if(v.doc){const doc=el('div','card-doc',docText(v.doc));doc.title='Double-click to edit documentation';doc.ondblclick=()=>openProperties(d.path);card.append(doc);}
    if(v.extends)card.append(el('div','inheritance','extends '+typeLabel(v.extends)));
    if(v.type==='record'){
      for(const f of fields(v,d.path)){
        const row=el('div','field-row'+(equal(selection,f.path)?' selected':''));row.dataset.field=key(f.path);row.oncontextmenu=e=>contextMenu(e,f.path);row.onclick=e=>{e.stopPropagation();choose(f.path);};
        row.append(inline(f.value?.name||'','Field name '+f.value?.name,value=>setProperty(f.path,'name',value),'field-name',key(f.path)+':name'),typeInput(f.value?.type,f.path,'type','Type of '+f.value?.name));
        const port=button('',e=>{e.stopPropagation();});port.className='port';port.title='Drag to a type card to set this field’s type';port.setAttribute('aria-label','Connect '+f.value?.name);port.onpointerdown=e=>startWire(e,port,f.path);port.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();linkFrom=f.path;toast('Click the target type card to connect. Escape cancels.');}};row.append(port,fieldFlags(f.value.type,f.path,f.value.name));card.append(row);
      }
      const add=button('+ Add field',e=>{e.stopPropagation();addField(d.path);},'card-add');add.setAttribute('aria-label','Add field to '+v.name);card.append(add);
    }
    if(v.type==='enum')card.append(enumList(v,d.path));
    if(v.type==='map'||v.type==='union'){const prop=v.type==='map'?'values':'names',row=el('div','field-row');row.append(el('span','',prop),typeInput(v[prop],d.path,prop,prop+' of '+v.name));card.append(row);}
    if(v.type==='documentation'&&!v.doc)card.append(button('Add documentation',()=>openProperties(d.path),'card-add'));
    world.append(card);
  });viewport.append(world);main.append(viewport);return main;
}
function fieldFlags(type,p,name,onSuccess){
  const options=el('div','field-options'),flags=Types.flags(type);
  for(const [flag,label] of [['array','Array'],['nullable','Nullable']]){
    const wrapper=el('label'),input=el('input');input.type='checkbox';input.checked=flags[flag];input.setAttribute('aria-label',label+' for '+name);
    input.onclick=e=>e.stopPropagation();input.onpointerdown=e=>e.stopPropagation();
    input.onchange=()=>{edit({kind:'fieldFlags',path:p,flag,enabled:input.checked},onSuccess);};wrapper.append(input,document.createTextNode(label));options.append(wrapper);
  }
  return options;
}
function enumList(v,p){
  const list=el('div','enum-list');list.setAttribute('aria-label','Values of '+v.name);
  if(Array.isArray(v.symbols))v.symbols.forEach((symbol,i)=>{const row=el('div','symbol-row');row.append(el('span','symbol-dot','•'),inline(symbol,'Enum value '+symbol,value=>edit({kind:'renameSymbol',path:p,index:i,value}),'symbol-input',key(p)+':symbol:'+i));const remove=button('×',e=>{e.stopPropagation();edit({kind:'deleteSymbol',path:p,index:i});},'icon-button');remove.setAttribute('aria-label','Remove enum value '+symbol);row.append(remove);list.append(row);});
  const form=el('form','symbol-add'),input=el('input');input.placeholder='Add a value…';input.setAttribute('aria-label','New enum value for '+v.name);input.dataset.focus=key(p)+':new-symbol';input.onclick=e=>e.stopPropagation();input.onkeydown=e=>e.stopPropagation();form.append(input);const add=el('button','','+');add.type='submit';add.setAttribute('aria-label','Add enum value to '+v.name);form.append(add);form.onsubmit=e=>{e.preventDefault();const value=input.value;edit({kind:'addSymbol',path:p,value},()=>{focusAfter=key(p)+':new-symbol';});};form.onclick=e=>e.stopPropagation();list.append(form);return list;
}
function startWire(e,port,p){
  if(e.button!==0||busy)return;e.preventDefault();e.stopPropagation();closeMenu();linkFrom=null;
  const svg=document.querySelector('.edges'),world=svg.parentElement,r=port.getBoundingClientRect(),wr=world.getBoundingClientRect();
  const x=(r.left+r.width/2-wr.left)/zoom,y=(r.top+r.height/2-wr.top)/zoom,ghost=document.createElementNS('http://www.w3.org/2000/svg','path');ghost.classList.add('wire-preview');svg.append(ghost);
  gesture={cancel};let moved=false,target=null;
  function clean(){document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);target?.classList.remove('linking');ghost.remove();gesture=null;}
  function cancel(){clean();}
  function move(m){m.preventDefault();moved=true;const bounds=world.getBoundingClientRect(),tx=(m.clientX-bounds.left)/zoom,ty=(m.clientY-bounds.top)/zoom;ghost.setAttribute('d',`M ${x} ${y} C ${x+70} ${y},${tx-70} ${ty},${tx} ${ty}`);target?.classList.remove('linking');target=document.elementFromPoint(m.clientX,m.clientY)?.closest('.card');if(target&&at(JSON.parse(target.dataset.path))?.type==='documentation')target=null;target?.classList.add('linking');}
  function up(m){const dest=document.elementFromPoint(m.clientX,m.clientY)?.closest('.card'),to=dest?JSON.parse(dest.dataset.path):null;clean();if(moved&&to){edit({kind:'connect',path:p,target:to});}else if(!moved){linkFrom=p;toast('Click the target type card to connect. Escape cancels.');}}
  document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);
}
function drawEdges(){
  const svg=document.querySelector('.edges');if(!svg)return;svg.replaceChildren();const cards=[...document.querySelectorAll('.card')],world=svg.parentElement;world.style.width=Math.max(1250,...cards.map(c=>c.offsetLeft+c.offsetWidth+100))+'px';world.style.height=Math.max(1000,...cards.map(c=>c.offsetTop+c.offsetHeight+100))+'px';svg.style.width=world.style.width;svg.style.height=world.style.height;
  const ns='http://www.w3.org/2000/svg',defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');marker.id='arrow';for(const [k,v]of Object.entries({viewBox:'0 0 10 10',refX:'10',refY:'5',markerWidth:'6',markerHeight:'6',orient:'auto-start-reverse'}))marker.setAttribute(k,v);const arrow=document.createElementNS(ns,'path');arrow.setAttribute('d','M 0 0 L 10 5 L 0 10 z');arrow.setAttribute('fill','currentColor');marker.append(arrow);defs.append(marker);svg.append(defs);
  for(const e of state.edges){const from=cards.find(c=>c.dataset.path===key(e.from)),to=cards.find(c=>c.dataset.path===key(e.to));if(!from||!to)continue;let y=from.offsetTop+40;const row=[...from.querySelectorAll('[data-field]')].find(r=>JSON.parse(r.dataset.field).every((v,i)=>e.path[i]===v));if(row)y=from.offsetTop+(row.querySelector('.port')?.offsetTop??row.offsetTop)+(row.querySelector('.port')?.offsetHeight??row.offsetHeight)/2;
    const forward=to.offsetLeft>=from.offsetLeft,x=from.offsetLeft+(forward?from.offsetWidth:0),tx=to.offsetLeft+(forward?0:to.offsetWidth),ty=to.offsetTop+38,path=document.createElementNS(ns,'path');path.classList.add('edge');if(e.kind==='extends')path.classList.add('extends');const dist=Math.max(40,Math.abs(tx-x)*.45)*(forward?1:-1);path.setAttribute('d',from===to?`M ${x} ${y} C ${x+80} ${y},${x+80} ${ty-45},${x-20} ${ty-45}`:`M ${x} ${y} C ${x+dist} ${y},${tx-dist} ${ty},${tx} ${ty}`);path.setAttribute('marker-end','url(#arrow)');svg.append(path);
  }
}
function closeMenu(){document.querySelector('.context-menu')?.remove();}
function contextMenu(e,p){
  e.preventDefault();e.stopPropagation();if(!state?.data||busy)return;closeMenu();if(p)choose(p);
  const menu=el('div','context-menu');menu.role='menu';menu.setAttribute('aria-label','Schema actions');
  const add=button('Add  ›',()=>{sub.hidden=false;add.setAttribute('aria-expanded','true');sub.querySelector('button')?.focus();},'menu-item');add.role='menuitem';add.setAttribute('aria-haspopup','menu');add.setAttribute('aria-expanded','false');const group=el('div','submenu-parent'),sub=el('div','submenu');sub.role='menu';sub.setAttribute('aria-label','Add definition');sub.hidden=true;
  const wr=document.querySelector('.world')?.getBoundingClientRect();const location=wr?{x:Math.max(0,(e.clientX-wr.left)/zoom),y:Math.max(0,(e.clientY-wr.top)/zoom)}:null;
  for(const [label,type] of [['Enum','enum'],['Record','record'],['Mapping','map'],['Union','union'],['Documentation','documentation']]){
    const entry=button(label,()=>edit({kind:'addDefinition',path:[],type},()=>{const d=state.definitions.at(-1);if(location)positions[d.value.name]=location;selection=d.path;focusAfter=key(d.path)+':name';save();}),'menu-item');entry.role='menuitem';sub.append(entry);
  }
  group.append(add,sub);group.onpointerenter=()=>{sub.hidden=false;add.setAttribute('aria-expanded','true');};group.onpointerleave=()=>{if(!group.contains(document.activeElement)){sub.hidden=true;add.setAttribute('aria-expanded','false');}};menu.append(group);
  function action(label,fn){const b=button(label,()=>{closeMenu();fn();},'menu-item');b.role='menuitem';menu.append(b);}
  if(p!==null){const v=nodeValue(p);if(v?.type==='record')action('Add field',()=>addField(p));if(v?.type==='enum')action('Add enum value',()=>focusControl(key(p)+':new-symbol'));action('Properties…',()=>openProperties(p));action('Delete '+(fieldPath(p)?'field':'definition')+'…',()=>confirmDelete(p));}
  else action('Document properties…',()=>openProperties([]));
  document.body.append(menu);menu.style.left=Math.max(4,Math.min(e.clientX,innerWidth-menu.offsetWidth-210))+'px';menu.style.top=Math.max(4,Math.min(e.clientY,innerHeight-menu.offsetHeight-210))+'px';add.focus();
  menu.onkeydown=k=>{const items=[...menu.querySelectorAll('button')].filter(b=>!b.closest('[hidden]')),idx=items.indexOf(document.activeElement);if(k.key==='ArrowDown'||k.key==='ArrowUp'){k.preventDefault();items[(idx+(k.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();}if(k.key==='ArrowRight'){k.preventDefault();sub.hidden=false;add.setAttribute('aria-expanded','true');sub.querySelector('button')?.focus();}if(k.key==='ArrowLeft'){k.preventDefault();sub.hidden=true;add.setAttribute('aria-expanded','false');add.focus();}};
}
function dialog(title){const d=el('dialog','properties-dialog');d.setAttribute('aria-label',title);const h=el('div','dialog-heading');h.append(el('h2','',title),button('×',()=>d.close(),'icon-button'));d.append(h);d.onclose=()=>d.remove();document.body.append(d);d.showModal();return d;}
function confirmDelete(p){const d=dialog('Delete '+(fieldPath(p)?'field':'definition'));d.append(el('p','','Delete this selection? You can undo the change.'),button('Delete',()=>{d.close();edit({kind:'delete',path:p});},'danger'),button('Cancel',()=>d.close()));}
// Form controls keep JavaScript values typed; only the host serializes YAML.
function valueEditor(type,value,label,depth=0){
  const defs=state.definitions.map(d=>d.value),spec=Types.describe(type,defs),box=el('div','value-editor');
  if(depth>12){box.append(el('p','hint','This value is too deeply nested for the form. Use Advanced node editing.'));return {element:box,read(){throw new Error('Value is too deeply nested.');}};}
  const build=(t,v,l)=>valueEditor(t,v,l,depth+1);
  if(spec.kind==='union'){
    const select=el('select');select.setAttribute('aria-label',label+' type');
    const variants=spec.variants;variants.forEach((t,i)=>select.append(new Option(typeLabel(t),String(i))));
    let selected=value===undefined?variants.findIndex(t=>Types.describe(t,defs).kind!=='null'):variants.findIndex(t=>!Types.validate(t,value,defs));if(selected<0)selected=0;select.value=String(selected);
    let current=build(variants[selected],value,label);box.append(select,current.element);
    select.onchange=()=>{current.element.remove();current=build(variants[Number(select.value)],undefined,label);box.append(current.element);};return {element:box,read:()=>current.read()};
  }
  if(spec.kind==='null'){box.append(el('span','hint','Null'));return {element:box,read:()=>null};}
  if(spec.kind==='string'||['boolean','int','long','float','double','enum'].includes(spec.kind)){
    let input;
    if(spec.kind==='enum'){input=el('select');input.append(new Option('Choose a value…',''));for(const s of spec.symbols)input.append(new Option(s,s));input.value=typeof value==='string'?value:'';}
    else {input=el('input');if(spec.kind==='boolean'){input.type='checkbox';input.checked=value===true;}else if(spec.kind==='string'){input.type='text';input.value=typeof value==='string'?value:'';}else{input.type='number';input.step=['int','long'].includes(spec.kind)?'1':'any';input.value=typeof value==='number'?String(value):'';}}
    input.setAttribute('aria-label',label);const l=el('label','value-label',label);l.append(input);box.append(l);
    return {element:box,read(){if(spec.kind==='boolean')return input.checked;if(['string','enum'].includes(spec.kind))return input.value;if(!input.value.trim())throw new Error(label+': enter a number.');return Number(input.value);}};
  }
  if(spec.kind==='array'){
    const rows=el('div','value-list'),items=[];box.append(rows);
    function add(v){const row=el('div','value-list-row'),editor=build(spec.items,v,label+' item'),entry={row,editor};row.append(editor.element,button('Remove',()=>{items.splice(items.indexOf(entry),1);row.remove();},'small-button'));items.push(entry);rows.append(row);}
    if(Array.isArray(value))value.forEach(add);box.append(button('+ Add item',()=>add(undefined),'small-button'));return {element:box,read:()=>items.map(e=>e.editor.read())};
  }
  if(spec.kind==='map'){
    const rows=el('div','value-list'),entries=[];box.append(rows);
    function add(k='',v){const row=el('div','value-list-row'),name=el('input');name.value=k;name.placeholder='Key';name.setAttribute('aria-label',label+' key');const editor=build(spec.values,v,label+' value'),entry={row,name,editor};row.append(name,editor.element,button('Remove',()=>{entries.splice(entries.indexOf(entry),1);row.remove();},'small-button'));entries.push(entry);rows.append(row);}
    if(obj(value))Object.entries(value).forEach(([k,v])=>add(k,v));box.append(button('+ Add entry',()=>add(),'small-button'));
    return {element:box,read(){const values=[],seen=new Set();for(const e of entries){if(!e.name.value||seen.has(e.name.value))throw new Error('Mapping keys must be nonempty and unique.');seen.add(e.name.value);values.push([e.name.value,e.editor.read()]);}return Object.fromEntries(values);}};
  }
  if(spec.kind==='record'){
    const editors=[];
    for(const f of spec.fields){const row=el('div','record-default-field'),include=el('input');include.type='checkbox';include.checked=obj(value)&&Object.hasOwn(value,f.name);include.setAttribute('aria-label','Include '+f.name);const labelNode=el('label','include-label');labelNode.append(include,document.createTextNode(f.name));row.append(labelNode);let current=null;
      const update=()=>{current?.element.remove();current=include.checked?build(f.type,obj(value)?value[f.name]:undefined,f.name):null;if(current)row.append(current.element);};include.onchange=update;update();editors.push({name:f.name,include,read:()=>current.read()});box.append(row);
    }
    // Preserve extension/default properties not represented by local fields.
    const extras=obj(value)?Object.entries(value).filter(([k])=>!spec.fields.some(f=>f.name===k)):[];
    return {element:box,read:()=>Object.fromEntries([...extras,...editors.filter(e=>e.include.checked).map(e=>[e.name,e.read()])])};
  }
  // Any and unresolved external names still get a structured form, not YAML.
  const select=el('select');select.setAttribute('aria-label',label+' value kind');
  const options=[['Text','string'],['Number','double'],['Boolean','boolean'],['List',{type:'array',items:['null','Any']}],['Object',{type:'map',values:['null','Any']}]];
  options.forEach(([name],i)=>select.append(new Option(name,String(i))));
  let index=Array.isArray(value)?3:obj(value)?4:typeof value==='boolean'?2:typeof value==='number'?1:0;select.value=String(index);
  let current=build(options[index][1],value,label);box.append(select,current.element);
  select.onchange=()=>{current.element.remove();current=build(options[Number(select.value)][1],undefined,label);box.append(current.element);};
  return {element:box,read:()=>current.read()};
}
function defaultEditor(field,p,d,version){
  const section=el('section','default-section');section.append(el('h3','','Default value'));
  const mode=el('select');mode.setAttribute('aria-label','Default mode');mode.append(new Option('No default','none'),new Option('Set a value','value'));
  const defs=state.definitions.map(d=>d.value),allowsNull=!Types.validate(field.type,null,defs);
  if(allowsNull||field.default===null)mode.append(new Option('Null','null'));
  mode.value=!Object.hasOwn(field,'default')?'none':field.default===null?'null':'value';section.append(mode);
  let editor;const body=el('div');section.append(body);
  function update(){body.replaceChildren();editor=null;if(mode.value==='value'){const split=Types.split(field.type);editor=valueEditor(split.core??field.type,field.default,'Default');body.append(editor.element);}}
  mode.onchange=update;update();
  const error=el('p','form-error');error.setAttribute('role','alert');section.append(error);
  section.append(button('Save default',()=>{
    try{
      if(state.version!==version)throw new Error('The document changed. Reopen Properties before saving the default.');
      const remove=mode.value==='none',value=mode.value==='null'?null:editor?.read();
      if(!remove){const problem=Types.validate(field.type,value,defs);if(problem)throw new Error(problem);}
      edit({kind:'setDefault',path:p,value,remove},()=>d.close());
    }catch(e){error.textContent=e.message;}
  },'primary'));
  section.append(el('p','hint','No default removes the property. Text is stored literally; an empty list, false, zero, or an empty string are valid values when allowed by the field type.'));
  return section;
}

function openProperties(p){
  const v=nodeValue(p),d=dialog(p.length===0&&Array.isArray(state.data.$graph)?'Document properties':(v?.name||'Node')+' properties'),version=state.version;
  if(!obj(v)){d.append(el('p','','This document has a list root. Open YAML to edit its structure.'),button('Open YAML',()=>{d.close();send('source');}));return;}
  d.append(el('p','hint','Names, field types, and enum values can be edited directly on the diagram.'));
  const form=el('div');d.append(form);
  function prop(k,yaml=false,choices){const row=el('div','form-row'),label=el('label','',k+(yaml?' · YAML value':''));let input;if(choices){input=el('select');for(const c of choices)input.append(new Option(c||'(unset)',c));input.value=v[k]===undefined?'':String(v[k]);}else{input=el(yaml||k==='doc'?'textarea':'input');input.value=v[k]===undefined?'':yaml?JSON.stringify(v[k],null,2):String(v[k]);}input.setAttribute('aria-label',k);row.append(label,input);form.append(row);
    let initial=input.value;const submit=()=>{if(input.value===initial)return;if(state.version!==version){toast('The document changed. Reopen properties before editing.');d.close();return;}initial=input.value;const value=choices&&input.value==='true'?true:choices&&input.value==='false'?false:input.value;d.close();edit({kind:'set',path:p,key:k,value,format:yaml?'yaml':undefined,remove:!!choices&&input.value===''});};input.onchange=submit;}
  if(Array.isArray(v.$graph)){prop('$base');prop('$namespaces',true);prop('$schemas',true);}else{
    prop('name');if(v.$import||v.$include)prop(v.$import?'$import':'$include');else{
      if(fieldPath(p)){form.append(el('p','hint','Type: '+typeLabel(v.type)+' · edit using the field controls on the card.'));form.append(fieldFlags(v.type,p,v.name,()=>d.close()),defaultEditor(v,p,d,version));prop('jsonldPredicate',true);}
      else{if(v.type==='record')prop('abstract',false,['','true','false']);if(['record','enum'].includes(v.type))prop('extends',true);if(v.type==='record')prop('specialize',true);if(v.type==='array')prop('items',true);if(v.type!=='documentation')prop('documentRoot',false,['','true','false']);prop('inVocab',false,['','true','false']);if(['record','enum','map'].includes(v.type))prop('jsonldPredicate',true);}
      // Structured docs stay editable without flattening include/import arrays.
      prop('doc',typeof v.doc!=='string'&&v.doc!==undefined);
    }
  }
  const advanced=el('details');advanced.append(el('summary','','Advanced node YAML / JSON'));const raw=el('textarea');raw.value=JSON.stringify(at(p),null,2);raw.rows=12;raw.setAttribute('aria-label','Advanced node YAML');advanced.append(raw,el('p','hint','Replacing a node replaces comments inside it.'),button('Replace node',()=>{if(state.version!==version){toast('The document changed. Reopen properties.');d.close();return;}d.close();edit({kind:'replace',path:p,value:raw.value});}));d.append(advanced);
}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.context-menu'))closeMenu();});
function remapForSerialization(next){
  if(!state?.definitions||!next.definitions)return;
  const identity=d=>d.value?.name?'name:'+d.value.name:JSON.stringify(d.value);
  const old=state.definitions,byId=new Map(next.definitions.map(d=>[identity(d),d]));
  if(old.length!==next.definitions.length||byId.size!==old.length||!old.every(d=>byId.has(identity(d))))return;
  if(old.every(d=>equal(d.path,byId.get(identity(d)).path)))return;
  // Paths are document offsets, not visual identities. Preserve card positions,
  // selection, and the focused input when saving reorders the YAML sequence.
  old.forEach((d,i)=>{if(d.value?.name&&!positions[d.value.name])positions[d.value.name]=position(d,i);});
  const remap=p=>{const d=old.find(d=>d.path.every((v,i)=>p[i]===v));return d?[...byId.get(identity(d)).path,...p.slice(d.path.length)]:p;};
  if(selection)selection=remap(selection);
  document.querySelectorAll('[data-focus]').forEach(input=>{const id=input.dataset.focus,split=id.lastIndexOf(']:');if(split<0)return;try{input.dataset.focus=key(remap(JSON.parse(id.slice(0,split+1))))+id.slice(split+1);}catch{}});
  save();
}
window.addEventListener('message',e=>{
  if(e.data.kind==='state'){gesture?.cancel();remapForSerialization(e.data.state);state=e.data.state;busy=false;if(state.version>pendingVersion&&pendingVersion!==null){const callback=afterEdit;afterEdit=null;pendingVersion=null;callback?.();}render();}
  else if(e.data.kind==='error'){busy=false;afterEdit=null;pendingVersion=null;toast(e.data.message);}
});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){gesture?.cancel();linkFrom=null;closeMenu();}if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();send('save');}},true);
render();send('ready');
