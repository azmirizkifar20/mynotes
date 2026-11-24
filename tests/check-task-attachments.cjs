const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
assert.equal(process.env.MDPREVIEW_TEST_ISOLATED, '1');
assert.equal(process.env.DB_HOST, '127.0.0.1');
assert.equal(process.env.DB_USER, 'fixture');
assert.equal(process.env.DB_NAME, 'postgres');
assert(!fs.existsSync(path.join(__dirname, '../.env')), 'Never use the shared database');
const { r2, objects } = require('./helpers/r2.cjs');
const storage = require('../src/backend/modules/task-board/attachment-storage');
const db = require('../src/backend/database');
const boardService = require('../src/backend/modules/task-board/service');
const attachments = require('../src/backend/modules/task-board/attachments');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'task-attachments-'));
require('../src/backend/config/paths').uploads = temp;
const status = code => error => error.status === code;
const pdf = Buffer.from('%PDF-1.7\nfixture\n%%EOF');
let server, taskId;
async function main() {
  await db.initialize(); await db.initialize();
  const fixtures = {
    pdf, zip:Buffer.from('504b0304','hex'), rar:Buffer.from('526172211a070100','hex'),
    xls:Buffer.from('d0cf11e0a1b11ae1','hex'), ppt:Buffer.from('d0cf11e0a1b11ae1','hex'),
    xlsx:Buffer.from('504b0304','hex'), pptx:Buffer.from('504b0304','hex'),
    md:Buffer.from('# catatan'), markdown:Buffer.from('# hasil'), csv:Buffer.from('a,b\n1,2'),
    png:Buffer.from('89504e470d0a1a0a','hex'), jpg:Buffer.from('ffd8ff','hex'), jpeg:Buffer.from('ffd8ff','hex'),
    gif:Buffer.from('GIF89a'), webp:Buffer.from('RIFF0000WEBP'), avif:Buffer.from('0000ftypavif'), bmp:Buffer.from('BM1234'),
    mp4:Buffer.from('0000ftypisom'), mov:Buffer.from('0000ftypqt  '), m4v:Buffer.from('0000ftypM4V '),
    webm:Buffer.from('1a45dfa3','hex'), mkv:Buffer.from('1a45dfa3','hex'), avi:Buffer.from('RIFF0000AVI '),
  };
  for (const [ext, bytes] of Object.entries(fixtures)) attachments.validateFile('Hasil ü.'+ext, bytes);
  for (const name of ['../x.pdf','folder/x.pdf','folder\\x.pdf','.hidden.md','x.pdf\n','x.exe','x.svg','x.html','x.pdf.','x.pdf '])
    assert.throws(() => attachments.validateFile(name,pdf),status(400));
  for (const [name,bytes] of [['x.pdf',Buffer.from('fake')],['x.md',Buffer.from([255])],['x.md',Buffer.from('a\0b')],['x.md',Buffer.alloc(0)]])
    assert.throws(() => attachments.validateFile(name,bytes),status(400));
  { const bytes=Buffer.alloc(attachments.limit+1,32); assert.throws(()=>attachments.validateFile('x.md',bytes),status(400)); attachments.validateFile('x.md',bytes.subarray(0,attachments.limit)); }
  let board=await boardService.list();
  const saved=await boardService.saveTask({title:'Attachment fixture',description:'Keep draft',result:'Keep result',statusId:board.statuses.find(s=>s.completed).id,priority:'normal',due:'',revision:board.revision});
  board=saved.board; taskId=saved.taskId;
  const add=async(name='report.pdf',bytes=pdf)=>{const result=await attachments.add({taskId,filename:name,revision:board.revision},bytes);board=result.board;return board.tasks.find(t=>t.id===taskId).attachments.at(-1);};
  const first=await add('Laporan ü.pdf');
  assert.equal(first.filename,'Laporan ü.pdf'); assert.equal(first.size,pdf.length); assert(!('content' in first) && !('task_id' in first));
  assert.deepEqual((await attachments.download(first.id)).content,pdf);
  assert.equal(r2.viewType('file.PDF'),'application/pdf');
  assert.equal(r2.viewType('file.html'),'application/octet-stream');
  assert.equal(r2.viewType('file.md'),'text/plain; charset=utf-8');
  const stored = (await db.query('SELECT content,object_key,size FROM mdpreview.task_attachments WHERE id=$1',[first.id])).rows[0];
  assert.equal(stored.content,null,'New uploads never write binary into PostgreSQL');
  assert.equal(stored.size,pdf.length);
  assert(stored.object_key.startsWith('md-preview/task-attachments/'+taskId+'/'+first.id+'/'));
  assert.equal(objects.size,1);
  await db.query("ALTER TABLE mdpreview.task_attachment_objects ALTER COLUMN delete_after SET DEFAULT now()-interval '1 second'");
  const connect = db.pool.connect;
  let resumeBeforePut, reachedBeforePut, intercept = true, putCalls = 0;
  const beforePutGate = new Promise(resolve=>{resumeBeforePut=resolve;});
  const beforePut = new Promise(resolve=>{reachedBeforePut=resolve;});
  db.pool.connect = function(...args) {
    if (intercept && !args.length) {
      intercept=false;reachedBeforePut();
      return beforePutGate.then(()=>connect.apply(this,args));
    }
    return connect.apply(this,args);
  };
  const originalPut = r2.put;
  r2.put=async(...args)=>{putCalls++;return originalPut(...args);};
  const expired = storage.stage(taskId,randomUUID(),'expired.pdf',pdf);
  await beforePut;
  try { await storage.cleanup(); }
  finally { resumeBeforePut();db.pool.connect=connect; }
  await assert.rejects(expired,status(409));
  assert.equal(putCalls,0,'Uploader resumed after GC cannot PUT/recreate an untracked object');
  r2.put=originalPut;
  const putBeforePause = r2.put;
  let releasePut, startedPut;
  const resumed = new Promise(resolve=>{releasePut=resolve;});
  const started = new Promise(resolve=>{startedPut=resolve;});
  r2.put = async(...args)=>{await putBeforePause(...args);startedPut();await resumed;};
  const inflight = storage.stage(taskId,randomUUID(),'paused.pdf',pdf);
  await started;
  try {
    await storage.cleanup();
    assert.equal(objects.size,2,'GC skips a staged object while PUT holds its registry row lock');
  } finally { releasePut();r2.put=putBeforePause; }
  const pending = await inflight;
  await db.query("ALTER TABLE mdpreview.task_attachment_objects ALTER COLUMN delete_after SET DEFAULT now()+interval '1 hour'");
  await db.query('UPDATE mdpreview.task_attachment_objects SET delete_after=now() WHERE object_key=$1',[pending.key]);
  await storage.cleanup();
  assert.equal(objects.size,1);
  const put = r2.put;
  r2.put = async()=>{throw new Error('R2 offline');};
  await assert.rejects(add(),/R2 offline/);
  assert.equal((await boardService.list()).revision,board.revision,'R2 errors never commit metadata or advance board');
  r2.put = put;
  await assert.rejects(attachments.download('invalid'),status(404));
  await assert.rejects(attachments.add({taskId:randomUUID(),filename:'a.pdf',revision:board.revision},pdf),status(404));
  assert.equal((await boardService.list()).revision,board.revision,'Failed writes roll back revision');
  for(let i=1;i<9;i++)await add();
  const concurrent=await Promise.allSettled([attachments.add({taskId,filename:'one.pdf',revision:board.revision},pdf),attachments.add({taskId,filename:'two.pdf',revision:board.revision},pdf)]);
  assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(concurrent.find(x=>x.status==='rejected').reason.status,409);
  board=await boardService.list(); assert.equal(board.tasks.find(t=>t.id===taskId).attachments.length,10);
  await assert.rejects(add(),status(400));
  await assert.rejects(db.query('INSERT INTO mdpreview.task_attachments(id,task_id,slot,filename,content) VALUES($1,$2,11,\'x.md\',$3)',[randomUUID(),taskId,Buffer.from('x')]),err=>err.code==='23514');
  await assert.rejects(attachments.remove({taskId,id:first.id,revision:board.revision}),status(400));
  await assert.rejects(attachments.remove({taskId:randomUUID(),id:first.id,confirm:true,revision:board.revision}),status(404));
  ({board}=await attachments.remove({taskId,id:first.id,confirm:true,revision:board.revision}));
  await assert.rejects(attachments.download(first.id),status(404)); await add('replacement.pdf');
  ({board}=await boardService.archiveTask({id:taskId,confirm:true,revision:board.revision}));
  const kept=board.tasks.find(t=>t.id===taskId).attachments[0];
  assert.deepEqual((await attachments.download(kept.id)).content,pdf);
  assert((await attachments.view(kept.id)).url,'Archived task attachments can still be viewed');
  await assert.rejects(add(),status(409));
  await assert.rejects(attachments.remove({taskId,id:kept.id,confirm:true,revision:board.revision}),status(409));
  ({board}=await boardService.restoreTask({id:taskId,confirm:true,revision:board.revision}));
  ({board}=await attachments.remove({taskId,id:kept.id,confirm:true,revision:board.revision}));
  const express=require('express'),app=express(),router=express.Router(),api=express.Router();
  app.use('/mynotes',router); app.use(router);router.use(express.json());
  router.use((req,res,next)=>{req.session={authenticated:req.get('X-Fixture-Auth')==='1'};next();});
  router.use('/api',require('../src/backend/middleware/origin'));api.use(require('../src/backend/middleware/require-auth'));
  require('../src/backend/modules/task-board/attachment-routes')(api);router.use('/api',api);router.use(require('../src/backend/middleware/error-handler'));
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  for(const prefix of ['','/mynotes']){
    const url=origin+prefix+'/api/task-board/attachments', headers={'X-Fixture-Auth':'1'};
    const post=async({name='Résumé ü.pdf',bytes=pdf,auth=true,revision=board.revision,extra={}}={})=>{
      const form=new FormData();form.append('taskId',taskId);form.append('revision',revision);form.append('filename',name);form.append('file',new Blob([bytes]),name);
      return fetch(url+'/upload',{method:'POST',headers:{...(auth?headers:{}),...extra},body:form});
    };
    const existing=board.tasks.find(t=>t.id===taskId).attachments[0];
    assert.equal((await fetch(url+'/'+existing.id+'/download')).status,401);
    assert.equal((await fetch(url+'/'+existing.id+'/view',{redirect:'manual'})).status,401);
    assert.equal((await post({auth:false})).status,401);
    assert.equal((await post({extra:{Origin:'https://evil.invalid'}})).status,403);
    const uploaded=await post();assert.equal(uploaded.status,200);board=(await uploaded.json()).board;
    const file=board.tasks.find(t=>t.id===taskId).attachments.find(x=>x.filename==='Résumé ü.pdf');assert(file);
    const response=await fetch(url+'/'+file.id+'/download',{headers});assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'application/octet-stream');assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert(response.headers.get('content-disposition').startsWith('attachment;'));
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),pdf);
    const get=r2.get;r2.get=async()=>{throw new Error('View must redirect without proxying file bytes');};
    let viewed;
    try { viewed=await fetch(url+'/'+file.id+'/view',{headers,redirect:'manual'}); }
    finally { r2.get=get; }
    assert.equal(viewed.status,302);
    assert.equal(viewed.headers.get('cache-control'),'private, no-store');
    assert.equal(viewed.headers.get('referrer-policy'),'no-referrer');
    const target=new URL(viewed.headers.get('location'));
    assert.equal(target.protocol,'https:');assert(target.hostname.endsWith('r2.cloudflarestorage.com'));
    assert.equal(target.searchParams.get('X-Amz-Expires'),'900');
    assert.equal(target.searchParams.get('response-content-type'),'application/pdf');
    assert.equal(target.searchParams.get('response-content-disposition'),'inline');
    assert.equal(target.searchParams.get('response-cache-control'),'private, no-store');
    assert(target.searchParams.get('X-Amz-Signature'));
    assert.equal((await fetch(url+'/invalid/view',{headers,redirect:'manual'})).status,404);
    assert.equal((await post({name:'bad.pdf',bytes:Buffer.from('fake')})).status,400);
    assert.equal((await post({revision:board.revision-1})).status,409);
    const removed=await fetch(url+'/delete',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id:file.id,taskId,confirm:true,revision:board.revision})});
    assert.equal(removed.status,200);board=(await removed.json()).board;
    assert.equal((await fetch(url+'/'+file.id+'/download',{headers})).status,404);
    assert.equal((await fetch(url+'/'+file.id+'/view',{headers,redirect:'manual'})).status,404);
    assert.deepEqual(fs.readdirSync(temp),[],'Temporary uploads cleaned after success and failure');
  }
  // Multipart size enforcement must have its own limit, independent of document uploads.
  { const form=new FormData();form.append('taskId',taskId);form.append('revision',board.revision);form.append('filename','large.md');form.append('file',new Blob([Buffer.alloc(attachments.limit+1,32)]),'large.md');
    const response=await fetch(origin+'/api/task-board/attachments/upload',{method:'POST',headers:{'X-Fixture-Auth':'1'},body:form});assert.equal(response.status,400);assert((await response.json()).message.includes('50 MB')); }
  assert.deepEqual(fs.readdirSync(temp),[]);
  { const bytes=Buffer.alloc(attachments.limit,32);bytes.write('%PDF-1.7\n');const form=new FormData();form.append('taskId',taskId);form.append('revision',board.revision);form.append('filename','exact-50.pdf');form.append('file',new Blob([bytes]),'exact-50.pdf');
    const response=await fetch(origin+'/api/task-board/attachments/upload',{method:'POST',headers:{'X-Fixture-Auth':'1'},body:form});assert.equal(response.status,200,'Exactly 50 MB is accepted');board=(await response.json()).board;assert.equal(board.tasks.find(t=>t.id===taskId).attachments.find(x=>x.filename==='exact-50.pdf').size,attachments.limit); }
  const oldIds=board.tasks.find(t=>t.id===taskId).attachments.map(x=>x.id);
  ({board}=await boardService.removeTask({id:taskId,confirm:true,revision:board.revision}));
  assert.equal((await db.query('SELECT id FROM mdpreview.task_attachments WHERE task_id=$1',[taskId])).rowCount,0);
  await assert.rejects(attachments.download(oldIds[0]),status(404));
  const remove = r2.remove;
  let removalAttempts = 0;
  r2.remove = async(...args)=>{if(++removalAttempts===1)throw new Error('R2 offline');return remove(...args);};
  await assert.rejects(storage.cleanup(),/R2 offline/);
  assert(removalAttempts>1,'One failed object must not block deleting other due objects');
  assert((await db.query('SELECT 1 FROM mdpreview.task_attachment_objects')).rowCount>0,'Failed deletes remain queued with retry backoff');
  r2.remove = remove;
  await db.query("UPDATE mdpreview.task_attachment_objects SET delete_after=now()-interval '1 second'");
  await storage.cleanup();
  assert.equal(objects.size,0,'Individual deletes, task cascades and orphan uploads are collected');
  assert.equal((await db.query('SELECT 1 FROM mdpreview.task_attachment_objects')).rowCount,0);

  ({board,taskId}=await boardService.saveTask({title:'Legacy fixture',description:'',statusId:board.statuses[0].id,priority:'normal',due:'',revision:board.revision}));
  const legacyId = randomUUID();
  await db.query("INSERT INTO mdpreview.task_attachments(id,task_id,slot,filename,content) VALUES($1,$2,1,'legacy.pdf',$3)",[legacyId,taskId,pdf]);
  assert.deepEqual((await attachments.download(legacyId)).content,pdf,'Legacy downloads work during rollout');
  const legacy=await fetch(origin+'/api/task-board/attachments/'+legacyId+'/view',{headers:{'X-Fixture-Auth':'1'}});
  assert.equal(legacy.status,200);assert.equal(legacy.headers.get('content-type'),'application/pdf');assert.equal(legacy.headers.get('content-disposition'),'inline');
  assert.deepEqual(Buffer.from(await legacy.arrayBuffer()),pdf);
  const {migrate}=require('../scripts/migrate-task-attachments');
  const get = r2.get;
  r2.get = async()=>Buffer.from('corrupt');
  await assert.rejects(migrate(),/readback mismatch/);
  assert.deepEqual((await db.query('SELECT content FROM mdpreview.task_attachments WHERE id=$1',[legacyId])).rows[0].content,pdf,'Failed verification retains original bytes');
  r2.get=get;
  assert.deepEqual(await migrate(),{migrated:1,total:1,legacy:0,r2:1});
  assert.deepEqual(await migrate(),{migrated:0,total:1,legacy:0,r2:1},'Migration rerun is safe');
  assert.deepEqual((await attachments.download(legacyId)).content,pdf,'Migrated attachment keeps its ID/download bytes');
  await db.query("UPDATE mdpreview.task_attachment_objects SET delete_after=now()-interval '1 second'");
  await storage.cleanup();
  assert.equal(objects.size,1,'GC never deletes a referenced object');
  assert.deepEqual((await attachments.download(legacyId)).content,pdf);
  r2.get=async()=>{throw new Error('Unavailable');};
  await assert.rejects(attachments.download(legacyId),status(503));
  r2.get=get;
  await boardService.removeTask({id:taskId,confirm:true,revision:board.revision});
  await storage.cleanup();
  assert.equal(objects.size,0);
  console.log('Task attachment assertions passed: formats, 50 MB, 10 slots/concurrency, rollback, archive, auth/origin, both mounts, cleanup, cascade.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(resolve=>server.close(resolve));if(taskId)await db.query('DELETE FROM mdpreview.tasks WHERE id=$1',[taskId]);await db.pool.end();fs.rmSync(temp,{recursive:true,force:true});});
