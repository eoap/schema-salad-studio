'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path');
const {inspect,mutate,parse}=require('../src/model');
test('New Schema creates an empty schema and opens it in the visual editor from the current directory',async()=>{
 const uri=(p,scheme='file')=>({path:p,scheme,toString(){return this.scheme+':'+this.path;}});
 const commands=new Map(),written=[],opened=[],options=[];
 let destination=uri('/work/schema.salad.yaml');
 const dispose=()=>({dispose(){}});
 const api={Uri:{joinPath:(u,...segments)=>uri(path.posix.join(u.path,...segments),u.scheme)},
  languages:{createDiagnosticCollection:()=>({dispose(){}})},
  window:{activeTextEditor:{document:{uri:uri('/work/project/types/existing.yml')}},registerCustomEditorProvider:dispose,showSaveDialog:async o=>{options.push(o);return destination;}},
  workspace:{workspaceFolders:[{uri:uri('/work/project')}],onWillSaveTextDocument:dispose,onDidCloseTextDocument:dispose,fs:{writeFile:async(u,b)=>written.push([u,b.toString('utf8')])}},
  commands:{registerCommand:(id,fn)=>{commands.set(id,fn);return dispose();},executeCommand:async(...args)=>opened.push(args)}};
 const original=Module._load;Module._load=function(id,...args){return id==='vscode'?api:original.call(this,id,...args);};
 try{
  delete require.cache[require.resolve('../src/extension')];require('../src/extension').activate({extensionUri:uri('/extension'),subscriptions:[]});
  await commands.get('schemaSalad.new')();
  assert.equal(options.at(-1).defaultUri.path,'/work/project/types/schema.salad.yaml');
  assert.deepEqual(options.at(-1).filters['Schema Salad'],['yaml','yml']);
  assert.equal(written[0][1],'[]\n');assert.deepEqual(inspect(written[0][1]).definitions,[]);
  assert.deepEqual(opened[0],['vscode.openWith',destination,'schemaSalad.studio']);
  // The first record can be created on the empty canvas.
  const first=mutate(written[0][1],{kind:'addDefinition',path:[],type:'record'});assert.equal(parse(first).data[0].type,'record');
  api.window.activeTextEditor=undefined;await commands.get('schemaSalad.new')();assert.equal(options.at(-1).defaultUri.path,'/work/project/schema.salad.yaml');
  api.window.activeTextEditor={document:{uri:uri('/remote/folder/file.yml','vscode-remote')}};await commands.get('schemaSalad.new')();assert.equal(options.at(-1).defaultUri.scheme,'vscode-remote');assert.equal(options.at(-1).defaultUri.path,'/remote/folder/schema.salad.yaml');
  api.window.activeTextEditor={document:{uri:uri('Untitled-1','untitled')}};await commands.get('schemaSalad.new')();assert.equal(options.at(-1).defaultUri.path,'/work/project/schema.salad.yaml');
  api.workspace.workspaceFolders=[];await commands.get('schemaSalad.new')();assert.equal(options.at(-1).defaultUri,undefined);
  destination=undefined;const count=written.length;await commands.get('schemaSalad.new')();assert.equal(written.length,count);assert.equal(opened.length,count);
 }finally{Module._load=original;}
});
