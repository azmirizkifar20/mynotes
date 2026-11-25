const assert = require('node:assert/strict');
const { loadFrontend } = require('./helpers/frontend.cjs');
(async () => {
  const { attachments, api } = await loadFrontend({ attachments: 'features/task-board/attachments.js', api: 'core/api.js' });
  const nodes = new Map();
  const $ = id => { if (!nodes.has(id)) nodes.set(id, { value:'', textContent:'',innerHTML:'', hidden:false, disabled:false,open:false,classList:{remove(){},toggle(){}},setAttribute(){},addEventListener(event,work){this[event]=work;},close(){this.closed=true;this.open=false;this.closeEvent?.();} });return nodes.get(id); };
  $('board-task-dialog').open=true;
  for(const id of ['board-task-dialog','board-confirm-dialog']) $(id).addEventListener=function(event,work){this[event==='close'?'closeEvent':event]=work;};
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let board={revision:1,tasks:[{id:'task',attachments:[]}]},invalidated=0,failure=0,confirm,request=0;
  const uploaded=[];
  const state={toolBusy:false,taskBoardDirty:true};
  const actions={$,escape,icon:()=>'',appUrl:path=>'/mynotes'+path,notify(){},resetFileDrag(){},async api(endpoint,body){
    request++;if(failure && request===failure)throw Object.assign(new Error('Upload unavailable'),{status:409});
    assert(state.toolBusy);assert(invalidated>0,'Invalidate pending polls before sending writes');
    const updated=structuredClone(board);updated.revision++;
    if(endpoint.startsWith('task-board/attachments/upload?')){const query=new URLSearchParams(endpoint.split('?')[1]);assert.equal(Number(query.get('revision')),board.revision);assert.equal(query.get('taskId'),'task');assert(body instanceof File);uploaded.push(body.name);updated.tasks[0].attachments.push({id:'file-'+request,filename:body.name,size:12});}
    else updated.tasks[0].attachments=updated.tasks[0].attachments.filter(item=>item.id!==body.id);
    return {board:updated};
  }};
  const feature=attachments.createFeature({state,actions,getBoard:()=>board,setBoard:value=>{board=value;},getTaskId:()=> 'task',invalidate:()=>invalidated++,controls(){},paint(){},ask(title,copy,label,work){confirm=work;$('board-confirm-dialog').open=true;}});
  feature.bind();
  const pick=names=> $('board-attachment-input').change({target:{files:names.map(name=>new File(['file'],name)),value:'selected'}});
  await pick(['cancel.pdf']);assert.equal(request,0,'Choosing files only stages them');assert($('board-confirm-files').innerHTML.includes('cancel.pdf'));$('board-confirm-dialog').close();await confirm();assert.equal(request,0,'Cancel clears pending files');
  await pick(['brief.pdf','result.md']);assert.equal(request,0);$('board-confirm-dialog').closeEvent();await confirm();assert.equal(board.tasks[0].attachments.length,2,'A delayed close event cannot clear a reopened confirmation');assert.equal(invalidated,1);assert.equal(state.toolBusy,false);assert(state.taskBoardDirty);
  assert($('board-attachment-list').innerHTML.includes('/mynotes/api/task-board/attachments/'));
  assert($('board-attachment-list').innerHTML.includes('/view" target="_blank" rel="noopener noreferrer"'));
  assert(!$('board-attachment-list').innerHTML.includes(' download'));
  const item=board.tasks[0].attachments[0];item.filename='<unsafe>.pdf';feature.render();assert($('board-attachment-list').innerHTML.includes('&lt;unsafe&gt;.pdf'));
  failure=request+2;await pick(['first.pdf','second.pdf','third.pdf']);await confirm();assert.equal(board.tasks[0].attachments.length,3);assert($('board-confirm-error').textContent.includes('1 lampiran sebelumnya sudah tersimpan'));assert.equal($('board-confirm-reload').hidden,false);assert(state.taskBoardDirty);
  assert(!$('board-confirm-files').innerHTML.includes('first.pdf'));assert($('board-confirm-files').innerHTML.includes('second.pdf'));failure=0;await confirm();assert.equal(board.tasks[0].attachments.length,5);assert.equal(uploaded.filter(name=>name==='first.pdf').length,1,'Retry excludes successful uploads');
  feature.removeBoardAttachment(item.id);assert(confirm);await confirm();assert.equal(board.tasks[0].attachments.length,4);assert(state.taskBoardDirty);assert($('board-confirm-dialog').closed);
  const stable=request;await pick(['unsupported.exe']);assert.equal(request,stable);await pick(Array.from({length:9},(_,i)=>i+'.pdf'));assert.equal(request,stable);
  const event=files=>({preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},dataTransfer:{types:['Files'],items:[],files,dropEffect:''}});
  const dropped=event([new File(['file'],'<safe>.pdf')]);$('board-attachments').dragenter(dropped);$('board-attachments').dragover(dropped);assert.equal(dropped.dataTransfer.dropEffect,'copy');$('board-attachments').drop(dropped);assert(dropped.prevented&&dropped.stopped);assert.equal(request,stable);assert($('board-confirm-files').innerHTML.includes('&lt;safe&gt;.pdf'));await confirm();assert.equal(board.tasks[0].attachments.length,5);
  const folder=event([]);folder.dataTransfer.items=[{webkitGetAsEntry:()=>({isDirectory:true})}];$('board-attachments').drop(folder);assert($('board-attachment-error').textContent.includes('bukan folder'));
  const huge=event([{name:'big.pdf',size:100*1024*1024+1}]);$('board-attachments').drop(huge);assert($('board-attachment-error').textContent.includes('100 MB'));
  board.tasks[0].archivedAt='2026-11-24';feature.render();assert($('board-attachment-input').disabled);assert(!$('board-attachment-list').innerHTML.includes('removeBoardAttachment'));
  const locked=request;$('board-attachments').drop(event([new File(['file'],'locked.pdf')]));await pick(['locked.pdf']);assert.equal(request,locked);assert(!$('board-confirm-dialog').open);
  delete board.tasks[0].archivedAt;state.toolBusy=true;$('board-attachments').dragover(dropped);assert.equal(dropped.dataTransfer.dropEffect,'none');$('board-attachments').drop(dropped);assert.equal(request,locked);
  const originalFetch=globalThis.fetch, file=new File(['file'],'Hasil ü.pdf');
  try {
    globalThis.fetch=async(url,options)=>{assert.equal(url,'/mynotes/api/task-board/attachments/upload?taskId=task&revision=1');assert.equal(options.body,file);assert.equal(options.headers['Content-Type'],'application/octet-stream');assert.equal(decodeURIComponent(options.headers['X-Upload-Filename']),file.name);return {ok:true,json:async()=>({success:true})};};
    await api.createFeature({state,actions}).api('task-board/attachments/upload?taskId=task&revision=1',file);
  } finally { globalThis.fetch=originalFetch; }
  console.log('Attachment UI assertions passed: picker/drop confirmation, raw File request and encoded filename, cancellation, 100 MB/count guards, partial retry, revisions, dirty form, busy and archive.');
})().catch(error=>{console.error(error);process.exitCode=1;});
