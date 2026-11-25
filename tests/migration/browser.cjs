const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const data = path.resolve(__dirname, '../../.data');
fs.mkdirSync(data, { recursive: true });
const profile = fs.mkdtempSync(path.join(data, 'board-app-chrome-'));
assert.equal(path.dirname(profile), data);
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--user-data-dir=' + profile, '--remote-debugging-port=0', '--window-size=1440,1000', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket, sequence = 0, fixture, interceptedDrag;
const pending = new Map(), errors = [];
const failPending = error => { for (const request of pending.values()) request.reject(error); pending.clear(); };
chrome.on('error', error => failPending(error));
function call(method, params = {}, sessionId) { return new Promise((resolve, reject) => { if (socket?.readyState !== WebSocket.OPEN) return reject(Error('Chrome connection is closed')); const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId })); }); }
async function evaluate(expression, sessionId) {
  const value = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (value.exceptionDetails) throw Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text);
  return value.result.value;
}
async function shot(name, sessionId) { const result = await call('Page.captureScreenshot', { format: 'png' }, sessionId); fs.writeFileSync(path.join(data, name + '.png'), Buffer.from(result.data, 'base64')); }
async function reloadBoard(sessionId) {
  await evaluate('window.__fixtureReloadPending=true',sessionId);
  await call('Page.reload',{},sessionId);
  for(let i=0;i<100;i++) {
    try { if(await evaluate('!window.__fixtureReloadPending && document.querySelectorAll(".tb-column").length===4',sessionId))return; } catch {}
    await delay(50);
  }
  throw Error('New board document did not finish loading');
}
const checks = require('./browser-checks.cjs').toString();
async function main() {
  fixture = await require('../helpers/local-workspace.cjs').start();
  const activePort = path.join(profile, 'DevToolsActivePort');
  for (let i=0;i<100&&!fs.existsSync(activePort);i++) await delay(50);
  const [port, endpoint] = fs.readFileSync(activePort, 'utf8').trim().split(/\r?\n/);
  socket = new WebSocket('ws://127.0.0.1:' + port + endpoint);
  socket.addEventListener('close', () => failPending(Error('Chrome connection closed')));
  socket.addEventListener('error', () => failPending(Error('Chrome connection failed')));
  await new Promise((resolve,reject) => {socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message', ({data}) => {const value=JSON.parse(data); if(value.method==='Input.dragIntercepted')interceptedDrag=value.params.data; if(value.method==='Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.text); const h=pending.get(value.id);if(!h)return;pending.delete(value.id);value.error?h.reject(Error(value.error.message)):h.resolve(value.result);});
  const {targetId}=await call('Target.createTarget',{url:'about:blank'}), {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
  await call('Page.enable',{},sessionId); await call('Runtime.enable',{},sessionId);
  for (const [prefix,theme] of [['','light'],['/mynotes','dark']]) {
    await fetch(fixture.url+prefix+'/fixture/reset',{method:'POST'});
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},sessionId);
    await call('Page.navigate',{url:fixture.url+prefix+'/?view=tasks'},sessionId);
    for(let i=0;i<100;i++){if(await evaluate('document.querySelectorAll(".tb-card").length===4',sessionId))break;await delay(50);}
    assert.equal(await evaluate('document.querySelectorAll(".tb-card").length',sessionId),4);
    await evaluate(`(() => {const s=document.getElementById('theme-select');s.value='${theme}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`,sessionId); await delay(100);
    await evaluate('document.fonts.ready',sessionId); await shot('task-app-'+theme,sessionId);
    interceptedDrag=null;
    await call('Input.setInterceptDrags',{enabled:true},sessionId);
    const points=await evaluate(`(() => {const a=document.querySelector('.tb-card h2').getBoundingClientRect(), b=document.querySelectorAll('.tb-column')[1].getBoundingClientRect();return {from:{x:a.x+30,y:a.y+10},to:{x:b.x+50,y:b.y+60}};})()`,sessionId);
    await call('Input.dispatchMouseEvent',{type:'mouseMoved',...points.from},sessionId);
    await call('Input.dispatchMouseEvent',{type:'mousePressed',...points.from,button:'left',clickCount:1},sessionId);
    await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:points.from.x+25,y:points.from.y+25,button:'left',buttons:1},sessionId);
    for(let i=0;i<40&&!interceptedDrag;i++)await delay(25);
    assert(interceptedDrag,'Native pointer drag starts from the task button');
    for(const type of ['dragEnter','dragOver','drop']) await call('Input.dispatchDragEvent',{type,...points.to,data:interceptedDrag},sessionId);
    await call('Input.dispatchMouseEvent',{type:'mouseReleased',...points.to,button:'left',clickCount:1},sessionId);await delay(450);
    await call('Input.setInterceptDrags',{enabled:false},sessionId);
    const dragged=await fetch(fixture.url+prefix+'/fixture/state').then(r=>r.json());
    assert.equal(dragged.tasks[0].statusId,dragged.statuses[1].id,'Native pointer drop persists to API');
    await fetch(fixture.url+prefix+'/fixture/reset',{method:'POST'});
    await reloadBoard(sessionId);
    console.log('Native pointer drag/drop passed: '+theme);
    console.log(prefix+': '+await evaluate('('+checks+')('+JSON.stringify(prefix)+')',sessionId));
    await reloadBoard(sessionId); assert.equal(await evaluate('document.querySelectorAll(".tb-column").length',sessionId),4,'Reload restores server board');
    await evaluate('document.querySelector("[data-action=openBoardTask]").click()',sessionId);await delay(400);await shot('task-app-editor-'+theme,sessionId);
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);await delay(400);
    assert.equal(await evaluate('document.getElementById("board-task-dialog").open',sessionId),false);
    for(const width of [390,760,1024]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false},sessionId);
      await delay(250);
      assert.equal(await evaluate('document.documentElement.scrollWidth>document.documentElement.clientWidth',sessionId),false,'Overflow '+width);
      if(width===390){await shot('task-app-mobile-'+theme,sessionId);await evaluate('document.querySelector("[data-action=openBoardStatuses]").click()',sessionId);await delay(400);await shot('task-app-status-mobile-'+theme,sessionId);assert.equal(await evaluate('document.getElementById("board-status-dialog").scrollWidth>document.getElementById("board-status-dialog").clientWidth',sessionId),false);await evaluate('document.querySelector("[data-action=closeTaskBoardDialog][data-arg=board-status-dialog]").click()',sessionId);await delay(50);}
    }
  }
  for (const prefix of ['', '/mynotes']) {
    await call('Page.navigate', { url: fixture.url + prefix + '/fixture/public' }, sessionId);
    for (let i = 0; i < 100; i++) { if (await evaluate('!!document.querySelector("#public-outline a")', sessionId)) break; await delay(50); }
    assert.equal(await evaluate('!!document.querySelector("#public-outline a") && !document.querySelector(".public-document [contenteditable=true]")', sessionId), true, 'Read-only public page and outline');
    await call('Page.navigate', { url: fixture.url + prefix + '/fixture/login' }, sessionId);
    for (let i = 0; i < 100; i++) { if (await evaluate('!!document.querySelector(".auth-card .login-form")', sessionId)) break; await delay(50); }
    assert.equal(await evaluate('!!document.querySelector(".auth-card .login-form")', sessionId), true, 'Passkey login shell');
  }
  assert.deepEqual(errors,[],'No unhandled browser exceptions');
  console.log('Actual EJS shell/main.js, both mounts, server reload persistence, Escape, responsive desktop/mobile and both themes passed.');
  await call('Target.closeTarget',{targetId});
}
const deadline=setTimeout(()=>{console.error('Local UI checks timed out');chrome.kill();failPending(Error('Local UI checks timed out'));process.exitCode=1;},120000);
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{clearTimeout(deadline);socket?.close();chrome.kill();if(fixture){fixture.server.closeAllConnections();await new Promise(resolve=>fixture.server.close(resolve));}await delay(600);assert.equal(path.dirname(fs.realpathSync(profile)),fs.realpathSync(data));fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});});
