let draftState = null, draftTimer, draftRequest = null, toolBusy = false, searchSequence = 0, searchTimer;
let availableTemplates = [], selectedVersion = null;

function applyPreferences(preferences = {}) {
  recent = (preferences.recent || []).filter(id => pages.some(page => page.id === id));
  favorites.clear(); (preferences.favorites || []).forEach(id => favorites.add(id));
  if (preferences.theme && preferences.theme !== themePreference) setTheme(preferences.theme, false);
  renderFavorites(); syncFavorite();
}
async function savePreference(body) {
  try { applyPreferences((await api('preferences', body)).preferences); }
  catch (error) { notify('Preferensi belum tersimpan: ' + error.message); }
}
async function setFavorite(id, value) {
  try {
    applyPreferences((await api('preferences', { action: 'favorite', id, value })).preferences);
    $('favorite-button').focus({ preventScroll: true });
  } catch (error) { notify(error.message); }
}
function tool(title, content) {
  $('tool-title').textContent = title;
  $('tool-body').innerHTML = content;
  $('tool-error').textContent = '';
  if (!$('tool-dialog').open) $('tool-dialog').showModal();
}
async function toolAction(work, after) {
  if (toolBusy) return;
  toolBusy = true; $('tool-error').textContent = '';
  $('tool-dialog').querySelectorAll('button,input,select,textarea').forEach(control => control.disabled = true);
  try {
    const result = await work();
    if (after) await after(result);
  } catch (error) { $('tool-error').textContent = error.message; }
  finally {
    toolBusy = false;
    $('tool-dialog').querySelectorAll('button,input,select,textarea').forEach(control => control.disabled = false);
    $('version-content')?.setAttribute('readonly', '');
  }
}
async function updateAfterMutation(message) {
  $('tool-dialog').close(); notify(message);
  try {
    editing = false; draftState = null; await refreshWorkspace();
    await navigate(pages.some(page => page.id === current) ? current : 'home', 'replace', true);
  } catch { notify(message + ' Muat ulang halaman untuk memperbarui daftar.'); }
}
async function openTrash() {
  if (!canLeave()) return;
  tool('Sampah', '<p role="status">Memuat sampah…</p>');
  try {
    const data = await api('trash');
    tool('Sampah', '<p class="edit-hint">File di sini tidak dapat dibuka melalui link publik. Pulihkan untuk mengembalikannya.</p>' +
      (data.items.map(item => `<section class="tool-row"><div><strong>${escape(item.path.split('/').pop())}</strong><small>docs${escape(item.path)} · ${escape(dateLabel(item.deleted_at))}</small></div><div class="tool-actions"><button class="small-button" onclick="restoreTrashed('${item.id}')">Pulihkan</button><button class="small-button danger" onclick="confirmPurge('${item.id}')">Hapus permanen</button></div></section>`).join('') || '<p class="empty">Sampah kosong.</p>'));
  } catch (error) { $('tool-error').textContent = error.message; }
}
function restoreTrashed(id) {
  toolAction(() => api('trash/restore', { id }), () => updateAfterMutation('Item berhasil dipulihkan.'));
}
function confirmPurge(id) {
  tool('Hapus permanen?', '<p>Isi file, riwayat versi, dan draft item ini akan dihapus. Tindakan ini tidak dapat dibatalkan.</p><div class="tool-actions"><button class="small-button" onclick="openTrash()" autofocus>Batal</button><button class="small-button destructive" onclick="purgeTrashed(\'' + id + '\')">Hapus permanen</button></div>');
}
function purgeTrashed(id) {
  toolAction(() => api('trash/purge', { id, confirm: true }), () => updateAfterMutation('Item dihapus permanen.'));
}
async function openActivity() {
  tool('Aktivitas workspace', '<p role="status">Memuat aktivitas…</p>');
  try {
    const data = await api('activity');
    tool('Aktivitas workspace', data.items.map(item => `<section class="tool-row"><div><strong>${escape(item.action)}</strong><p>${escape(item.detail)}</p><small>${escape(new Date(item.created_at).toLocaleString('id-ID'))}</small></div></section>`).join('') || '<p class="empty">Belum ada aktivitas.</p>');
  } catch (error) { $('tool-error').textContent = error.message; }
}
async function openHistory() {
  const page = pages.find(page => page.id === current);
  if (page?.type !== 'doc' || !canLeave()) return;
  tool('Riwayat versi', '<p role="status">Memuat versi…</p>'); selectedVersion = null;
  try {
    const data = await api('history', { filePath: page.path });
    tool('Riwayat versi', `<p class="edit-hint">${escape(page.title)} · Versi aktif ${data.revision}. Pemulihan membuat versi baru dan mempertahankan pengaturan akses.</p><div class="version-list">${data.items.map(item => `<button class="small-button" onclick="previewVersion(${item.revision})">Versi ${item.revision} · ${escape(new Date(item.saved_at).toLocaleString('id-ID'))}</button>`).join('')}</div><label class="field-label" for="version-content">Isi versi terpilih</label><textarea id="version-content" class="editor tool-editor" readonly></textarea><p id="version-status" role="status">Pilih versi untuk melihat isinya.</p><button class="small-button primary" id="restore-version" onclick="restoreVersion()" hidden>Pulihkan versi ini</button>`);
  } catch (error) { $('tool-error').textContent = error.message; }
}
async function previewVersion(version) {
  const page = pages.find(page => page.id === current);
  await toolAction(() => api('history/preview', { filePath: page.path, version }), data => {
    selectedVersion = version; $('version-content').value = data.content;
    $('version-status').textContent = 'Versi ' + version + ' · ' + new Date(data.savedAt).toLocaleString('id-ID');
    $('restore-version').hidden = version === page.revision;
  });
}
function restoreVersion() {
  const page = pages.find(page => page.id === current);
  if (!selectedVersion || !page) return;
  toolAction(() => api('history/restore', { filePath: page.path, version: selectedVersion, revision: page.revision }), () => updateAfterMutation('Versi dipulihkan sebagai versi baru.'));
}
function openMove() {
  const page = pages.find(page => page.id === manageId);
  if (!page || !canLeave()) return;
  $('manage-dialog').close();
  const folders = pages.filter(folder => folder.type === 'folder' && folder.id !== page.id && folder.id !== page.parent && !folder.path.startsWith(page.path + '/'));
  tool('Pindahkan ' + page.title, `<form onsubmit="moveDocument(event)"><label class="field-label" for="move-target">Folder tujuan</label><select id="move-target" class="text-input">${folders.map(folder => `<option value="${escape(folder.path)}" ${folder.id === page.parent ? 'selected' : ''}>docs${escape(folder.path)}</option>`).join('')}</select><p class="edit-hint">Favorit, riwayat, dan pengaturan akses tetap tersimpan. URL berbasis path berubah mengikuti lokasi baru.</p><button type="submit" class="small-button primary">Pindahkan</button></form>`);
}
function moveDocument(event) {
  event.preventDefault(); const page = pages.find(page => page.id === manageId);
  const targetFolder = $('move-target').value;
  toolAction(() => api('move', { path: page.path, targetFolder }), () => updateAfterMutation('Item berhasil dipindahkan.'));
}
async function loadTemplates() { availableTemplates = (await api('templates')).items; return availableTemplates; }
async function openTemplates() {
  tool('Template dokumen', '<p role="status">Memuat template…</p>');
  try {
    await loadTemplates();
    tool('Template dokumen', '<button class="small-button primary" onclick="editTemplate()">Template baru</button>' +
      (availableTemplates.map(item => `<section class="tool-row"><strong>${escape(item.name)}</strong><div class="tool-actions"><button class="small-button" onclick="useTemplate('${item.id}')">Gunakan</button><button class="small-button" onclick="editTemplate('${item.id}')">Edit</button><button class="small-button danger" onclick="confirmTemplateDelete('${item.id}')">Hapus</button></div></section>`).join('') || '<p class="empty">Belum ada template.</p>'));
  } catch (error) { $('tool-error').textContent = error.message; }
}
function editTemplate(id = '') {
  const item = availableTemplates.find(item => item.id === id);
  tool(item ? 'Edit template' : 'Template baru', `<form onsubmit="saveTemplate(event,'${id}')"><label class="field-label" for="template-name">Nama template</label><input class="text-input" id="template-name" required maxlength="100" value="${escape(item?.name || '')}"><label class="field-label" for="template-content">Isi Markdown</label><textarea class="editor tool-editor" id="template-content" required>${escape(item?.content || '# Judul\n\n')}</textarea><button type="submit" class="small-button primary">Simpan template</button></form>`);
}
function saveTemplate(event, id) {
  event.preventDefault();
  const body = { id: id || undefined, name: $('template-name').value, content: $('template-content').value };
  toolAction(() => api('templates/save', body), openTemplates);
}
function confirmTemplateDelete(id) {
  tool('Hapus template?', '<p>Dokumen yang sudah dibuat dari template ini tetap tersimpan.</p><div class="tool-actions"><button class="small-button" onclick="openTemplates()">Batal</button><button class="small-button destructive" onclick="deleteTemplate(\'' + id + '\')">Hapus template</button></div>');
}
function deleteTemplate(id) { toolAction(() => api('templates/delete', { id, confirm: true }), openTemplates); }
async function prepareTemplatePicker() {
  const select = $('new-template');
  select.innerHTML = '<option value="">Halaman kosong</option>'; select.disabled = true;
  try {
    await loadTemplates();
    const selected = select.value;
    select.innerHTML = '<option value="">Halaman kosong</option>' + availableTemplates.map(item => `<option value="${item.id}">${escape(item.name)}</option>`).join('');
    select.value = selected;
  } catch { notify('Template belum dapat dimuat. Halaman kosong tetap tersedia.'); }
  finally { select.disabled = false; }
}
function useTemplate(id) {
  $('tool-dialog').close(); openCreate('doc');
  const select = $('new-template');
  select.innerHTML = '<option value="">Halaman kosong</option>' + availableTemplates.map(item => `<option value="${item.id}">${escape(item.name)}</option>`).join('');
  select.value = id;
}
function documentInitialContent(name) {
  return availableTemplates.find(item => item.id === $('new-template').value)?.content || '# ' + name.replace(/\.md$/i, '') + '\n\n';
}
async function renderFullSearch() {
  const text = $('search-input').value.trim(), sequence = ++searchSequence;
  if (!text) { $('search-results').innerHTML = '<p class="empty">Cari judul, path, atau isi dokumen.</p>'; return; }
  $('search-results').innerHTML = '<p class="empty" role="status">Mencari…</p>';
  try {
    const data = await api('search?q=' + encodeURIComponent(text));
    if (sequence !== searchSequence) return;
    $('search-results').innerHTML = data.items.map(item => `<button class="search-result" onclick="document.getElementById('search-dialog').close();navigate('${item.id}')">${icon(item.kind === 'folder' ? 'folder' : 'doc')}<span>${escape(item.path.split('/').pop())}<small>docs${escape(item.path)}</small><small class="search-snippet">${escape(item.snippet)}</small></span></button>`).join('') || '<p class="empty">Tidak ada hasil yang cocok.</p>';
  } catch (error) { if (sequence === searchSequence) $('search-results').innerHTML = '<p class="empty" role="alert">' + escape(error.message) + '</p>'; }
}
function scheduleSearch() { clearTimeout(searchTimer); ++searchSequence; searchTimer = setTimeout(renderFullSearch, 250); }
async function loadDraft(page) {
  clearTimeout(draftTimer);
  const sequence = navigationSequence;
  const data = await api('draft/read', { filePath: page.path });
  if (current !== page.id || sequence !== navigationSequence) return;
  draftState = { id: page.id, token: data.draft?.token || null, content: data.draft?.content ?? page.body, conflict: false, resolved: !data.draft || data.draft.content === page.body };
  if (data.draft && data.draft.content !== page.body) {
    const stale = data.draft.base_revision !== page.revision;
    tool('Draft belum disimpan', `<p>${stale ? 'Dokumen sudah berubah sejak draft ini dibuat. Salin atau unduh draft sebelum menggabungkannya dengan versi terbaru.' : 'Ada draft dari sesi sebelumnya. Pulihkan untuk melanjutkan tulisan.'}</p><textarea class="editor tool-editor" id="recovery-content" readonly>${escape(data.draft.content)}</textarea><div class="tool-actions"><button class="small-button" onclick="copyDraft()">Salin draft</button><button class="small-button" onclick="downloadDraft()">Unduh draft</button><button class="small-button danger" onclick="discardDraft()">Buang draft</button>${stale ? '' : '<button class="small-button primary" onclick="recoverDraft()">Lanjutkan draft</button>'}</div>`);
  }
}
function recoverDraft() {
  const page = pages.find(page => page.id === current);
  if (!page || draftState?.id !== page.id) return;
  const content = draftState.content;
  draftState.resolved = true;
  $('tool-dialog').close(); editing = true; renderDoc(page); $('markdown-editor').value = content; $('markdown-editor').focus();
  $('save-state').textContent = 'Draft dipulihkan';
}
async function copyDraft() {
  try { await navigator.clipboard.writeText($('recovery-content').value); notify('Draft disalin.'); }
  catch { $('recovery-content').focus(); $('recovery-content').select(); notify('Gunakan Ctrl+C untuk menyalin draft.'); }
}
function downloadDraft() {
  const url = URL.createObjectURL(new Blob([$('recovery-content').value], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'draft.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function discardDraft() {
  const page = pages.find(page => page.id === current), token = draftState?.token;
  toolAction(() => api('draft/discard', { filePath: page.path, token }), () => { draftState = { id: page.id, token: null, content: page.body, conflict: false, resolved: true }; $('tool-dialog').close(); });
}
function scheduleDraft() {
  clearTimeout(draftTimer);
  $('save-state').textContent = isDirty() ? 'Draft menunggu disimpan…' : 'Tersimpan di server';
  draftTimer = setTimeout(() => flushDraft().catch(() => {}), 1000);
}
async function flushDraft() {
  clearTimeout(draftTimer);
  if (draftRequest) { await draftRequest; return flushDraft(); }
  const page = pages.find(page => page.id === current), editor = $('markdown-editor');
  if (!editing || !editor || !page || !isDirty()) return;
  if (draftState?.id !== page.id || draftState.conflict || !draftState.resolved) throw new Error('Periksa draft atau versi dokumen sebelum melanjutkan.');
  const state = draftState, content = editor.value;
  if (content === state.content) return;
  draftRequest = api('draft', { filePath: page.path, content, revision: page.revision, token: state.token }).then(data => {
    state.token = data.token; state.content = content;
    if (draftState === state) $('save-state').textContent = 'Draft tersimpan · belum dipublikasikan';
  }).catch(error => {
    if (error.status === 409) state.conflict = true;
    $('save-state').textContent = 'Draft belum tersimpan'; notify(error.message); throw error;
  }).finally(() => { draftRequest = null; });
  await draftRequest;
}
function decorateHeadings(container, withOutline = false) {
  container?.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]').forEach(heading => {
    if (withOutline) {
      const link = document.createElement('a'); link.href = '#' + heading.id; link.textContent = heading.textContent; $('outline').append(link);
    }
    const button = document.createElement('button'); button.className = 'heading-link'; button.type = 'button'; button.textContent = '#';
    button.setAttribute('aria-label', 'Salin link ke bagian ' + heading.textContent);
    button.addEventListener('click', async () => {
      const url = new URL(location.href); url.hash = heading.id;
      try { await navigator.clipboard.writeText(url.href); notify('Link bagian disalin. Akses mengikuti pengaturan file.'); }
      catch { tool('Link bagian', '<input class="text-input" readonly value="' + escape(url.href) + '" onclick="this.select()"><p class="edit-hint">Pilih dan salin alamat ini.</p>'); }
    });
    heading.append(button);
  });
}
function scrollToHash() {
  if (!location.hash) return;
  try { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView(); } catch {}
}
function oldPreferencePath(id) {
  if (id === 'home') return '/';
  if (!id.startsWith('p-')) return pages.find(page => page.id === id)?.path;
  try { return new TextDecoder().decode(Uint8Array.from(atob(id.slice(2).replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))); } catch { return null; }
}
async function importBrowserPreferences() {
  try {
    const favorites = readPreference('md-previewer-favorites').map(oldPreferencePath).filter(Boolean);
    const recent = readPreference('md-previewer-recent').map(oldPreferencePath).filter(Boolean);
    applyPreferences((await api('preferences/import', { favorites, recent })).preferences);
    $('import-preferences').hidden = true; notify('Favorit dan riwayat browser digabungkan ke workspace.');
  } catch (error) { notify(error.message); }
}
async function initializeWorkspace() {
  applyPreferences(boot.preferences);
  $('import-preferences').hidden = Boolean(boot.preferences?.preferences_imported) || ![...readPreference('md-previewer-favorites'), ...readPreference('md-previewer-recent')].length;
  const initialHash = location.hash;
  await navigate(new URLSearchParams(location.search).get('view') === 'recent' ? 'recent' : boot.current || 'home', 'replace');
  if (initialHash) { history.replaceState(history.state, '', location.pathname + location.search + initialHash); scrollToHash(); }
  setInterval(async () => {
    const blocked = () => document.hidden || saving || editing || navigationPending || draftRequest || toolBusy || document.querySelector('dialog[open]');
    if (blocked()) return;
    const sequence = navigationSequence, viewed = current;
    try {
      const data = await api('workspace');
      if (blocked() || sequence !== navigationSequence || viewed !== current) return;
      const previous = pages.find(page => page.id === current);
      const known = new Map(pages.map(page => [page.id, page]));
      const next = data.pages.map(page => ({ ...(known.get(page.id) || {}), ...page }));
      const page = next.find(page => page.id === current);
      const changed = page?.type === 'doc' && (page.revision !== previous?.revision || page.path !== previous?.path);
      if (changed) {
        const document = await api('document', { filePath: page.path });
        if (blocked() || sequence !== navigationSequence || viewed !== current) return;
        Object.assign(page, { body: document.content, html: document.html, revision: document.revision, modified: document.modified });
      }
      pages = next;
      applyPreferences(data.preferences); renderTree();
      if (current === 'recent') render();
      else if (!page) await navigate('home', 'replace');
      else if (changed) {
        draftState = null; renderBreadcrumbs(); render();
        history.replaceState({ id: current }, '', urlFor(page)); activeUrl = urlFor(page);
        await loadDraft(page);
      }
      else if (page.type === 'folder') render();
    } catch { /* Keep the current page available during a temporary disconnect. */ }
  }, 15000);
}
