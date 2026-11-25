const express = require('express');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const app = express(), router = express.Router();
app.set('views', path.join(root, 'src/frontend/views')); app.set('view engine', 'ejs');
app.locals.frontendAssets = require(path.join(root, 'dist/server/backend/rendering/frontend-assets')).readFrontendAssets(root);
app.use('/mynotes', router); app.use(router); router.use(express.json()); router.use('/static/app', express.static(path.join(root, 'dist/frontend')));
const statuses = ['Ide', 'Siap dikerjakan', 'Dikerjakan', 'Selesai'].map((name, position) => ({ id: randomUUID(), name, tone: ['neutral', 'blue', 'amber', 'green'][position], position, completed: position === 3 }));
const sample = { revision: 1, statuses, tags: [], tasks: [
  { id: randomUUID(), number: '1', title: 'Susun catatan mingguan', description: 'Kumpulkan keputusan dan tindak lanjut.', statusId: statuses[0].id, priority: 'normal', due: '' },
  { id: randomUUID(), number: '2', title: 'Rapikan dokumentasi API', description: 'Contoh request dan response untuk endpoint baru.', statusId: statuses[1].id, priority: 'high', due: '2026-11-25' },
  { id: randomUUID(), number: '3', title: 'Review alur task board', description: 'Coba tambah task, pindah status, dan edit detail.', statusId: statuses[2].id, priority: 'high', due: '2026-11-23' },
  { id: randomUUID(), number: '4', title: 'Arsipkan catatan sprint lalu', description: '', statusId: statuses[3].id, priority: 'low', due: '' },
] };
const originalDocs = [
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', path: '/work/api notes.md' },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', path: '/other/api notes.md' },
  { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', path: '/work/unicode ü.md' },
];
let documents = structuredClone(originalDocs), suggestionFailure = false;
let uploadCount = 0, failUploadAt = 0;
let board = structuredClone(sample), next = 5, failNext = 0, preferences = { favorites: [], recent: [], preferences_imported: true };
const pages = [{ id: 'home', title: 'Ruang kerja', type: 'folder', path: '/', parent: null, description: 'Catatan dan dokumenmu.', modified: '2026-11-21' }];

