'use strict';
const vscode=require('vscode');
const crypto=require('node:crypto');
const {inspect,mutate,serializeInDependencyOrder}=require('./model');
function activate(context){
  const diagnostics=vscode.languages.createDiagnosticCollection('schema-salad');
  context.subscriptions.push(diagnostics);
  const managedDocuments=new Set();
  let activeSchemaUri;
  context.subscriptions.push(vscode.workspace.onWillSaveTextDocument(event=>{
    if(!managedDocuments.has(event.document.uri.toString()))return;
    try{
      const result=serializeInDependencyOrder(event.document.getText());
      if(result.changed)event.waitUntil(Promise.resolve([vscode.TextEdit.replace(new vscode.Range(0,0,event.document.lineCount,0),result.text)]));
    }catch{ /* Invalid YAML must remain saveable; the editor already reports it. */ }
  }));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(document=>managedDocuments.delete(document.uri.toString())));
  const provider={async resolveCustomTextEditor(document,panel){
    managedDocuments.add(document.uri.toString());
    activeSchemaUri=document.uri;
    const viewState=panel.onDidChangeViewState(event=>{if(event.webviewPanel.active)activeSchemaUri=document.uri;});
    const webview=panel.webview;
    webview.options={enableScripts:true,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media')]};
    const nonce=crypto.randomBytes(18).toString('base64');
    const css=webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','studio.css'));
    const types=webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','type-utils.js'));
    const js=webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','studio.js'));
    webview.html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;"><link rel="stylesheet" href="${css}"></head><body><div id="app"></div><script nonce="${nonce}" src="${types}"></script><script nonce="${nonce}" src="${js}"></script></body></html>`;
    let disposed=false;
    const update=()=>{
      if(disposed)return;
      const state=inspect(document.getText(),document.version);
      diagnostics.set(document.uri,state.issues.map(i=>new vscode.Diagnostic(new vscode.Range(document.positionAt(i.offset),document.positionAt(i.offset+1)),i.message,i.severity==='error'?vscode.DiagnosticSeverity.Error:i.severity==='warning'?vscode.DiagnosticSeverity.Warning:vscode.DiagnosticSeverity.Information)));
      webview.postMessage({kind:'state',state});
    };
    let pending=Promise.resolve();
    const messages=webview.onDidReceiveMessage(message=>{
      if(message.kind==='ready')return update();
      if(message.kind==='source')return vscode.window.showTextDocument(document,{viewColumn:vscode.ViewColumn.Beside});
      if(message.kind==='save'){
        // Explicit normalization also covers an already-clean document: VS Code
        // may skip will-save events when there are no unsaved changes.
        pending=pending.then(async()=>{
          try{
            let result;try{result=serializeInDependencyOrder(document.getText());}catch{await document.save();return;}
            if(result.changed){const edit=new vscode.WorkspaceEdit();edit.replace(document.uri,new vscode.Range(0,0,document.lineCount,0),result.text);if(!await vscode.workspace.applyEdit(edit))throw new Error('VS Code could not apply dependency ordering.');}
            await document.save();
          }catch(e){webview.postMessage({kind:'error',message:e.message});}
        });return;
      }
      if(message.kind==='undo'||message.kind==='redo')return vscode.commands.executeCommand(message.kind);
      if(message.kind!=='edit')return;
      pending=pending.then(async()=>{
        try{
          if(message.version!==document.version)throw new Error('The YAML changed since this edit began. Review the refreshed selection and retry.');
          const text=mutate(document.getText(),message.operation);
          const edit=new vscode.WorkspaceEdit();
          edit.replace(document.uri,new vscode.Range(0,0,document.lineCount,0),text);
          if(!await vscode.workspace.applyEdit(edit))throw new Error('VS Code could not apply this edit.');
        }catch(e){update();webview.postMessage({kind:'error',message:e.message});return;}
        update();
      });
    });
    const change=vscode.workspace.onDidChangeTextDocument(e=>{if(e.document.uri.toString()===document.uri.toString())update();});
    panel.onDidDispose(()=>{disposed=true;messages.dispose();change.dispose();viewState.dispose();if(activeSchemaUri?.toString()===document.uri.toString())activeSchemaUri=undefined;diagnostics.delete(document.uri);});
  }};
  context.subscriptions.push(vscode.window.registerCustomEditorProvider('schemaSalad.studio',provider,{webviewOptions:{retainContextWhenHidden:true},supportsMultipleEditorsPerDocument:false}));
  context.subscriptions.push(vscode.commands.registerCommand('schemaSalad.open',async(uri)=>{
    uri=uri||vscode.window.activeTextEditor?.document.uri;
    if(!uri){const chosen=await vscode.window.showOpenDialog({canSelectMany:false,filters:{'Schema Salad':['yaml','yml','salad']}});uri=chosen?.[0];}
    if(uri)await vscode.commands.executeCommand('vscode.openWith',uri,'schemaSalad.studio');
  }));
  context.subscriptions.push(vscode.commands.registerCommand('schemaSalad.new',async()=>{
    const candidate=vscode.window.activeTextEditor?.document.uri||activeSchemaUri;
    const directory=candidate&&candidate.scheme!=='untitled'
      ? vscode.Uri.joinPath(candidate,'..')
      : vscode.workspace.workspaceFolders?.[0]?.uri;
    // Retain the URI scheme for remote workspaces; with no open folder, let
    // VS Code choose its normal save-dialog location.
    const options={filters:{'Schema Salad':['yaml','yml']}};
    if(directory)options.defaultUri=vscode.Uri.joinPath(directory,'schema.salad.yaml');
    const uri=await vscode.window.showSaveDialog(options);
    if(!uri)return;
    await vscode.workspace.fs.writeFile(uri,Buffer.from('[]\n','utf8'));
    await vscode.commands.executeCommand('vscode.openWith',uri,'schemaSalad.studio');
  }));
}
module.exports={activate};
