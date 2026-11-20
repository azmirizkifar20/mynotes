let documentBuffer = null, liveEditor = null, liveEditorReady = false, liveEditorTouched = false, liveEditorGeneration = 0;

function documentContent() {
  if (documentBuffer?.id === current && liveEditorReady && liveEditorTouched && !editing) documentBuffer.content = liveEditor.getValue();
  return documentBuffer?.id === current ? documentBuffer.content : pages.find(page => page.id === current)?.body || '';
}
function changeDocumentContent(content) {
  if (documentBuffer?.id !== current || saving) return;
  documentBuffer.content = content;
  scheduleDraft(); syncDocumentSave();
}
function syncDocumentSave() {
  const button = $('save-document');
  if (button) button.disabled = saving || !isDirty() || !draftState?.resolved || draftState.conflict;
}
function syncEditorLock() {
  const enabled = !saving && draftState?.id === current && draftState.resolved && !draftState.conflict;
  if (liveEditorReady) enabled ? liveEditor.enable() : liveEditor.disabled();
  if ($('markdown-editor')) $('markdown-editor').readOnly = !enabled;
  syncDocumentSave();
}
function destroyLiveEditor() {
  liveEditorGeneration++;
  if (liveEditorReady) liveEditor.destroy();
  liveEditor = null; liveEditorReady = false; liveEditorTouched = false;
}
function mountLiveEditor(page) {
  const element = $('live-editor');
  if (!element) return;
  if (typeof Vditor === 'undefined') {
    element.setAttribute('aria-busy', 'false');
    notify('Editor langsung belum dapat dimuat. Gunakan tab Markdown.'); return;
  }
  const generation = liveEditorGeneration;
  let instance;
  try {
    instance = new Vditor(element, {
      cdn: appUrl('/static/editor/' + boot.editorVersion),
      lang: 'en_US', mode: 'ir', value: documentContent(),
      theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'classic',
      cache: { enable: false }, toolbar: [], toolbarConfig: { hide: true },
      minHeight: 250, height: 'auto', placeholder: 'Tulis catatan di sini…',
      preview: { markdown: { sanitize: true, autoSpace: false, fixTermTypo: false }, hljs: { enable: false }, render: { media: { enable: false } }, maxWidth: 100000 },
      input: content => {
        if (generation !== liveEditorGeneration || !liveEditorReady || !liveEditorTouched || !draftState?.resolved || draftState.conflict) return;
        changeDocumentContent(content);
        queueMicrotask(refreshLiveOutline);
      },
      after: () => queueMicrotask(() => {
        if (generation !== liveEditorGeneration || current !== page.id || editing) { instance.destroy(); return; }
        liveEditorReady = true; element.setAttribute('aria-busy', 'false');
        syncEditorLock(); refreshLiveOutline(); scrollToHash();
      })
    });
    liveEditor = instance;
    element.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && ['b', 'i', 'z', 'y'].includes(event.key.toLowerCase())) liveEditorTouched = true;
    });
    for (const event of ['input', 'change']) element.addEventListener(event, () => {
      if (generation !== liveEditorGeneration || !liveEditorReady || saving || !draftState?.resolved || draftState.conflict) return;
      liveEditorTouched = true;
      changeDocumentContent(instance.getValue());
    });
  } catch {
    element.innerHTML = '<article class="prose">' + (page.html || '') + '</article>';
    element.setAttribute('aria-busy', 'false');
    notify('Editor langsung belum dapat dimuat. Gunakan tab Markdown.');
  }
}
function refreshLiveOutline() {
  if (!liveEditorReady || !$('live-editor')) return;
  $('outline').innerHTML = '<div class="outline-title">DI HALAMAN INI</div>';
  const slugs = new Set();
  $('live-editor').querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(heading => {
    const text = heading.textContent.replace(/^#+\s*/, '');
    const base = text.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
    let slug = base, count = 1;
    while (slugs.has(slug)) slug = base + '-' + count++;
    slugs.add(slug);
    const link = document.createElement('a'); link.href = '#' + slug; link.textContent = text;
    link.addEventListener('click', event => {
      event.preventDefault(); heading.scrollIntoView();
      history.replaceState(history.state, '', location.pathname + location.search + '#' + slug);
    });
    $('outline').append(link);
  });
}
