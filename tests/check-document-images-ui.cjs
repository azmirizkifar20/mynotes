const assert = require("node:assert/strict");
const { loadFrontend } = require("./helpers/frontend.cjs");
async function main() {
  const modules = await loadFrontend({images:"features/editor/images.js",dom:"core/dom.js",editor:"features/editor/controller.js",live:"features/editor/live-editor.js"});
  const source = {value:"Keep this",selectionStart:9,selectionEnd:9,focus(){},setRangeText(text,start,end){this.value=this.value.slice(0,start)+text+this.value.slice(end);}};
  const ui={"markdown-editor":source,"document-save-state":{},"save-document":{disabled:false}};
  const state={boot:{mode:"workspace"},current:"note",pages:[{id:"note",type:"doc",path:"/Folder/Note.md",body:source.value}],editing:true,liveEditorGeneration:1,draftState:{id:"note",resolved:true,conflict:false},documentBuffer:{id:"note",content:source.value}};
  let calls=0,resolveUpload,warning,changed=0;
  const actions={$:id=>ui[id],notify:message=>warning=message,syncEditorLock(){},async api(endpoint,data){calls++;assert.equal(endpoint,"images/upload");assert.equal(data.get("filePath"),"/Folder/Note.md");return new Promise(resolve=>resolveUpload=resolve);},changeDocumentContent(content){assert(!state.saving);state.documentBuffer.content=content;changed++;},isDirty:()=>true};
  Object.assign(actions,modules.dom.createFeature({state,actions}));
  actions.$=id=>ui[id];
  Object.assign(actions,modules.images.createFeature({state,actions}));
  const file=new File(["fixture"],'quote" onerror="bad.png',{type:"image/png"});
  state.pages[0].type="folder";await actions.uploadDocumentImage(file,{});assert.equal(calls,0);assert(warning.includes("Markdown"));state.pages[0].type="doc";
  await actions.uploadDocumentImage({name:"large.png",size:5*1024*1024+1},{});assert.equal(calls,0);
  state.draftState.conflict=true;await actions.uploadDocumentImage(file,{});assert.equal(calls,0);state.draftState.conflict=false;
  state.navigationPending=1;await actions.uploadDocumentImage(file,{});assert.equal(calls,0);state.navigationPending=0;
  const pending=actions.uploadDocumentImage(file,{});assert(state.imageUploading&&state.toolBusy);
  const live=modules.live.createFeature({state,actions});live.syncDocumentSave();assert(ui["save-document"].disabled,"Manual save disabled during upload");
  let saves=0;const controller=modules.editor.createFeature({state,actions:{...actions,setBusy(){saves++;},flushDraft(){saves++;}}});await controller.saveDoc();assert.equal(saves,0,"Ctrl+S cannot start a save during upload");
  resolveUpload({filename:"image-unique.png",path:"/Folder/image-unique.png"});await pending;
  assert(!state.imageUploading&&!state.toolBusy);assert.equal(changed,1);assert(state.documentBuffer.content.startsWith("Keep this"));assert(state.documentBuffer.content.includes('src="image-unique.png"'));assert(state.documentBuffer.content.includes('&quot; onerror=&quot;'));assert(!state.documentBuffer.content.includes('alt="quote" onerror='));
  const stable=source.value;actions.api=async()=>{throw Error("Upload failed");};await actions.uploadDocumentImage(file,{});assert.equal(source.value,stable);assert.equal(changed,1);assert(!state.imageUploading&&!state.toolBusy);
  actions.api=async()=>{state.draftState.conflict=true;return {filename:"image-conflict.png",path:"/Folder/image-conflict.png"};};await actions.uploadDocumentImage(file,{});assert.equal(source.value,stable);assert(warning.includes("/Folder/image-conflict.png"));assert(!state.imageUploading&&!state.toolBusy);
  const listeners={}, pasted=[];
  let dialog=false;
  const previousDocument=global.document;
  global.document={addEventListener(type,handler,capture){assert.equal(capture,true);listeners[type]=handler;},querySelector:()=>dialog};
  try {
    actions.uploadDocumentImage=(file,event)=>pasted.push({file,event});
    actions.bindDocumentImages();
    function paste(files,{inside=true,items=true}={}) {
      const event={type:"paste",target:{closest:()=>inside},clipboardData:{files,items:items?files.map(file=>({kind:"file",type:file.type,getAsFile:()=>file})):[]},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};
      listeners.paste(event);return event;
    }
    const clip=new File(["image"],"",{type:"image/png"});
    let event=paste([clip]);assert(event.prevented&&event.stopped);assert.equal(pasted.length,1);assert.equal(pasted[0].file.name,"clipboard.png");assert.equal(pasted[0].event,event);
    event=paste([file],{items:false});assert(event.prevented);assert.equal(pasted.length,2);assert.equal(pasted[1].file,file,"Keep a valid clipboard filename");
    assert(!paste([]).prevented,"Text/HTML-only paste remains native");
    assert(!paste([clip],{inside:false}).prevented,"Do not intercept other inputs");
    dialog=true;assert(!paste([clip]).prevented,"Do not intercept modal inputs");dialog=false;
    state.boot.mode="public";assert(!paste([clip]).prevented);state.boot.mode="workspace";
    assert(paste([clip,clip]).prevented);assert.equal(pasted.length,2);assert(warning.includes("satu gambar"));
    assert(paste([new File(["<svg/>"],"image.svg",{type:"image/svg+xml"})]).prevented);assert.equal(pasted.length,2);assert(warning.includes("PNG"));
  } finally {global.document=previousDocument;}
  console.log("Image source insertion, escaping, upload locking, manual-save guard, limits, error and conflict preservation passed.");
  console.log("Clipboard image capture, filename fallback, files fallback, native text paste, editor/dialog/guest scope, multi-image and SVG guards passed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
