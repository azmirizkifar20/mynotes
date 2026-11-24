const assert = require('node:assert/strict');
const { loadFrontend } = require('./helpers/frontend.cjs');

(async () => {
  const { editor } = await loadFrontend({ editor: 'features/task-board/mention-editor.js' });
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', value: '', textContent: '', childNodes: [], attributes: {}, dataset:{placeholder:'Write Markdown'}, handlers:{},querySelectorAll:()=>[],querySelector:()=>null,addEventListener(type,fn){this.handlers[type]=fn;},getAttribute(name){return this.attributes[name]||'';},setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; } });
    return elements.get(id);
  };
  const actions = { $, escape: value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])), appUrl: p => '/mynotes' + p };
  const state = { taskBoardDirty: false };
  const description = editor.createFeature({ state, actions });
  const result = editor.createFeature({ state, actions }, 'result');
  const doc = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', path: '/result.md' };
  description.load('Plan remains intact');
  const text = '@[result.md](doc:' + doc.id + ') https://example.test/?a=1&b=2#result';
  result.load(text, [doc]);
  assert.equal($('board-task-description').value, 'Plan remains intact');
  assert.equal($('board-task-result').value, text);
  assert($('board-task-result-editor').innerHTML.includes('class="tb-mention"'));
  assert($('board-task-result-editor').innerHTML.includes('class="tb-description-link"'));
  assert($('board-result-mention-menu').hidden);
  result.busy(false, true);
  assert.equal($('board-task-result-editor').attributes.contenteditable, 'false');
  assert.equal($('board-task-result-editor').attributes['aria-readonly'], 'true');
  result.busy(true);
  assert.equal($('board-task-result-editor').attributes['aria-disabled'], 'true');
  result.busy(false);
  assert.equal($('board-task-result-editor').attributes.contenteditable, 'true');
  $('board-task-result-editor').childNodes = [{ nodeType: 3, nodeValue: 'x'.repeat(3001) }];
  assert.equal(result.sync(), false); assert($('board-result-error').textContent.includes('3.000'));
  assert.equal($('board-description-error').textContent, '', 'Result validation does not affect description');
  result.load(text,[doc]);
  global.document={documentElement:{dataset:{theme:'dark'}},createElement:()=>({innerHTML:'',children:[]})};
  global.window={getSelection:()=>({toString:()=>''})};
  state.boot={editorVersion:'4.0.1'};
  const instances=[];
  global.Vditor=class {
    constructor(element,options){this.options=options;this.value=options.value;this.vditor={lute:{Md2VditorIRDOM:value=>value}};this.pre={attributes:{},setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];}};element.querySelector=()=>this.pre;instances.push(this);options.after();}
    setValue(value){this.value=value;} getValue(){return this.value;} setTheme(value){this.theme=value;}
    disabled(){this.disabledState=true;} enable(){this.disabledState=false;}
    updateValue(text){this.value=text;this.insertions=(this.insertions||0)+1;}
  };
  const rich=editor.createFeature({state,actions});rich.bind();
  const markdown='## Plan\n\n**bold** and *italic*\n\n1. First\n2. Second\n\n'+text;
  rich.load(markdown,[doc]);rich.load(markdown+' latest',[doc]);rich.busy(false,true);
  assert.equal($('board-task-description').value,markdown+' latest');
  await Promise.resolve();const live=instances[0];
  assert.equal(live.options.mode,'ir');assert.equal(live.options.cache.enable,false);assert.equal(live.options.preview.markdown.sanitize,true);assert(live.options.toolbar.includes('bold'));
  assert.equal(live.getValue(),markdown+' latest','Latest load wins while editor assets are loading');assert(live.disabledState,'Read-only applies after asynchronous setup');
  live.value='Unexpected readonly mutation';$('board-task-description-editor').handlers.input({isComposing:false});assert.equal($('board-task-description').value,markdown+' latest');
  rich.busy(false);assert.equal(live.disabledState,false);
  live.value='**Changed**\n\n'+text;
  $('board-task-description-editor').handlers.input({isComposing:false});
  assert.equal($('board-task-description').value,live.value);assert.equal($('board-task-result').value,text,'Markdown edits stay scoped to their field');
  const paste={preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},clipboardData:{getData:()=>'*Pasted*'}};
  live.pre.isContentEditable=true;$('board-task-description-editor').handlers.paste(paste);
  assert(paste.prevented&&paste.stopped);assert.equal(live.insertions,1,'One insertion prevents the native editor pasting a second copy');assert.equal($('board-task-description').value,'*Pasted*');
  live.value='x'.repeat(3001);$('board-task-description-editor').handlers.input({isComposing:false});assert.equal(rich.sync(),false);assert($('board-description-error').textContent.includes('3.000'));
  rich.load('Original plain text');assert.equal(live.theme,'dark');assert(rich.sync());assert.equal($('board-task-description').value,'Original plain text','An untouched field keeps its original source');
  const { events } = await loadFrontend({events:'core/events.js'});
  const listeners={};document.addEventListener=(name,handler)=>listeners[name]=handler;
  let dispatched=0;events.bindActions({state:{},actions:{logout:()=>dispatched++,notify:assert.fail}});
  const injected={dataset:{action:'logout'},closest:selector=>selector.includes('.tb-description-editor')?{}:null};
  listeners.click({target:{closest:()=>injected},preventDefault(){}});await Promise.resolve();assert.equal(dispatched,0,'Task Markdown HTML must never dispatch application actions');
  console.log('Task Markdown editors passed: rendering configuration, async loading, source preservation, independent fields, paste, validation and archive/busy locks.');
})().catch(error => { console.error(error); process.exitCode = 1; });