const sampleDoc={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',title:'Catatan meeting',type:'doc',path:'/meeting.md',parent:'home',body:'# Catatan meeting\n\nKeputusan untuk minggu ini.\n\n## Langkah berikutnya\n\nSelesaikan query hospital.',html:'<h1>Catatan meeting</h1><p>Keputusan untuk minggu ini.</p><h2>Langkah berikutnya</h2><p>Selesaikan query hospital.</p>',modified:'2026-11-24',revision:1,visibility:'private',description:'Catatan kerja'};
pages.push(sampleDoc);
pages.push({id:'notes-folder',title:'notes',path:'/notes',parent:'home',type:'folder',modified:'2026-11-24'}, {id:'dddddddd-dddd-dddd-dddd-dddddddddddd',title:'Panduan proyek',path:'/panduan.pdf',parent:'home',type:'pdf',modified:'2026-11-24',visibility:'public'});
preferences.recent=[sampleDoc.id,'dddddddd-dddd-dddd-dddd-dddddddddddd'];
sampleDoc.body += Array.from({length:8},(_,i)=>'\n\n## Bagian '+(i+1)+'\n\n'+('Catatan panjang untuk melihat posisi daftar isi dan scroll container. '.repeat(16))).join('');
sampleDoc.html += Array.from({length:8},(_,i)=>'<h2>Bagian '+(i+1)+'</h2><p>'+('Catatan panjang untuk melihat posisi daftar isi dan scroll container. '.repeat(16))+'</p>').join('');
let headingIndex=0;sampleDoc.html=sampleDoc.html.replace(/<h([1-6])>/g,(_,level)=>'<h'+level+' id="fixture-heading-'+(++headingIndex)+'">');

sampleDoc.body = '# Catatan meeting\n\nKeputusan dan tindak lanjut minggu ini.\n\nTulis di sini.';
sampleDoc.html = '<h1 id="fixture-document-heading">Catatan meeting</h1><p>Keputusan dan tindak lanjut minggu ini.</p><p>Tulis di sini.</p>';
pages.push({id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',title:'Catatan API',path:'/work/api notes.md',parent:'home',type:'doc',modified:'2026-11-25',visibility:'private'});
board.statuses[2].inProgress = true;
let focusIds = [board.tasks[0].id], focusToken = null;
const todayData = () => ({day:'2026-11-25',token:focusToken,focusIds,statuses:board.statuses,tasks:board.tasks.filter(t=>!t.archivedAt&&!board.statuses.find(s=>s.id===t.statusId).completed)});
router.get('/api/today',(req,res)=>res.json({success:true,today:todayData()}));
router.post('/api/today',(req,res)=>{focusIds=req.body.ids;focusToken=randomUUID();res.json({success:true,today:todayData()});});
router.get('/api/document-links',(req,res)=>res.json({success:true,incoming:[{id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',path:'/work/api notes.md',kind:'doc'}],outgoing:[]}));

router.get('/api/passkeys',(req,res)=>res.json({success:true,authURL:'http://127.0.0.1:'+req.socket.localPort+req.baseUrl,items:[{id:'fixture-key',name:'Laptop pribadi',current:true,created_at:'2026-11-20',last_used_at:'2026-11-25',backed_up:true}]}));
router.get('/api/templates',(req,res)=>res.json({success:true,items:[{id:'template-one',name:'Catatan meeting',content:'# Meeting\n\n## Agenda\n\n## Keputusan\n\n## Tindak lanjut'},{id:'template-two',name:'Catatan teknis',content:'# Judul\n\n## Konteks\n\n## Solusi'}]}));
router.get('/api/trash',(req,res)=>res.json({success:true,items:[{id:'trashed-one',path:'/notes/catatan-lama.md',deleted_at:'2026-11-24'}]}));
router.get('/api/activity',(req,res)=>res.json({success:true,items:[{id:'activity-one',action:'Dokumen disimpan',detail:'docs/meeting.md',created_at:'2026-11-25T07:40:00Z'},{id:'activity-two',action:'Task diperbarui',detail:'Rapikan dokumentasi API',created_at:'2026-11-25T06:15:00Z'},{id:'activity-three',action:'Dokumen dibuat',detail:'docs/panduan.pdf',created_at:'2026-11-24T02:30:00Z'}]}));
router.get('/media',(req,res)=>{
 const stream='BT /F1 22 Tf 50 750 Td (Panduan proyek) Tj 0 -38 Td /F1 11 Tf (Sample PDF. No workspace data.) Tj ET',objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`});const xref=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;res.type('pdf').send(Buffer.from(pdf));
});
router.post('/api/share',(req,res)=>{const page=pages.find(page=>page.path===req.body.filePath);if(req.body.visibility)page.visibility=req.body.visibility;res.json({success:true,visibility:page.visibility,sharePath:req.baseUrl+page.path});});
router.get('/fixture/:mode',(req,res,next)=>{
 if(!['public','login','private'].includes(req.params.mode))return next();
 const bootstrap=JSON.stringify({mode:req.params.mode,document:sampleDoc,message:'Dokumen ini privat',description:'Masuk ke workspace untuk membaca dokumen ini.',editorVersion:'4.0.1',basePath:req.baseUrl,authURL:'http://127.0.0.1:'+req.socket.localPort+req.baseUrl});
 res.render('layout',{bootstrap,basePath:req.baseUrl,editorVersion:'4.0.1',assetVersion:'fixture',passkeyBrowserVersion:'14.0.0'});
});
let views=[],viewsToken=null; const taskDrafts=new Map();
router.all('/api/document',(req,res)=>res.json({success:true,...sampleDoc,content:sampleDoc.body}));
router.post('/api/draft/read',(req,res)=>res.json({success:true,draft:null}));
router.post('/api/draft/save',(req,res)=>res.json({success:true,draft:{token:randomUUID()}}));
router.post('/api/draft',(req,res)=>res.json({success:true,token:randomUUID()}));
router.post('/api/history',(req,res)=>res.json({success:true,revision:1,items:[{revision:1,saved_at:'2026-11-24'},{revision:2,saved_at:'2026-11-23'}]}));
router.post('/api/history/preview',(req,res)=>res.json({success:true,content:'# Catatan meeting\n\nKeputusan lama.',currentContent:sampleDoc.body,currentRevision:sampleDoc.revision,savedAt:'2026-11-23'}));
router.post('/api/save',(req,res)=>{sampleDoc.body=req.body.content;sampleDoc.revision++;res.json({success:true,revision:sampleDoc.revision,modified:'2026-11-24',html:sampleDoc.html});});
router.get('/api/task-board/related',(req,res)=>res.json({success:true,items:board.tasks.slice(0,2).map(t=>({...t,statusName:statuses.find(s=>s.id===t.statusId).name}))}));
router.get('/api/history',(req,res)=>res.json({success:true,revision:1,items:[{revision:1,saved_at:'2026-11-24'},{revision:2,saved_at:'2026-11-23'}]}));
router.get('/api/history/preview',(req,res)=>res.json({success:true,content:'# Catatan meeting\n\nKeputusan lama.',currentContent:sampleDoc.body,currentRevision:1,savedAt:'2026-11-23'}));
router.get('/api/search',(req,res)=>res.json({success:true,items:[{id:sampleDoc.id,path:sampleDoc.path,kind:'doc',snippet:'Keputusan untuk minggu ini'}]}));
router.get('/api/task-board/preferences',(req,res)=>res.json({success:true,views,viewsToken,drafts:[...taskDrafts.values()]}));
router.post('/api/task-board/views/save',(req,res)=>{if(req.body.token!==viewsToken)return res.status(409).json({success:false,message:'Views changed'});views=req.body.views;viewsToken=randomUUID();res.json({success:true,views,viewsToken});});
router.post('/api/task-board/drafts/save',(req,res)=>{const {key,body,token}=req.body,old=taskDrafts.get(key);if((old?.token||null)!==token)return res.status(409).json({success:false,message:'Draft changed'});const draft={key,body,token:randomUUID(),updatedAt:new Date().toISOString()};taskDrafts.set(key,draft);res.json({success:true,draft});});
router.post('/api/task-board/drafts/discard',(req,res)=>{const {key,token}=req.body;if((taskDrafts.get(key)?.token||null)!==token)return res.status(409).json({success:false,message:'Draft changed'});taskDrafts.delete(key);res.json({success:true});});
router.use('/static/v/fixture', express.static(path.join(root, 'src/frontend/public')));
router.use('/static/editor/4.0.1/dist', express.static(path.join(root, 'node_modules/vditor/dist')));
router.use('/static', express.static(path.join(root, 'src/frontend/public')));
router.get('/fixture/state', (req, res) => res.json(board));
router.post('/fixture/reset', (req, res) => { board = structuredClone(sample); documents = structuredClone(originalDocs); suggestionFailure=false; next = 5; failNext = 0; res.json({ success: true }); });
router.post('/fixture/documents', (req,res) => { documents = req.body.items; res.json({success:true}); });
router.post('/fixture/suggestion-fail', (req,res) => { suggestionFailure=true; res.json({success:true}); });
router.post('/fixture/conflict', (req, res) => { board.revision++; res.json({ success: true }); });
router.post('/fixture/fail-upload', (req,res)=>{failUploadAt=uploadCount+req.body.offset;res.json({success:true});});
router.post('/fixture/fail', (req, res) => { failNext = req.body.status || 500; res.json({ success: true }); });
router.all('/api/auth/status', (req, res) => res.json({ success: true, registered: true }));
router.get('/api/workspace', (req, res) => res.json({ success: true, pages, preferences }));
router.post('/api/preferences', (req, res) => { if (req.body.action === 'theme') preferences.theme = req.body.value; res.json({ success: true, preferences }); });
router.get('/api/task-board/documents', async (req,res) => {
  if(suggestionFailure){ suggestionFailure=false; return res.status(500).json({success:false,message:'Fixture suggestion unavailable'}); }
  const query=String(req.query.q || '').toLowerCase();
  const result=documents.filter(doc=>doc.path.toLowerCase().includes(query));
  await new Promise(resolve=>setTimeout(resolve,query==='slow'?500:20));
  res.json({success:true,items:result});
});
router.get('/api/task-board/documents/:id/open', (req,res) => {
  const doc=documents.find(item=>item.id===req.params.id);
  if(!doc)return res.status(404).json({success:false,message:'Dokumen tidak tersedia'});
  res.redirect(req.baseUrl+doc.path.split('/').map(encodeURIComponent).join('/'));
});
router.post('/fixture/delay-read', (req,res)=>{readDelay=1200;res.json({success:true});});
let readDelay=0;
router.get('/api/task-board', async (req, res) => {
  if (failNext) { const status = failNext; failNext = 0; return res.status(status).json({ success: false, message: 'Fixture read unavailable' }); }
  board.documents = documents; const snapshot=structuredClone(board);const wait=readDelay;readDelay=0;if(wait)await new Promise(resolve=>setTimeout(resolve,wait));res.json({ success: true, board:snapshot });
});
const multipartAttachment=require('multer')({storage:require('multer').memoryStorage(),limits:{fileSize:100*1024*1024,files:1}}).single('file');
const rawAttachment=express.raw({type:'application/octet-stream',limit:100*1024*1024});
function attachmentUpload(req,res,next) {
 if(!req.is('application/octet-stream'))return multipartAttachment(req,res,next);
 rawAttachment(req,res,error=>{
  if(error)return next(error);
  req.file={size:req.body.length};
  req.body={...req.query,filename:decodeURIComponent(req.get('X-Upload-Filename')||'fixture.bin')};
  next();
 });
}
router.post('/api/task-board/attachments/upload',attachmentUpload,async(req,res)=>{
 await new Promise(resolve=>setTimeout(resolve,150));
 if(++uploadCount===failUploadAt)return res.status(500).json({success:false,message:'Fixture partial upload failure'});
 if(failNext){const status=failNext;failNext=0;return res.status(status).json({success:false,message:'Fixture upload unavailable'});}
 if(Number(req.body.revision)!==board.revision)return res.status(409).json({success:false,message:'Papan berubah. Muat ulang.'});
 const task=board.tasks.find(t=>t.id===req.body.taskId);if(!task||task.archivedAt)return res.status(409).json({success:false,message:'Task tidak aktif'});
 task.attachments ||= [];if(task.attachments.length>=10)return res.status(400).json({success:false,message:'Maksimal10'});
 task.attachments.push({id:randomUUID(),filename:req.body.filename,size:req.file.size,createdAt:new Date().toISOString()});board.revision++;res.json({success:true,board});
});
router.post('/api/task-board/attachments/delete',(req,res)=>{
 if(req.body.revision!==board.revision)return res.status(409).json({success:false,message:'Papan berubah. Muat ulang.'});
 const task=board.tasks.find(t=>t.id===req.body.taskId);if(!task||task.archivedAt||req.body.confirm!==true)return res.status(400).json({success:false,message:'Tidak valid'});
 task.attachments=(task.attachments||[]).filter(x=>x.id!==req.body.id);board.revision++;res.json({success:true,board});
});
router.post('/api/task-board/:group/:action', async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 70));
  if (failNext) { const status = failNext; failNext = 0; return res.status(status).json({ success: false, message: 'Fixture write unavailable' }); }
  const body = req.body;
  if (body.revision !== board.revision) return res.status(409).json({ success: false, conflict: true, message: 'Papan sudah berubah di perangkat lain. Muat ulang papan sebelum menyimpan lagi.' });
  let taskId;
  if (req.params.group === 'tasks' && req.params.action === 'save') {
    const existing = board.tasks.find((task) => task.id === body.id);
    if (existing?.archivedAt) return res.status(409).json({success:false, conflict:true, message:'Task archived'});
    const startDate = body.startDate === undefined ? existing?.startDate || '' : body.startDate;
    if (startDate && body.due && startDate > body.due) return res.status(400).json({success:false,message:'Tanggal akhir tidak boleh sebelum tanggal mulai.'});
    taskId = body.id || randomUUID();
    if(body.draftKey)taskDrafts.delete(body.draftKey);
    const task = { checklist:body.checklist||existing?.checklist||[],id: taskId, number: existing?.number || String(next++), title: body.title.trim(), description: body.description.trim(), result: body.result === undefined ? existing?.result || '' : body.result.trim(), startDate, tagIds: body.tagIds === undefined ? existing?.tagIds || [] : body.tagIds, statusId: body.statusId, priority: body.priority, due: body.due };
    if (existing) Object.assign(existing, task); else board.tasks.push(task);
  } else if (req.params.group === 'tasks' && ['archive', 'restore'].includes(req.params.action)) {
    const task = board.tasks.find((task) => task.id === body.id);
    if (!task || (req.params.action === 'archive' && !board.statuses.find((status) => status.id === task.statusId).completed)) return res.status(409).json({success:false, conflict:true, message:'Task must be completed'});
    task.archivedAt = req.params.action === 'archive' ? new Date().toISOString() : null;
    taskId = task.id;
  } else if (req.params.group === 'tasks' && req.params.action === 'delete') board.tasks = board.tasks.filter((task) => task.id !== body.id);
  else if (req.params.group === 'tags') {
    board.tags = body.tags.map(tag => ({...tag, name:tag.name.trim()}));
    board.tasks.forEach(task => { task.tagIds=(task.tagIds||[]).filter(id=>board.tags.some(tag=>tag.id===id)); });
  }
  else if (req.params.group === 'statuses') {
    if (Object.values(body.moves).some(value=>!value)) return res.status(400).json({success:false,message:'Invalid move mapping'});
    board.statuses = body.statuses.map((s, position) => ({ ...s, name: s.name.trim(), position }));
    board.tasks.forEach((task) => { if (body.moves[task.statusId]) task.statusId = body.moves[task.statusId]; });
  }
  board.revision++; board.documents=documents; res.json({ success: true, board, taskId });
});

let sticky={revision:1,notes:[{id:randomUUID(),title:'Ide yang mau dicoba',body:'Satu tempat untuk ide kecil yang belum perlu jadi task.\n\nTulis dulu di sini, susun belakangan.',color:'yellow',x:62,y:62,w:276,h:275},{id:randomUUID(),title:'Untuk meeting berikutnya',body:'Bahas alur approval yang baru.\n\nSiapkan contoh response dan catat keputusan.',color:'sage',x:389,y:128,w:280,h:268},{id:randomUUID(),title:'Jangan kelupaan',body:'Rapikan catatan setelah sesi selesai.',color:'rose',x:733,y:58,w:270,h:255}]};
router.get('/api/sticky-notes',(req,res)=>res.json({success:true,board:sticky}));
router.post('/api/sticky-notes',(req,res)=>{if(req.body.revision!==sticky.revision)return res.status(409).json({success:false,message:'Canvas berubah di perangkat lain.',conflict:true});sticky={notes:req.body.notes,revision:sticky.revision+1};res.json({success:true,board:{revision:sticky.revision}})});

router.get('/', (req, res) => {
  const bootstrap = JSON.stringify({ mode: 'workspace', editorVersion:'4.0.1', basePath: req.baseUrl, current: req.query.page || 'home', pages, preferences, authURL: 'http://127.0.0.1' });
  res.render('layout', { bootstrap, basePath: req.baseUrl, editorVersion: '4.0.1', assetVersion: 'fixture', passkeyBrowserVersion: '14.0.0', frontendAssets: require(path.join(root, 'dist/server/backend/rendering/frontend-assets')).readFrontendAssets(root) });
});
module.exports = { start: (port = 0) => new Promise((resolve) => { const server = app.listen(port, '127.0.0.1', () => resolve({ server, url: 'http://127.0.0.1:' + server.address().port })); }) };

if (require.main === module) module.exports.start(8030).then(({url}) => console.log('Isolated local fixture (in-memory data only): '+url+'/?view=tasks'));
