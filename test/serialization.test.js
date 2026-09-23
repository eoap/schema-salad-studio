'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const YAML=require('yaml');
const {serializeInDependencyOrder:sort,parse,inspect,definitions,mutate}=require('../src/model');
const names=text=>definitions(parse(text).data).map(d=>d.value.name||d.value.$import);
const input=defs=>YAML.stringify(defs);
test('enum precedes a record field that uses it',()=>{
 const s='- name: Record\n  type: record\n  fields:\n    - name: mode\n      type: Mode\n- name: Mode\n  type: enum\n  symbols: [a, b]\n';
 assert.deepEqual(names(sort(s).text),['Mode','Record']);
});
test('graph metadata, comments and custom properties survive',()=>{
 const s='# Header\n$base: https://example.org/#\n$namespaces: {ex: "https://example.org/#"}\ncustom: {x: 1}\n$graph:\n  # Record docs\n  - name: R\n    type: record\n    fields: {e: "E?"} # field docs\n  # Enum docs\n  - name: E\n    type: enum\n    symbols: [a]\n';
 const result=sort(s).text;for(const c of ['Header','Record docs','field docs','Enum docs'])assert.ok(result.includes('# '+c));
 assert.deepEqual(names(result),['E','R']);assert.deepEqual(parse(result).data.custom,{x:1});assert.ok(result.indexOf('# Enum docs')<result.indexOf('name: E'));
});
test('transitive nested array, map, union and optional dependencies',()=>{
 const s=input([{name:'R',type:'record',fields:{v:{type:{type:'array',items:{type:'map',values:['null','U?']}}}}},{name:'U',type:'union',names:['E[]','string']},{name:'E',type:'enum',symbols:['a']}]);
 assert.deepEqual(names(sort(s).text),['E','U','R']);
});
test('inline record fields also contribute dependencies',()=>{
 const s=input([{name:'R',type:'record',fields:[{name:'n',type:{type:'record',fields:[{name:'v',type:'E'}]}}]},{name:'E',type:'enum',symbols:['a']}]);assert.deepEqual(names(sort(s).text),['E','R']);
});
test('inheritance and both specialization map keys and values are dependencies',()=>{
 const s=input([{name:'Child',type:'record',extends:'Base',specialize:{Old:'New'}},{name:'New',type:'enum',symbols:['n']},{name:'Old',type:'enum',symbols:['o']},{name:'Base',type:'record'}]);assert.deepEqual(names(sort(s).text),['New','Old','Base','Child']);
});
test('specialization list and enum inheritance',()=>{
 const s=input([{name:'R',type:'record',specialize:[{specializeFrom:'A',specializeTo:'B'}]},{name:'B',type:'enum',extends:'A',symbols:['b']},{name:'A',type:'enum',symbols:['a']}]);assert.deepEqual(names(sort(s).text),['A','B','R']);
});
test('fragment, base-expanded and namespace references resolve locally',()=>{
 const s=YAML.stringify({$base:'https://example.org/types#',$namespaces:{ex:'https://example.org/types#'},$graph:[{name:'R',type:'record',fields:{a:'#E',b:'ex:E[]?',c:'https://example.org/types#E'}},{name:'E',type:'enum',symbols:['a']}]});assert.deepEqual(names(sort(s).text),['E','R']);
});
test('imports retain relative order and precede local declarations',()=>{
 const s=input([{name:'R',type:'record',fields:{t:'External'}},{$import:'first.yml'},{$import:'second.yml'}]);assert.deepEqual(names(sort(s).text),['first.yml','second.yml','R']);
});
test('already-ordered flow YAML becomes block YAML and stays stable',()=>{
 const s='- {name: E, type: enum, symbols: [a]}\n\n- {name: R, type: record, fields: {v: E}}\n';
 const result=sort(s);assert.equal(result.changed,true);assertBlock(result.text);assert.deepEqual(parse(result.text).data,parse(s).data);assert.equal(sort(result.text).changed,false);
});
function assertBlock(text){YAML.visit(YAML.parseDocument(text),(_,node)=>{if(YAML.isCollection(node)&&node.items.length)assert.ok(!node.flow,text);});}
test('adding a record and enum to a new empty file produces block YAML',()=>{
 let s=mutate('[]\n',{kind:'addDefinition',path:[],type:'record'});
 s=mutate(s,{kind:'addField',path:[0]});s=mutate(s,{kind:'addDefinition',path:[],type:'enum'});
 s=mutate(s,{kind:'addSymbol',path:[1],value:'null'});
 s=mutate(s,{kind:'connect',path:[0,'fields',0],target:[1]});
 assertBlock(s);assert.match(s,/^- name:/);const out=sort(s).text;assert.deepEqual(names(out),['NewEnum','NewRecord']);assert.equal(parse(out).data[0].symbols[0],'null');assertBlock(out);
});
test('saving JSON roots and nested defaults preserves values in block YAML',()=>{
 const defs=[{name:'R',type:'record',fields:[{name:'x',type:['null',{type:'array',items:'string'}],default:null}],custom:{values:[false,0,'null','a: b',[],{}]}}];
 for(const value of [defs,{$graph:defs},defs[0]]){
  const s=JSON.stringify(value),result=sort(s);assert.equal(result.changed,true);assertBlock(result.text);assert.deepEqual(parse(result.text).data,value);assert.equal(sort(result.text).changed,false);
 }
});
test('sorting is stable, deterministic and idempotent',()=>{
 const s=input([{name:'R',type:'record',fields:{e:'E'}},{name:'Unrelated',type:'record'},{name:'E',type:'enum',symbols:['a']},{name:'Other',type:'record'}]);const a=sort(s).text;assert.deepEqual(names(a),['Unrelated','E','R','Other']);assert.equal(sort(a).text,a);assert.equal(sort(s).text,a);
});
test('recursive groups preserve relative order and follow external dependencies',()=>{
 const s=input([{name:'A',type:'record',fields:{b:'B',e:'E'}},{name:'B',type:'record',fields:{a:'A'}},{name:'E',type:'enum',symbols:['a']}]);const result=sort(s);assert.deepEqual(names(result.text),['E','A','B']);assert.deepEqual(result.cycles,[['A','B']]);assert.ok(inspect(result.text).issues.some(i=>i.message.includes('Dependency cycle')));
});
test('self-reference is not treated as an impossible mutual cycle',()=>{
 const s=input([{name:'Node',type:'record',fields:{child:'Node?'}}]);assert.deepEqual(sort(s).cycles,[]);assert.equal(sort(s).text,s);
});
test('YAML anchor remains before its alias after dependency ordering',()=>{
 const s='- name: R\n  type: record\n  doc: &common common docs\n  fields: {e: E}\n- name: Other\n  type: record\n  doc: *common\n- name: E\n  type: enum\n  symbols: [a]\n';const out=sort(s).text;assert.deepEqual(names(out),['E','R','Other']);assert.equal(parse(out).data[2].doc,'common docs');assert.match(out,/&common/);assert.match(out,/\*common/);
});
test('defaults, doc strings and extension properties are not scanned as type references',()=>{
 const s=input([{name:'R',type:'record',doc:'E',fields:{x:{type:'string',default:'E'}},'ex:custom':'E'},{name:'E',type:'enum',symbols:['a']}]);assert.equal(sort(s).text,s);
});
test('unknown external URIs are not guessed by basename',()=>{
 const s=input([{name:'R',type:'record',fields:{e:'https://elsewhere.org/#E'}},{name:'E',type:'enum',symbols:['a']}]);assert.equal(sort(s).text,s);
});
test('single definitions, empty lists and invalid YAML are safe',()=>{for(const s of ['[]\n','name: R\ntype: record\n'])assert.equal(sort(s).text,s);assert.throws(()=>sort('['));});
