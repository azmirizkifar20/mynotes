import { view } from "./view.js";

export function createFeature({ state, actions }) {
  let root, listeners, notes = [], revision = 0, selected = null, menuId = null, menuAnchor = null;
  let zoom = 1, pan = false, z = 1, pointer = null, undoState = null, initialized = false;
  let toastTimer, saveTimer, editVersion = 0, failure = false, conflict = false, loading = false;
  const $ = (id) => root?.querySelector('[id="sn-' + id + '"]');
  const esc = actions.escape, icon = actions.icon;
  const on = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: listeners.signal });
    const palette = [
      {id:'yellow',name:'Kuning',hex:'#fff0bb'}, {id:'sage',name:'Sage',hex:'#deecd9'},
      {id:'rose',name:'Rose',hex:'#f6dfe1'}, {id:'blue',name:'Biru',hex:'#dceaf7'},
      {id:'lilac',name:'Lilac',hex:'#e9e1f3'}, {id:'stone',name:'Stone',hex:'#eeece5'}
    ];

  function notify(message, undo = null) {
    clearTimeout(toastTimer); undoState = undo;
    $('toast-message').textContent = message; $('undo').hidden = !undo;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { if ($('toast')) $('toast').hidden = true; undoState = null; }, undo ? 10000 : 3500);
  }
  function saveStatus(message) {
    if (!$('save-status')) return;
    $('save-status').textContent = message;
    $('save-recovery').hidden = !failure;
    $('save-recovery').querySelector('[data-sticky-action=retry]').hidden = conflict;
  }
  function markDirty() {
    state.stickyDirty = true; editVersion++;
    if (!failure) saveStatus('Belum tersimpan…');
  }
  function queueSave() {
    markDirty(); clearTimeout(saveTimer);
    if (!failure) saveTimer = setTimeout(flush, 800);
  }
  const persist = queueSave;
  async function flush() {
    clearTimeout(saveTimer);
    if (!initialized || !state.stickyDirty || state.stickySaving || loading || conflict) return;
    const version = editVersion;
    state.stickySaving = true; saveStatus('Menyimpan…');
    try {
      const data = await actions.api('sticky-notes', { revision, notes });
      revision = data.board.revision;
      failure = false; conflict = false;
      state.stickyDirty = version !== editVersion;
      saveStatus(state.stickyDirty ? 'Belum tersimpan…' : 'Semua perubahan tersimpan');
    } catch (error) {
      failure = true; conflict = error.status === 409;
      saveStatus(error.message + ' Perubahanmu masih ada di halaman ini.');
    } finally {
      state.stickySaving = false;
      if (state.stickyDirty && !failure) saveTimer = setTimeout(flush, 100);
    }
  }
  function download() {
    const blob = new Blob([JSON.stringify({ app: 'Ruangku', notes }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'ruangku-sticky-notes.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function load(force = false) {
    if (loading || state.stickySaving || !root?.isConnected) return;
    if (force && state.stickyDirty && !confirm('Ganti perubahan yang belum tersimpan dengan versi server? Unduh salinan terlebih dahulu bila masih dibutuhkan.')) return;
    if (!force && (state.stickyDirty || pointer || menuId || root.querySelector('input:focus,textarea:focus') || $('help-dialog').open)) return;
    const currentRoot = root;
    const version = editVersion;
    if (force) clearTimeout(saveTimer);
    loading = true;
    try {
      const data = await actions.api('sticky-notes');
      if (!currentRoot.isConnected || root !== currentRoot || version !== editVersion || (!force && state.stickyDirty)) return;
      if (!initialized || data.board.revision !== revision || force) {
        notes = data.board.notes; revision = data.board.revision; initialized = true;
        state.stickyDirty = false; failure = false; conflict = false;
        undoState = null; clearTimeout(toastTimer); $('toast').hidden = true;
        render(); scale(zoom, false); saveStatus('Semua perubahan tersimpan');
        if (data.board.notes.length && !selected) fit();
      }
    } catch (error) {
      if (currentRoot.isConnected && root === currentRoot) {
        if (!initialized) status('error');
        saveStatus(error.message);
      }
    } finally {
      loading = false;
      if (root === currentRoot && state.stickyDirty && !failure) saveTimer = setTimeout(flush, 100);
    }
  }
    function updateCount() {
      const query = $('search').value.trim().toLocaleLowerCase();
      let matches = 0;
      for (const note of notes) {
        const match = !query || `${note.title} ${note.body}`.toLocaleLowerCase().includes(query);
        $('note-'+note.id)?.classList.toggle('matches',match); if(match) matches++;
      }
      $('board').classList.toggle('filtering',!!query);
      $('count').textContent = query ? `${matches} dari ${notes.length} catatan` : `${notes.length} catatan`;
      if (!notes.length) status('empty');
      else if (!matches) status('no-match');
      else $('canvas-status').hidden = true;
      $('canvas-hint').hidden = !matches;
    }
    function status(kind) {
      const states = {
        empty: [icon('note'),'Canvas masih kosong','Mulai dengan satu ide. Catatan bisa dipindahkan dan diganti warnanya.','add','Catatan baru'],
        'no-match': [icon('search'),'Catatan tidak ditemukan','Coba kata lain atau hapus pencarian untuk melihat seluruh canvas.','clear-search','Hapus pencarian'],
        error: [icon('note'),'Canvas belum dapat dibuka','Periksa koneksi lalu coba muat kembali.','reload','Coba lagi'],
      };
      const [symbol,title,body,action,label] = states[kind];
      $('canvas-status').innerHTML = `<div>${symbol}<h2>${title}</h2><p>${body}</p><button class="button primary" data-sticky-action="${action}">${label}</button></div>`;
      $('canvas-status').hidden = false;
    }
    function render(freshId) {
      closeMenu(false);
      $('board').innerHTML = notes.map(note => `<article class="sticky ${note.id===freshId?'new':''}" id="sn-note-${esc(note.id)}" data-id="${esc(note.id)}" data-color="${esc(note.color)}" aria-label="${esc(note.title || 'Catatan tanpa judul')}" style="left:${note.x}px;top:${note.y}px;width:${note.w}px;height:${note.h}px"><header class="sticky-header"><button class="drag-handle" data-sticky-action="drag" title="Drag untuk memindahkan, atau gunakan tombol panah" aria-label="Pindahkan ${esc(note.title || 'catatan')}">${icon('grip')}<span>Catatan</span></button><button class="note-more" data-sticky-action="note-menu" aria-label="Opsi ${esc(note.title || 'catatan')}" aria-expanded="false" aria-controls="sn-note-menu">${icon('more')}</button></header><input class="note-title" data-field="title" aria-label="Judul catatan" placeholder="Tanpa judul" maxlength="120" value="${esc(note.title)}"><textarea class="note-body" data-field="body" aria-label="Isi catatan" placeholder="Tulis sesuatu…" maxlength="10000" spellcheck="false">${esc(note.body)}</textarea><footer class="note-footer"><button class="color-trigger" data-sticky-action="note-menu" aria-label="Ganti warna ${esc(note.title || 'catatan')}" aria-expanded="false" aria-controls="sn-note-menu"><span class="color-chip" aria-hidden="true"></span><span>Warna</span></button><time>Catatan pribadi</time></footer><button class="resize-handle" data-sticky-action="resize" aria-label="Ubah ukuran catatan dengan tombol panah" title="Tarik untuk mengubah ukuran">${icon('resize')}</button></article>`).join('');
      if(selected) select(selected); updateCount();
    }
    function select(id) {
      selected = id;
      for(const element of $('board').children) element.classList.toggle('selected',element.dataset.id===id);
      const element=$('note-'+id); if(element) element.style.zIndex=++z;
    }
    function closeMenu(focus = true) {
      if(menuAnchor) menuAnchor.setAttribute('aria-expanded','false');
      $('note-menu').hidden = true; menuId=null;
      if(focus && menuAnchor?.isConnected) menuAnchor.focus();
      menuAnchor=null;
    }
    function openMenu(id, anchor) {
      if(menuId===id && menuAnchor===anchor) return closeMenu();
      closeMenu(false); menuId=id; menuAnchor=anchor; select(id);
      const note=notes.find(n=>n.id===id); if(!note) return;
      anchor.setAttribute('aria-expanded','true');
      $('note-menu').innerHTML = `<div class="menu-heading">Warna catatan<button data-sticky-action="menu-close" aria-label="Tutup pilihan warna">${icon('close')}</button></div><div class="color-options" aria-label="Pilihan warna">${palette.map(color=>`<button class="color-option" data-sticky-action="color" data-color="${color.id}" aria-pressed="${note.color===color.id}" aria-label="${color.name}"><span class="color-dot" style="background:${color.hex}">${note.color===color.id?icon('check'):''}</span>${color.name}</button>`).join('')}</div><div class="menu-divider"></div><button class="menu-action" data-sticky-action="duplicate">${icon('copy')}Duplikat catatan</button><button class="menu-action danger" data-sticky-action="delete">${icon('trash')}Hapus catatan</button>`;
      $('note-menu').hidden=false;
      const rect=anchor.getBoundingClientRect(), menu=$('note-menu');
      menu.style.left=Math.max(12,Math.min(rect.left,innerWidth-menu.offsetWidth-12))+'px';
      const top=rect.bottom+8+menu.offsetHeight<=innerHeight-12 ? rect.bottom+8 : rect.top-menu.offsetHeight-8;
      menu.style.top=Math.max(12,Math.min(top,innerHeight-menu.offsetHeight-12))+'px';
      menu.querySelector('.color-option[aria-pressed=true]').focus();
    }
    function ensureVisible(note) {
      const view=$('canvas');
      view.scrollTo({left:Math.max(0,note.x*zoom-40),top:Math.max(0,note.y*zoom-40),behavior:'auto'});
    }
    function add(copy) {
      if(!initialized) return;
      if(notes.length>=100) return notify('Maksimal 100 catatan dalam satu canvas.');
      closeMenu(false); $('search').value='';
      const view=$('canvas'), offset=(notes.length%3)*22;
      const note=copy ? {...copy,id:crypto.randomUUID(),x:Math.min(2300-copy.w,copy.x+36),y:Math.min(1550-copy.h,copy.y+36),updated:true} : {id:crypto.randomUUID(),title:'',body:'',color:'yellow',x:Math.max(0,Math.min(2020,Math.round(view.scrollLeft/zoom+65+offset))),y:Math.max(0,Math.min(1290,Math.round(view.scrollTop/zoom+55+offset))),w:280,h:260,updated:true};
      notes.push(note); selected=note.id; render(note.id); ensureVisible(note); persist();
      $('note-'+note.id).querySelector('.note-title').focus({preventScroll:true});
    }
    function scale(value, center=true) {
      const view=$('canvas'), previous=zoom;
      const cx=(view.scrollLeft+view.clientWidth/2)/previous, cy=(view.scrollTop+view.clientHeight/2)/previous;
      zoom=Math.max(.1,Math.min(1.5,value));
      $('board').style.transform=`scale(${zoom})`;
      $('canvas-space').style.width=2300*zoom+'px'; $('canvas-space').style.height=1550*zoom+'px';
      $('zoom-value').textContent=Math.round(zoom*100)+'%';
      root.querySelector('[data-sticky-action=zoom-out]').disabled=zoom<=.1;
      root.querySelector('[data-sticky-action=zoom-in]').disabled=zoom>=1.5;
      if(center){view.scrollLeft=cx*zoom-view.clientWidth/2;view.scrollTop=cy*zoom-view.clientHeight/2;}
      closeMenu(false);
    }
    function fit() {
      const query=$('search').value.trim().toLocaleLowerCase();
      const visible=notes.filter(n=>!query || `${n.title} ${n.body}`.toLocaleLowerCase().includes(query));
      if(!visible.length) return scale(1);
      const minX=Math.min(...visible.map(n=>n.x)), minY=Math.min(...visible.map(n=>n.y));
      const maxX=Math.max(...visible.map(n=>n.x+n.w)), maxY=Math.max(...visible.map(n=>n.y+n.h));
      scale(Math.min(1,($('canvas').clientWidth-70)/(maxX-minX),($('canvas').clientHeight-100)/(maxY-minY)),false);
      $('canvas').scrollTo({left:Math.max(0,minX*zoom-35),top:Math.max(0,minY*zoom-35),behavior:'auto'});
    }
    function setMode(value) {
      pan=value; $('canvas').classList.toggle('pan-mode',pan);
      root.querySelector('[data-sticky-action=mode-pan]').setAttribute('aria-pressed',String(pan));
      root.querySelector('[data-sticky-action=mode-select]').setAttribute('aria-pressed',String(!pan));
      $('canvas-hint').querySelector('span').textContent=pan?'Drag ruang kosong untuk menjelajahi canvas':'Geser dari pegangan · Klik isi untuk menulis';
      closeMenu(false);
    }

  const handlers = {
    add: () => add(), 'note-menu': (button) => openMenu(button.closest('.sticky').dataset.id, button),
    'menu-close': () => closeMenu(),
    color: (button) => {
      const note = notes.find(n => n.id === menuId); if (!note) return;
      note.color = button.dataset.color; const id = note.id;
      closeMenu(false); render(); persist(); $('note-' + id).querySelector('.color-trigger').focus({ preventScroll: true });
    },
    duplicate: () => { const note = notes.find(n => n.id === menuId); if (note) add(note); },
    delete: () => {
      const index = notes.findIndex(n => n.id === menuId); if (index < 0) return;
      const note = notes[index]; notes.splice(index, 1); closeMenu(false); selected = null;
      render(); persist(); $('canvas').focus({ preventScroll: true });
      notify('Catatan dihapus.', () => {
        if (notes.length >= 100) return notify('Canvas penuh. Hapus satu catatan sebelum memulihkan.');
        notes.splice(Math.min(index, notes.length), 0, note); selected = note.id;
        $('search').value = ''; render(); ensureVisible(note); persist();
        $('note-' + note.id).querySelector('.drag-handle').focus({ preventScroll: true });
      });
    },
    undo: () => { const work = undoState; undoState = null; $('toast').hidden = true; if (work) work(); },
    'zoom-in': () => scale(zoom + .1), 'zoom-out': () => scale(zoom - .1), 'zoom-reset': () => scale(1), fit,
    'mode-pan': () => setMode(true), 'mode-select': () => setMode(false),
    arrange: () => {
      if (!notes.length || !initialized) return;
      const previous = notes.map(n => ({ id: n.id, x: n.x, y: n.y }));
      let x = 60, y = 60, row = 0;
      for (const note of notes) {
        if (x + note.w > 2240) { x = 60; y += row + 34; row = 0; }
        if (y + note.h > 1500) { notify('Canvas penuh. Sebagian catatan tetap di posisi awal.'); break; }
        note.x = x; note.y = y; x += note.w + 34; row = Math.max(row, note.h);
      }
      render(); fit(); persist();
      notify('Posisi catatan dirapikan.', () => {
        for (const p of previous) { const n = notes.find(n => n.id === p.id); if (n) { n.x = p.x; n.y = p.y; } }
        render(); fit(); persist();
      });
    },
    help: () => $('help-dialog').showModal(), 'dialog-close': (button) => button.closest('dialog').close(),
    'clear-search': () => { $('search').value = ''; updateCount(); $('search').focus(); },
    retry: () => { failure = false; return flush(); }, download, reload: () => load(true),
  };

  function bind() {
    on(root, 'click', event => {
      const button = event.target.closest('[data-sticky-action]');
      if (button && !button.disabled && handlers[button.dataset.stickyAction]) {
        event.preventDefault(); handlers[button.dataset.stickyAction](button);
      }
    });
    on(root, 'pointerdown',event=>{
      if(!$('note-menu').hidden && !$('note-menu').contains(event.target) && !event.target.closest('[data-sticky-action=note-menu]'))closeMenu(false);
      const noteElement=event.target.closest('.sticky');
      if(noteElement)select(noteElement.dataset.id);
      const handle=event.target.closest('[data-sticky-action=drag],[data-sticky-action=resize]');
      if(handle && event.button===0){
        const note=notes.find(n=>n.id===noteElement.dataset.id);event.preventDefault();closeMenu(false);handle.focus({preventScroll:true});
        markDirty();pointer={type:handle.dataset.stickyAction,note,element:noteElement,target:handle,id:event.pointerId,sx:event.clientX,sy:event.clientY,x:note.x,y:note.y,w:note.w,h:note.h};handle.setPointerCapture(event.pointerId);noteElement.classList.add('dragging');
      }else if(pan && event.button===0 && event.target.closest('#sn-canvas') && !noteElement){
        event.preventDefault();pointer={type:'pan',target:$('canvas'),id:event.pointerId,sx:event.clientX,sy:event.clientY,x:$('canvas').scrollLeft,y:$('canvas').scrollTop};$('canvas').setPointerCapture(event.pointerId);$('canvas').classList.add('panning');
      }else if(!noteElement && event.target.closest('#sn-canvas')){selected=null;for(const n of $('board').children)n.classList.remove('selected');}
    });
    on(root, 'pointermove',event=>{
      if(!pointer || event.pointerId!==pointer.id)return;
      const dx=event.clientX-pointer.sx,dy=event.clientY-pointer.sy,p=pointer;
      if(p.type==='pan'){$('canvas').scrollLeft=p.x-dx;$('canvas').scrollTop=p.y-dy;return;}
      if(p.type==='drag'){
        p.note.x=Math.max(0,Math.min(2300-p.note.w,Math.round(p.x+dx/zoom)));p.note.y=Math.max(0,Math.min(1550-p.note.h,Math.round(p.y+dy/zoom)));
        p.element.style.left=p.note.x+'px';p.element.style.top=p.note.y+'px';
      }else{
        p.note.w=Math.max(240,Math.min(700,2300-p.note.x,Math.round(p.w+dx/zoom)));p.note.h=Math.max(210,Math.min(800,1550-p.note.y,Math.round(p.h+dy/zoom)));
        p.element.style.width=p.note.w+'px';p.element.style.height=p.note.h+'px';
      }
    });
    function finishPointer(event){if(!pointer || event.pointerId!==pointer.id)return;const p=pointer;pointer=null;p.element?.classList.remove('dragging');$('canvas').classList.remove('panning');if(p.target.hasPointerCapture(event.pointerId))p.target.releasePointerCapture(event.pointerId);if(p.type!=='pan')persist();}
    for(const type of ['pointerup','pointercancel','lostpointercapture'])on(root, type,finishPointer);
    on($('board'), 'input',event=>{const field=event.target.dataset.field;if(!field)return;const note=notes.find(n=>n.id===event.target.closest('.sticky').dataset.id);if(!note)return;note[field]=event.target.value;note.updated=true;event.target.closest('.sticky').querySelector('time').textContent='Diubah hari ini';event.target.closest('.sticky').setAttribute('aria-label',note.title||'Catatan tanpa judul');queueSave();});
    on($('search'), 'input',()=>{closeMenu(false);updateCount();const query=$('search').value.trim().toLocaleLowerCase();const match=notes.find(n=>`${n.title} ${n.body}`.toLocaleLowerCase().includes(query));if(query && match)ensureVisible(match);});
    on(root, 'keydown',event=>{
      if(event.key==='Escape'){
        if(!$('note-menu').hidden){event.preventDefault();closeMenu();}
      }
      if(!$('note-menu').hidden && $('note-menu').contains(event.target)){
        const buttons=[...$('note-menu').querySelectorAll('button')];let index=buttons.indexOf(event.target);
        if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End','Tab'].includes(event.key)){
          event.preventDefault();index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(['ArrowUp','ArrowLeft'].includes(event.key)||event.shiftKey?-1:1)+buttons.length)%buttons.length;buttons[index].focus();
        }
      }
      const handle=event.target.closest('[data-sticky-action=drag],[data-sticky-action=resize]');
      if(handle && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){
        event.preventDefault();const note=notes.find(n=>n.id===handle.closest('.sticky').dataset.id),step=event.shiftKey?30:10;
        const dx=event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0,dy=event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0;
        if(handle.dataset.stickyAction==='drag'){note.x=Math.max(0,Math.min(2300-note.w,note.x+dx));note.y=Math.max(0,Math.min(1550-note.h,note.y+dy));}
        else{note.w=Math.max(240,Math.min(700,2300-note.x,note.w+dx));note.h=Math.max(210,Math.min(800,1550-note.y,note.h+dy));}
        const element=handle.closest('.sticky');Object.assign(element.style,{left:note.x+'px',top:note.y+'px',width:note.w+'px',height:note.h+'px'});persist();
      }
    });

    on($('canvas'), 'scroll', () => closeMenu(false), { passive: true });
    on(window, 'resize', () => closeMenu(false));
    on(document, 'pointerdown', event => { if (!root.contains(event.target)) closeMenu(false); });
    on(root, 'focusout', () => { if (state.stickyDirty) flush(); });
    on(root, 'keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); flush(); }
    });
    on(document, 'visibilitychange', () => { if (document.hidden) flush(); });
  }
  function destroyStickyNotes() {
    listeners?.abort(); clearTimeout(saveTimer); clearTimeout(toastTimer);
    root = null; loading = false;
  }
  async function renderStickyNotes() {
    destroyStickyNotes();
    notes = []; revision = 0; initialized = false; selected = null; menuId = null; menuAnchor = null;
    pointer = null; zoom = 1; pan = false; failure = false; conflict = false; undoState = null;
    state.stickyDirty = false; state.stickySaving = false;
    actions.$('outline').innerHTML = '';
    actions.$('main').innerHTML = '<section class="sticky-page" aria-label="Sticky notes">' + view + '</section>';
    root = actions.$('main').querySelector('.sticky-page'); listeners = new AbortController();
    bind(); await load(true);
  }
  return { renderStickyNotes, destroyStickyNotes, refreshStickyNotes: () => load() };
}
