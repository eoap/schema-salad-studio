/* Shared browser/host type operations. No YAML parsing is used for form values. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SaladTypes=factory();})(typeof globalThis==='object'?globalThis:this,()=>{
  const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  function expand(t){
    if(typeof t!=='string')return t;
    if(t.endsWith('?'))return ['null',expand(t.slice(0,-1))];
    if(t.endsWith('[]'))return {type:'array',items:expand(t.slice(0,-2))};
    return t;
  }
  function alternatives(t){t=expand(t);return Array.isArray(t)?t.flatMap(alternatives):[t];}
  function split(t){const all=alternatives(t),nullable=all.includes('null'),rest=all.filter(t=>t!=='null'),core=rest.length===1?rest[0]:rest.length?rest:undefined;return {nullable,core,array:obj(core)&&core.type==='array'};}
  function compose(core,nullable){if(core===undefined)return 'null';return nullable?['null',...(Array.isArray(core)?core:[core])]:core;}
  function flags(t){const s=split(t);return {array:s.array,nullable:s.nullable};}
  function withFlags(t,patch){let {core,nullable,array}=split(t);
    if(patch.array!==undefined&&patch.array!==array){
      if(patch.array)core={type:'array',items:core===undefined?'null':core};
      else core=core.items;
    }
    if(patch.nullable!==undefined){nullable=patch.nullable;if(!nullable&&core===undefined)throw new Error('A null-only type needs another type before Nullable can be disabled.');}
    return compose(core,nullable);
  }
  function replaceBase(t,base){const s=split(t);return compose(s.array?{...s.core,items:base}:base,s.nullable);}
  const short=s=>String(s).split(/[#/]/).pop();
  function lookup(name,defs){const matches=defs.filter(d=>d?.name===name||String(d?.name).replace(/^#/,'')===name.replace(/^#/,''));return matches.length===1?matches[0]:undefined;}
  function recordFields(t){if(Array.isArray(t.fields))return t.fields;if(obj(t.fields))return Object.entries(t.fields).map(([name,v])=>obj(v)?{...v,name}:{name,type:v});return [];}
  function describe(t,defs=[],seen=[]){t=expand(t);
    if(Array.isArray(t))return {kind:'union',variants:alternatives(t)};
    if(typeof t==='string'){
      if(['string','boolean','int','long','float','double','null','Any'].includes(t))return {kind:t};
      const found=lookup(t,defs);if(found&&!seen.includes(t))return describe(found,defs,[...seen,t]);
      return {kind:'unknown',name:t};
    }
    if(obj(t)){
      if(t.type==='union')return {kind:'union',variants:alternatives(t.names)};
      if(t.type==='array')return {kind:'array',items:t.items};
      if(t.type==='map')return {kind:'map',values:t.values};
      if(t.type==='enum'){
        let symbols=[...(t.symbols||[])];for(const n of [t.extends||[]].flat()){const base=describe(n,defs,seen);if(base.kind==='enum')symbols.unshift(...base.symbols);}
        return {kind:'enum',name:t.name,symbols:[...new Set(symbols.map(short))]};
      }
      if(t.type==='record'){
        const merged=new Map();for(const n of [t.extends||[]].flat()){const base=describe(n,defs,seen);if(base.kind==='record')for(const f of base.fields)merged.set(f.name,f);}
        recordFields(t).forEach(f=>merged.set(f.name,f));return {kind:'record',name:t.name,fields:[...merged.values()]};
      }
    }
    return {kind:'unknown'};
  }
  function validate(t,value,defs=[],depth=0){
    if(depth>60)return 'Default value is nested too deeply.';
    const d=describe(t,defs),again=(t,v)=>validate(t,v,defs,depth+1);
    if(d.kind==='union')return d.variants.some(t=>!again(t,value))?null:'Value does not match any of the allowed types.';
    if(d.kind==='null')return value===null?null:'Expected null.';
    if(d.kind==='Any')return value===null?'Any does not include null.':null;
    if(d.kind==='unknown')return null; // Full external schema validation is separate.
    if(d.kind==='string')return typeof value==='string'?null:'Expected text.';
    if(d.kind==='boolean')return typeof value==='boolean'?null:'Expected true or false.';
    if(['int','long','float','double'].includes(d.kind)){
      if(typeof value!=='number'||!Number.isFinite(value))return 'Expected a finite number.';
      if(['int','long'].includes(d.kind)&&!Number.isSafeInteger(value))return 'Enter a whole number within JavaScript’s safe integer range.';
      if(d.kind==='int'&&(value< -2147483648||value>2147483647))return 'Integer is outside the 32-bit range.';
      return null;
    }
    if(d.kind==='enum')return d.symbols.includes(value)?null:'Choose one of the enum values.';
    if(d.kind==='array'){if(!Array.isArray(value))return 'Expected a list.';for(const v of value){const error=again(d.items,v);if(error)return error;}return null;}
    if(d.kind==='map'){if(!obj(value))return 'Expected a mapping.';for(const v of Object.values(value)){const error=again(d.values,v);if(error)return error;}return null;}
    if(d.kind==='record'){
      if(!obj(value))return 'Expected a record.';
      for(const f of d.fields){if(!Object.hasOwn(value,f.name)){if(Object.hasOwn(f,'default')||!again(f.type,null))continue;return 'Missing required field: '+f.name;}
        const error=again(f.type,value[f.name]);if(error)return f.name+': '+error;}
    }
    return null;
  }
  return {expand,split,flags,withFlags,replaceBase,describe,validate,recordFields};
});
