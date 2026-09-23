'use strict';
const YAML = require('yaml');
const Types=require('../media/type-utils');
const kinds = ['record', 'enum', 'map', 'union', 'documentation'];
const primitive = new Set(['null','boolean','int','long','float','double','string','Any']);
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const at = (obj, path) => path.reduce((v,k) => v == null ? undefined : v[k], obj);
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function parse(text) {
  const doc = YAML.parseDocument(text, {keepSourceTokens:true, uniqueKeys:true});
  if (doc.errors.length) throw new Error(doc.errors.map(e=>e.message).join('\n'));
  const data = doc.toJS({maxAliasCount:100});
  if (!Array.isArray(data) && !(isObject(data) && (Array.isArray(data.$graph) || kinds.includes(data.type)))) {
    throw new Error('Expected a Schema Salad definition, a list of definitions, or a document with a $graph list.');
  }
  return {doc, data};
}
function definitions(data) {
  if (Array.isArray(data)) return data.map((value,i)=>({value,path:[i]}));
  if (Array.isArray(data.$graph)) return data.$graph.map((value,i)=>({value,path:['$graph',i]}));
  return [{value:data,path:[]}];
}
function fields(value,path) {
  if (Array.isArray(value.fields)) return value.fields.map((v,i)=>({value:v,path:[...path,'fields',i]}));
  if (isObject(value.fields)) return Object.entries(value.fields).map(([name,v])=>({value:isObject(v)?{...v,name}:{name,type:v},path:[...path,'fields',name],mapKey:name,raw:v}));
  return [];
}
function label(type) {
  if (typeof type === 'string') return type;
  if (Array.isArray(type)) return type.map(label).join(' | ');
  if (isObject(type)) {
    if (type.type === 'array') return `(${label(type.items)})[]`;
    if (type.type === 'map') return `map<${label(type.values)}>`;
    if (type.type === 'union') return label(type.names);
    return type.name || type.type || '?';
  }
  return '?';
}
function localRef(value,defs) {
  if (typeof value !== 'string') return;
  const token = value.replace(/(?:\?|\[\])+$/g,'');
  if (primitive.has(token)) return;
  defs=defs.filter(d=>d.value?.type!=='documentation');
  const exact = defs.filter(d=>d.value?.name === token);
  if (exact.length === 1) return exact[0];
  // Only fragment shorthand is reconciled. No guessing URI basenames or namespaces.
  const match = defs.filter(d=>typeof d.value?.name === 'string' && d.value.name.replace(/^#/,'') === token.replace(/^#/,''));
  if (match.length === 1) return match[0];
}
function references(data) {
  const defs=definitions(data), out=[];
  function typeWalk(t,path,owner,kind) {
    if (typeof t === 'string') {const target=localRef(t,defs); if(target) out.push({from:owner,to:target.path,path,kind,token:t});}
    else if(Array.isArray(t)) t.forEach((v,i)=>typeWalk(v,[...path,i],owner,kind));
    else if(isObject(t)) {
      for(const key of ['items','values','names']) if(t[key]!==undefined) typeWalk(t[key],[...path,key],owner,kind);
      if(t.type === 'record') fields(t,path).forEach(f=>typeWalk(f.value.type,fieldTypePath(f),owner,kind));
    }
  }
  for (const d of defs) if (isObject(d.value)) {
    fields(d.value,d.path).forEach(f=>typeWalk(f.value.type,fieldTypePath(f),d.path,'field'));
    for(const key of ['extends','items','values','names']) if(d.value[key]!==undefined) typeWalk(d.value[key],[...d.path,key],d.path,key==='extends'?'extends':'type');
    const s=d.value.specialize;
    if(Array.isArray(s)) s.forEach((v,i)=>['specializeFrom','specializeTo'].forEach(k=>typeWalk(v[k],[...d.path,'specialize',i,k],d.path,'specialize')));
    else if(isObject(s)) Object.entries(s).forEach(([k,v])=>{typeWalk(v,[...d.path,'specialize',k],d.path,'specialize');});
  }
  return out;
}
function fieldTypePath(f) {return f.mapKey !== undefined && !isObject(f.raw) && f.raw !== undefined ? f.path : [...f.path,'type'];}
// Map shorthand fields store their type directly rather than in an object.
function getField(data,path) {
  const raw=at(data,path); const isMap=typeof path.at(-1)==='string' && path.at(-2)==='fields';
  return {raw,isMap,value:isMap?(isObject(raw)?{...raw,name:path.at(-1)}:{name:path.at(-1),type:raw}):raw};
}
// Stable dependency ordering of top-level YAML nodes. Never reconstruct nodes:
// anchors, comments, formatting, and extension properties travel with them.
function dependencyOrder(doc,data) {
  const defs=definitions(data),seq=Array.isArray(data)?doc.contents:Array.isArray(data.$graph)?doc.get('$graph',true):null;
  if(!seq)return {seq:null,order:[0],cycles:[]};
  const deps=defs.map(()=>new Set());
  function canonical(name){
    if(typeof name!=='string')return name;
    const prefix=name.match(/^([^:/#]+):(.+)$/);
    if(prefix&&data.$namespaces?.[prefix[1]])return data.$namespaces[prefix[1]]+prefix[2];
    if(/^[a-z][a-z0-9+.-]*:/i.test(name))return name;
    const base=data.$base;
    if(typeof base==='string')return base.split('#')[0]+'#'+name.replace(/^#/,'');
    return name.replace(/^#/,'');
  }
  function target(token){
    if(typeof token!=='string')return;
    token=token.replace(/(?:\?|\[\])+$/g,'');
    if(primitive.has(token))return;
    const found=defs.map((d,i)=>({d,i})).filter(({d})=>d.value?.type!=='documentation'&&typeof d.value?.name==='string'&&canonical(d.value.name)===canonical(token));
    if(found.length===1)return found[0].i;
  }
  function ref(value,owner){const i=target(value);if(i!==undefined&&i!==owner)deps[owner].add(i);}
  function walk(t,owner){
    if(typeof t==='string')ref(t,owner);
    else if(Array.isArray(t))t.forEach(v=>walk(v,owner));
    else if(isObject(t)){
      for(const k of ['items','values','names','extends'])if(t[k]!==undefined)walk(t[k],owner);
      if(t.type==='record')fields(t,[]).forEach(f=>walk(f.value?.type,owner));
      const s=t.specialize;
      if(Array.isArray(s))s.forEach(v=>{ref(v?.specializeFrom,owner);ref(v?.specializeTo,owner);});
      else if(isObject(s))Object.entries(s).forEach(([from,to])=>{ref(from,owner);ref(to,owner);});
    }
  }
  defs.forEach((d,i)=>walk(d.value,i));
  // Unresolved imports may supply named types; keep their relative order and
  // emit them before local type declarations, without fetching external files.
  const imports=defs.flatMap((d,i)=>d.value?.$import?[i]:[]);
  defs.forEach((d,i)=>{if(kinds.includes(d.value?.type)&&d.value.type!=='documentation')imports.forEach(j=>deps[i].add(j));});
  imports.forEach((i,k)=>{if(k)deps[i].add(imports[k-1]);});
  // YAML aliases must never be moved ahead of their anchors.
  const owners=new Map();seq.items.forEach((n,i)=>YAML.visit(n,(_,v)=>{if(v&&typeof v==='object')owners.set(v,i);}));
  seq.items.forEach((n,i)=>YAML.visit(n,{Alias(_,alias){const j=owners.get(alias.resolve(doc));if(j!==undefined&&i!==j)deps[i].add(j);}}));
  // Condense strongly connected components, then use original position as the
  // tie-breaker for a deterministic topological order of the resulting DAG.
  let next=0;const index=defs.map(()=>-1),low=[],stack=[],active=new Set(),groups=[];
  function visit(v){index[v]=low[v]=next++;stack.push(v);active.add(v);
    for(const w of deps[v]){if(index[w]===-1){visit(w);low[v]=Math.min(low[v],low[w]);}else if(active.has(w))low[v]=Math.min(low[v],index[w]);}
    if(low[v]===index[v]){const group=[];let w;do{w=stack.pop();active.delete(w);group.push(w);}while(w!==v);groups.push(group.sort((a,b)=>a-b));}
  }
  defs.forEach((_,i)=>{if(index[i]===-1)visit(i);});
  const groupOf=[];groups.forEach((g,i)=>g.forEach(v=>groupOf[v]=i));
  const done=new Set(),order=[];
  while(done.size<groups.length){const ready=groups.map((g,i)=>({g,i})).filter(({g,i})=>!done.has(i)&&g.every(v=>[...deps[v]].every(w=>groupOf[w]===i||done.has(groupOf[w])))).sort((a,b)=>a.g[0]-b.g[0]);
    if(!ready.length)throw new Error('Could not order definition dependencies.');
    const {g,i}=ready[0];done.add(i);order.push(...g);
  }
  return {seq,order,cycles:groups.filter(g=>g.length>1).map(g=>g.map(i=>defs[i].value?.name||defs[i].value?.$import||String(i)))};
}
// Force block collections even when the source was JSON or an empty flow list.
function serializeYaml(doc){return doc.toString({collectionStyle:'block'});}
function serializeInDependencyOrder(text){
  const {doc,data}=parse(text),{seq,order,cycles}=dependencyOrder(doc,data);
  const changed=!!seq&&order.some((v,i)=>v!==i);
  if(changed){const nodes=seq.items;seq.items=order.map(i=>nodes[i]);}
  const output=serializeYaml(doc);
  return {text:output,changed:output!==text,cycles};
}

function inspect(text,version=0) {
  try {
    const {data,doc}=parse(text);const defs=definitions(data);const issues=[];
    const seen=new Set();
    const issue=(message,path,severity='error')=>{const node=doc.getIn(path,true);issues.push({message,path,severity,offset:node?.range?.[0]||0});};
    function checkType(t,p) {
      if(typeof t==='string' && t.trim()) return;
      if(Array.isArray(t)){if(!t.length) issue('A union must contain at least one type.',p);t.forEach((v,i)=>checkType(v,[...p,i]));return;}
      if(isObject(t)) {
        if(t.$import || t.$include) return;
        if(t.type==='array'){if(t.items===undefined)issue('Array requires items.',p);else checkType(t.items,[...p,'items']);return;}
        if(['record','enum','map','union'].includes(t.type)){checkDef(t,p,false);return;}
      }
      issue('Expected a type name, a union list, or an inline type definition. Quote "null" when it is a type.',p);
    }
    function checkDef(v,p,top=true) {
      if(!isObject(v)){issue('Expected a definition object.',p);return;}
      if(v.$import || v.$include) return;
      if(!kinds.includes(v.type)) issue('Unsupported definition kind: '+String(v.type),[...p,'type']);
      if(top && (typeof v.name!=='string'||!v.name.trim()))issue('Definition requires a name.',p);
      if(top && seen.has(v.name))issue('Duplicate definition name: '+v.name,p);seen.add(top?v.name:Symbol());
      for(const key of ['abstract','documentRoot','inVocab'])if(v[key]!==undefined && typeof v[key]!=='boolean')issue(key+' must be boolean.',[...p,key]);
      if(v.type==='record') {
        if(v.fields!==undefined && !Array.isArray(v.fields)&&!isObject(v.fields)) issue('fields must be a list or a name-to-field map.',[...p,'fields']);
        const names=new Set();for(const f of fields(v,p)) {
          if(typeof f.value?.name!=='string'||!f.value.name)issue('Field requires a name.',f.path);
          if(names.has(f.value?.name))issue('Duplicate field name: '+f.value.name,f.path);names.add(f.value?.name);
          checkType(f.value?.type,[...f.path,'type']);
          if(isObject(f.value)&&Object.hasOwn(f.value,'default')){const error=Types.validate(f.value.type,f.value.default,defs.map(d=>d.value));if(error)issue('Default: '+error,[...f.path,'default']);}
        }
      }
      if(v.type==='enum' && (!Array.isArray(v.symbols)||v.symbols.some(x=>typeof x!=='string')||new Set(v.symbols).size!==v.symbols.length))issue('symbols must be a list of unique strings.',[...p,'symbols']);
      for(const [kind,key] of [['map','values'],['union','names']]) if(v.type===kind) {if(v[key]===undefined)issue(kind+' requires '+key,p);else checkType(v[key],[...p,key]);}
    }
    defs.forEach(d=>checkDef(d.value,d.path));
    if(!defs.some(d=>d.value?.documentRoot===true))issue('No documentRoot is declared locally; one may be provided by an import.',[],'warning');
    if(defs.some(d=>d.value?.$import))issue('Imports are preserved but not resolved in this editor.',[],'info');
    for(const cycle of dependencyOrder(doc,data).cycles)issue('Dependency cycle: '+cycle.join(' → ')+'. No declaration order satisfies every dependency; relative order inside this group is preserved on save.',[],'warning');
    return {version,data,definitions:defs,edges:references(data),issues};
  } catch(e){return {version,error:e.message,issues:[{message:e.message,offset:0,severity:'error',path:[]}]};}
}
function valueFromYaml(text) {
  const d=YAML.parseDocument(text,{uniqueKeys:true});if(d.errors.length)throw new Error(d.errors[0].message);
  return d.toJS({maxAliasCount:100});
}
function mutate(text,op) {
  const {doc,data}=parse(text);const path=op.path;
  if(!Array.isArray(path)||path.some(p=>!(typeof p==='string'||Number.isInteger(p)) || ['__proto__','constructor','prototype'].includes(p)))throw new Error('Invalid edit path.');
  if(op.kind!=='addDefinition' && at(data,path)===undefined) throw new Error('Selection no longer exists.');
  if(op.kind==='addDefinition') {
    if(!kinds.includes(op.type))throw new Error('Invalid schema kind.');
    const names=new Set(definitions(data).map(d=>d.value?.name));let name='New'+op.type[0].toUpperCase()+op.type.slice(1),i=2;const base=name;while(names.has(name))name=base+i++;
    const v={name,type:op.type};if(op.type==='record')v.fields=[];if(op.type==='enum')v.symbols=[];if(op.type==='map')v.values='string';if(op.type==='union')v.names=['string','int'];if(op.type==='documentation')v.doc='Describe your schema.';
    if(Array.isArray(data))doc.add(v);else if(Array.isArray(data.$graph))doc.addIn(['$graph'],v);else {const original=doc.contents;doc.contents=doc.createNode([]);doc.contents.add(original);doc.contents.add(doc.createNode(v));}
  } else if(op.kind==='addField') {
    const v=at(data,path);if(v.type!=='record')throw new Error('Select a record first.');
    const names=new Set(fields(v,path).map(f=>f.value.name));let name='newField',i=2;while(names.has(name))name='newField'+i++;
    if(isObject(v.fields))doc.setIn([...path,'fields',name],doc.createNode({type:'string'}));
    else {if(!v.fields)doc.setIn([...path,'fields'],doc.createNode([]));doc.addIn([...path,'fields'],{name,type:'string'});}
  } else if(['addSymbol','renameSymbol','deleteSymbol'].includes(op.kind)) {
    const target=at(data,path);
    if(target?.type!=='enum'||!Array.isArray(target.symbols))throw new Error('Select an enum with a symbols list.');
    if(op.kind!=='addSymbol'&&(!Number.isInteger(op.index)||op.index<0||op.index>=target.symbols.length))throw new Error('Enum value no longer exists.');
    if(op.kind==='deleteSymbol')doc.deleteIn([...path,'symbols',op.index]);
    else {
      if(typeof op.value!=='string'||!op.value.trim())throw new Error('Enum value must be nonempty.');
      if(target.symbols.some((v,i)=>v===op.value&&(op.kind==='addSymbol'||i!==op.index)))throw new Error('Enum value already exists.');
      if(op.kind==='addSymbol')doc.addIn([...path,'symbols'],op.value);
      else {const old=doc.getIn([...path,'symbols',op.index],true),node=doc.createNode(op.value);if(old){node.comment=old.comment;node.commentBefore=old.commentBefore;}doc.setIn([...path,'symbols',op.index],node);}
    }
  } else if(op.kind==='fieldFlags') {
    if(path.at(-2)!=='fields'||!['array','nullable'].includes(op.flag)||typeof op.enabled!=='boolean')throw new Error('Invalid field type option.');
    const f=getField(data,path),type=Types.withFlags(f.value.type,{[op.flag]:op.enabled});
    const target=f.isMap&&!isObject(f.raw)?path:[...path,'type'];
    const old=doc.getIn(target,true),node=doc.createNode(type);if(old){node.comment=old.comment;node.commentBefore=old.commentBefore;}doc.setIn(target,node);
  } else if(op.kind==='setDefault') {
    if(path.at(-2)!=='fields')throw new Error('Select a record field.');
    const f=getField(data,path);
    if(!op.remove){const error=Types.validate(f.value.type,op.value,definitions(data).map(d=>d.value));if(error)throw new Error(error);}
    if(f.isMap&&!isObject(f.raw)){if(op.remove)return serializeYaml(doc);doc.setIn(path,doc.createNode({type:f.raw}));}
    if(op.remove)doc.deleteIn([...path,'default']);
    else{const old=doc.getIn([...path,'default'],true),node=doc.createNode(op.value);if(old){node.comment=old.comment;node.commentBefore=old.commentBefore;}doc.setIn([...path,'default'],node);}
  } else if(op.kind==='delete') {
    const target=definitions(data).find(d=>same(d.path,path));
    if(target){const inbound=references(data).filter(e=>same(e.to,path)&&!same(e.from,path));if(inbound.length)throw new Error('Remove the '+inbound.length+' local type reference(s) before deleting this definition.');
      const name=target.value?.name;if(name && definitions(data).some(d=>!same(d.path,path)&&isObject(d.value?.specialize)&&Object.keys(d.value.specialize).some(k=>same(localRef(k,definitions(data))?.path,path))))throw new Error('Remove specialization references before deleting this definition.');}
    if(!path.length)doc.contents=doc.createNode([]);else doc.deleteIn(path);
  } else if(op.kind==='set') {
    if(typeof op.key!=='string'||['__proto__','prototype','constructor','$graph'].includes(op.key))throw new Error('Invalid property key.');
    const f=getField(data,path);let target=at(data,path);
    if(f.isMap&&!isObject(target)){doc.setIn(path,doc.createNode({type:target}));target={type:target};}
    if(!isObject(target))throw new Error('Select an object.');
    const value=op.format==='yaml'?valueFromYaml(op.value):op.value;
    if(op.key==='name') {
      if(typeof value!=='string'||!value.trim())throw new Error('Name must be nonempty.');
      if(f.isMap){const parent=doc.getIn(path.slice(0,-1),true);if(value!==path.at(-1)&&parent.has(value))throw new Error('Name already exists.');const pair=parent.items.find(x=>String(x.key.value)===path.at(-1));pair.key.value=value;}
      else {
        const isDef=definitions(data).some(d=>same(d.path,path));
        const siblings=isDef?definitions(data):fields(at(data,path.slice(0,-2))||{},path.slice(0,-2));
        if(siblings.some(d=>!same(d.path,path)&&d.value?.name===value))throw new Error('Name already exists.');
        if(isDef && target.name!==value) {
          // Renaming a key in a specialize map is not a scalar edit; refuse rather than corrupt it.
          if(definitions(data).some(d=>isObject(d.value?.specialize)&&Object.keys(d.value.specialize).some(k=>same(localRef(k,definitions(data))?.path,path))))throw new Error('Rename references in specialize map keys in YAML first.');
          for(const e of references(data).filter(e=>same(e.to,path))){const suffix=e.token.match(/(?:\?|\[\])+$/)?.[0]||'';doc.setIn(e.path,value+suffix);}
        }
        doc.setIn([...path,op.key],value);
      }
    } else if(op.remove) doc.deleteIn([...path,op.key]);
    else {const old=doc.getIn([...path,op.key],true),node=doc.createNode(value);if(old && node){node.comment=old.comment;node.commentBefore=old.commentBefore;}doc.setIn([...path,op.key],node);}
  } else if(op.kind==='replace') {
    const value=valueFromYaml(op.value);if(!isObject(value))throw new Error('Node YAML must be an object.');
    if(!path.length)doc.contents=doc.createNode(value);else doc.setIn(path,doc.createNode(value));
  } else if(op.kind==='connect') {
    const target=at(data,op.target);if(!isObject(target)||!target.name||target.type==='documentation')throw new Error('Drop onto a named type.');
    const f=getField(data,path);if(!f.value?.name || !path.includes('fields'))throw new Error('Drag a field port to a type.');
    const type=Types.replaceBase(f.value.type,target.name);
    if(f.isMap&&!isObject(f.raw))doc.setIn(path,type);else doc.setIn([...path,'type'],type);
  } else throw new Error('Unknown edit operation.');
  return serializeYaml(doc);
}
module.exports={parse,inspect,mutate,definitions,fields,label,valueFromYaml,references,serializeInDependencyOrder};
