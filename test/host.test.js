'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module'),fs=require('node:fs');
test('custom editor uses versioned WorkspaceEdits, refreshes, surfaces stale errors and disposes',async()=>{
 let provider,change,receive,dispose,willSave,closed,applied=0,fail=false,diag;
 let text=fs.readFileSync('examples/starter.salad.yml','utf8');
 const messages=[];const uri={toString:()=> 'file:///schema.yml'};
 const document={uri,version:1,getText:()=>text,get lineCount(){return text.split('\n').length;},positionAt:x=>({line:0,character:x}),save:async()=>true};
 class Range{constructor(...args){this.args=args;}}
 class WorkspaceEdit{replace(uri,range,content){this.uri=uri;this.range=range;this.content=content;}}
 const api={
  languages:{createDiagnosticCollection:()=>({set:(u,d)=>diag=d,delete:()=>{},dispose:()=>{}})},Diagnostic:class{constructor(range,message,severity){Object.assign(this,{range,message,severity});}},Range,WorkspaceEdit,
  TextEdit:{replace:(range,newText)=>({range,newText})},
  DiagnosticSeverity:{Error:0,Warning:1,Information:2},ViewColumn:{Beside:2},Uri:{joinPath:(u,...p)=>p.join('/')},
  window:{registerCustomEditorProvider:(id,p)=>{provider=p;return {dispose(){}};}},commands:{registerCommand:()=>({dispose(){}})},
  workspace:{onWillSaveTextDocument:fn=>{willSave=fn;return {dispose(){}};},onDidCloseTextDocument:fn=>{closed=fn;return {dispose(){}};},onDidChangeTextDocument:fn=>{change=fn;return {dispose(){change=null;}};},applyEdit:async e=>{if(fail)return false;assert.equal(e.uri,uri);assert.deepEqual(e.range.args,[0,0,document.lineCount,0]);text=e.content;document.version++;applied++;change({document});return true;}}
 };
 const original=Module._load;Module._load=function(id,...args){return id==='vscode'?api:original.call(this,id,...args);};
 try{
  delete require.cache[require.resolve('../src/extension')];require('../src/extension').activate({extensionUri:'extension',subscriptions:[]});
  const panel={webview:{cspSource:'vscode-webview:',asWebviewUri:x=>x,postMessage:m=>messages.push(m),onDidReceiveMessage:fn=>{receive=fn;return {dispose(){receive=null;}};}},onDidChangeViewState:()=>({dispose(){}}),onDidDispose:fn=>dispose=fn};
  await provider.resolveCustomTextEditor(document,panel);assert.match(panel.webview.html,/Content-Security-Policy/);assert.ok(!panel.webview.html.includes("script-src 'unsafe-inline'"));
  receive({kind:'ready'});assert.equal(messages.at(-1).state.version,1);assert.equal(diag.length,0);
  receive({kind:'edit',version:1,operation:{kind:'set',path:['$graph',0],key:'doc',value:'Updated'}});await new Promise(r=>setImmediate(r));assert.equal(applied,1);assert.match(text,/doc: Updated/);
  receive({kind:'edit',version:1,operation:{kind:'delete',path:['$graph',1]}});await new Promise(r=>setImmediate(r));assert.equal(applied,1);assert.equal(messages.at(-1).kind,'error');assert.match(messages.at(-1).message,/changed/);
  fail=true;receive({kind:'edit',version:2,operation:{kind:'set',path:['$graph',0],key:'doc',value:'Rejected'}});await new Promise(r=>setImmediate(r));assert.equal(applied,1);assert.match(messages.at(-1).message,/could not apply/);assert.doesNotMatch(text,/Rejected/);
  text='- {name: R, type: record, fields: {kind: E}}\n- {name: E, type: enum, symbols: [a]}\n';
  fail=false;receive({kind:'save'});await new Promise(r=>setImmediate(r));assert.ok(text.indexOf('name: E')<text.indexOf('name: R'));
  text='- {name: R, type: record, fields: {kind: E}}\n- {name: E, type: enum, symbols: [a]}\n';
  let saveEdits;willSave({document,waitUntil:p=>saveEdits=p});
  const result=await saveEdits;assert.ok(result[0].newText.indexOf('name: E')<result[0].newText.indexOf('name: R'));
  saveEdits=null;willSave({document:{...document,uri:{toString:()=> 'file:///unrelated.yml'}},waitUntil:p=>saveEdits=p});assert.equal(saveEdits,null);
  text='[';willSave({document,waitUntil:p=>saveEdits=p});assert.equal(saveEdits,null);
  closed(document);text='- {name: R, type: record, fields: {kind: E}}\n- {name: E, type: enum, symbols: [a]}\n';willSave({document,waitUntil:p=>saveEdits=p});assert.equal(saveEdits,null);
  dispose();assert.equal(change,null);assert.equal(receive,null);
 }finally{Module._load=original;}
});
