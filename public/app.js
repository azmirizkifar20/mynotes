const $ = id => document.getElementById(id);
    const icon = (name, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const boot = JSON.parse($('bootstrap').textContent);
    const basePath = boot.basePath || '';
    const appUrl = path => basePath + path;
    let pages = boot.pages || [];
    let current = 'home', filter = 'all', editing = false, createType = 'doc', sharingId = null;
    let navigationSequence = 0, navigationPending = 0, saving = false, manageId = null, activeUrl = location.pathname + location.search;
    let deletion = null;
    let pendingUpload = null, fileDragDepth = 0;
    function readPreference(key) { try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value.filter(id => typeof id === 'string') : []; } catch { return []; } }
    let recent = readPreference('md-previewer-recent').filter(id => pages.some(p => p.id === id && p.type === 'doc'));
    const favorites = new Set(readPreference('md-previewer-favorites').filter(id => pages.some(p => p.id === id)));
    const urlFor = page => appUrl(page.path.split('/').map(encodeURIComponent).join('/'));
    const dateLabel = value => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value)) : 'Workspace';
    function persistNavigation() { try { localStorage.setItem('md-previewer-recent', JSON.stringify(recent)); localStorage.setItem('md-previewer-favorites', JSON.stringify([...favorites])); } catch {} }
    function isDirty() { return documentBuffer?.id === current && documentContent() !== (pages.find(p => p.id === current)?.body || ''); }
    function canLeave() { if(saving || draftRequest || toolBusy) { notify('Tunggu hingga proses selesai.'); return false; } return !isDirty() || confirm('Tinggalkan editor? Hanya draft yang berhasil tersimpan yang dapat dipulihkan.'); }
    function setBusy(value) { if(value) navigationSequence++; saving = value; syncEditorLock(); }
    async function api(endpoint, body) {
      const options = body instanceof FormData ? { method: 'POST', body } : body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
      const response = await fetch(appUrl('/api/' + endpoint), options);
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        if (response.status === 401 && boot.mode === 'workspace' && !$('auth-dialog').open) $('auth-dialog').showModal();
        const error = new Error(result.message || 'Request gagal. Coba lagi.'); error.status = response.status; error.requiresConfirm = result.requiresConfirm; error.conflict = result.conflict; throw error;
      }
      return result;
    }
    async function refreshWorkspace() { const data = await api('workspace'); pages = data.pages; applyPreferences(data.preferences); renderTree(); }
    function renderTree() {
      function children(parent) {
        return pages.filter(p => p.parent === parent && p.type === 'folder').map(p => {
          const nested = pages.some(child => child.parent === p.id && child.type === 'folder');
          const button = '<button type="button" class="nav-item" data-nav="' + p.id + '" onclick="event.preventDefault(); event.stopPropagation(); navigate(\'' + p.id + '\')">' + icon('folder') + '<span>' + escape(p.title) + '</span></button>';
          return nested ? '<details class="tree-group"><summary>' + icon('chevron') + button + '</summary><div class="tree-children">' + children(p.id) + '</div></details>' : button;
        }).join('');
      }
      $('folder-tree').innerHTML = children('home');
      expandCurrentFolder();
    }
    function expandCurrentFolder() {
      const active = document.querySelector('[data-nav="' + current + '"]');
      let parent = active?.parentElement;
      while (parent) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
    }
    let toastTimer;
    function notify(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 3300); }
    function setTheme(preference, persist = true) {
      if(!['system','light','dark'].includes(preference)) return;
      themePreference = preference; applyTheme(); $('theme-select').value = preference;
      if($('visitor-theme')) $('visitor-theme').value = preference;
      try { localStorage.setItem('md-previewer-theme', preference); } catch { notify('Tema diganti. Browser ini tidak mengizinkan penyimpanan preferensi.'); }
      if(persist && boot.mode === 'workspace') savePreference({ action: 'theme', value: preference });
    }
    function accessLabel(page) { return `${icon(page.visibility === 'public' ? 'globe' : 'lock')}${page.visibility === 'public' ? 'Publik' : 'Privat'}`; }
    async function openShare(id) {
      const page = pages.find(page => page.id === id && page.type === 'doc'); if(!page) return;
      try {
        const data = await api('share', { filePath: page.path });
        page.visibility = data.visibility; page.sharePath = data.sharePath;
        sharingId = id; updateShareDialog(); $('share-dialog').showModal();
      } catch (error) { notify(error.message); }
    }
    function updateShareDialog() {
      const page = pages.find(page => page.id === sharingId); const publicAccess = page.visibility === 'public';
      $('share-filename').textContent = page.title;
      $('share-access').value = page.visibility;
      $('share-description').textContent = publicAccess ? 'Siapa pun yang punya link dapat membaca file ini tanpa masuk. Pengunjung tidak dapat mengedit.' : 'File ini privat. Pengguna harus masuk untuk membukanya. Link publik dinonaktifkan, termasuk link yang sebelumnya dibagikan.';
      $('share-link').value = publicAccess && page.sharePath ? new URL(page.sharePath, location.origin).href : '';
      $('share-link').placeholder = publicAccess ? '' : 'Tidak ada link publik aktif';
      $('share-link').disabled = !publicAccess; $('copy-share').disabled = !publicAccess;
    }
    async function setAccess(visibility) {
      if(!['public','private'].includes(visibility)) return;
      const page = pages.find(page => page.id === sharingId && page.type === 'doc'); if(!page) return;
      $('share-access').disabled = true; $('copy-share').disabled = true;
      try {
        const data = await api('share', { filePath: page.path, visibility });
        page.visibility = data.visibility; page.sharePath = data.sharePath;
        if($('entries')) renderEntries();
        if(current === page.id && $('file-access')) { $('file-access').innerHTML = accessLabel(page); $('file-access').classList.toggle('public-access', visibility === 'public'); }
        notify(visibility === 'public' ? 'File dapat dibaca melalui link publik.' : 'File menjadi privat. Akses publik ditutup.');
      } catch (error) { notify(error.message); }
      finally { $('share-access').disabled = false; updateShareDialog(); }
    }
    async function copyShareLink() {
      const page = pages.find(page => page.id === sharingId); if(page?.visibility !== 'public') return;
      try { await navigator.clipboard.writeText($('share-link').value); notify('Link publik disalin.'); }
      catch { $('share-link').focus(); $('share-link').select(); notify('Link dipilih. Gunakan menu Salin atau Ctrl+C untuk menyalinnya.'); }
    }
    async function previewPublicAccess() {
      const page = pages.find(page => page.id === sharingId); if(!page) return;
      try {
        const data = page.visibility === 'public' ? await api('document', { filePath: page.path }) : null;
        $('visitor-content').innerHTML = data ? `<div class="visitor-meta">${icon('globe')}Publik · Hanya baca</div><h1>${escape(page.title)}</h1><article class="prose">${data.html}</article>` : `<div class="visitor-blocked">${icon('lock')}<h2>File ini privat</h2><p>Link publik sudah tidak dapat digunakan. Masuk dengan akses workspace untuk membaca file ini.</p></div>`;
        $('share-dialog').close(); $('visitor-dialog').showModal();
      } catch (error) { notify(error.message); }
    }
    function syncSidebar() { const mobile = matchMedia('(max-width:760px)').matches; const expanded = mobile ? document.body.classList.contains('mobile-open') : !document.body.classList.contains('sidebar-hidden'); document.querySelector('.sidebar').inert = mobile && !expanded; document.querySelectorAll('.sidebar-toggle,.collapse').forEach(button => button.setAttribute('aria-expanded', expanded)); }
    function closeSidebar() { document.body.classList.remove('mobile-open'); syncSidebar(); }
    function toggleSidebar() { if(matchMedia('(max-width:760px)').matches) document.body.classList.toggle('mobile-open'); else document.body.classList.toggle('sidebar-hidden'); syncSidebar(); }
    function toggleWidth() { const on = document.body.classList.toggle('full-width'); $('width-button').setAttribute('aria-pressed', on); }
    function renderFavorites() { $('favorites').innerHTML = [...favorites].map(id => pages.find(p => p.id === id)).filter(Boolean).map(p => `<div class="favorite-item"><button type="button" class="nav-item ${current === p.id ? 'active' : ''}" onclick="navigate('${p.id}')">${icon(p.type === 'folder' ? 'folder' : 'doc')}<span>${escape(p.title)}</span></button><button type="button" class="icon-button favorite-remove" onclick="removeFavorite('${p.id}')" aria-label="Hapus ${escape(p.title)} dari favorit" title="Hapus dari favorit">${icon('close')}</button></div>`).join('') || '<div class="subtle" style="padding:5px 10px">Belum ada halaman favorit.</div>'; }
    function removeFavorite(id) { setFavorite(id, false); }
    function breadcrumbTrail(id) {
      const trail = [];
      for(let page = pages.find(p => p.id === id); page; page = pages.find(p => p.id === page.parent)) trail.unshift(page);
      return id === 'recent' || Object.hasOwn(managementPages, id) ? [pages.find(p => p.id === 'home'), { id, title: id === 'recent' ? 'Terakhir dibuka' : managementPages[id].title }] : trail;
    }
    function renderBreadcrumbs() {
      const trail = breadcrumbTrail(current), container = $('breadcrumb-path');
      container.innerHTML = trail.map((page, index) => {
        const label = escape(page.id === 'home' ? 'docs' : page.id === 'recent' || Object.hasOwn(managementPages, page.id) ? page.title : page.path.split('/').pop());
        const item = index === trail.length - 1 ? `<span aria-current="page">${label}</span>` : `<a href="${escape(urlFor(page))}" data-breadcrumb="${escape(page.id)}">${label}</a>`;
        return `<li>${index ? '<span class="slash" aria-hidden="true">/</span>' : ''}${item}</li>`;
      }).join('');
      container.querySelectorAll('a').forEach(link => link.addEventListener('click', event => {
        if(event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); navigate(link.dataset.breadcrumb);
      }));
      container.scrollLeft = container.scrollWidth;
    }
    function syncFavorite() { const active = favorites.has(current); $('favorite-button').classList.toggle('is-favorite', active); $('favorite-button').setAttribute('aria-pressed', active); $('favorite-button').setAttribute('aria-label', active ? 'Hapus dari favorit' : 'Tambah ke favorit'); $('favorite-button').title = active ? 'Hapus dari favorit' : 'Tambah ke favorit'; }
    function toggleFavorite() { if(current === 'recent') return notify('Buka halaman atau folder untuk menambah favorit.'); setFavorite(current, !favorites.has(current)); }
    async function navigate(id, historyMode = 'push', completingMutation = false) {
      if(!completingMutation && !canLeave()) return false;
      const previousDraft = documentContent();
      const page = pages.find(p => p.id === id);
      if(!page && id !== 'recent' && !Object.hasOwn(managementPages, id)) return false;
      navigationPending++;
      try {
      const sequence = ++navigationSequence;
      if(page?.type === 'doc') {
        try {
          const data = await api('document', { filePath: page.path });
          if(sequence !== navigationSequence) return false;
          if(isDirty() && documentContent() !== previousDraft && !canLeave()) return false;
          page.body = data.content; page.html = data.html; page.modified = data.modified; page.revision = data.revision;
        } catch (error) { notify(error.message); return false; }
      }
      destroyLiveEditor(); documentBuffer = null;
      current = id; filter = 'all'; editing = false; draftState = null; closeSidebar();
      $('tool-dialog').close();
      if(page?.type === 'doc') { recent = [id,...recent.filter(p => p !== id)].slice(0,50); savePreference({ action: 'opened', id }); }
      renderBreadcrumbs();
      $('save-state').textContent = page?.type === 'doc' ? '' : 'Workspace pribadi';
      $('manage-button').hidden = id === 'home' || !page;
      $('favorite-button').hidden = !page;
      document.querySelectorAll('[data-nav]').forEach(el => el.classList.toggle('active', el.dataset.nav === id));
      renderFavorites(); syncFavorite(); expandCurrentFolder(); const rendering = render(); window.scrollTo({top:0});
      document.title = (page?.title || (id === 'recent' ? 'Terakhir dibuka' : managementPages[id].title)) + ' · MD Previewer';
      const url = !page ? appUrl('/?view=' + id) : urlFor(page);
      if(historyMode === 'replace') history.replaceState({id}, '', url);
      else if(historyMode === 'push' && location.pathname + location.search !== url) history.pushState({id}, '', url);
      activeUrl = url;
      await rendering;
      if(sequence !== navigationSequence) return false;
      if(page?.type === 'doc') { try { await loadDraft(page); } catch(error) { notify('Draft belum dapat dimuat: ' + error.message); } }
      return true;
      } finally { navigationPending--; }
    }
    function header(page) { return `<div class="page-icon">${icon(page.type === 'doc' ? 'doc' : 'book')}</div><p class="page-kicker">${page.type === 'doc' ? escape(pages.find(p => p.id === page.parent)?.title || 'Workspace') : 'Personal workspace'}</p><h1>${escape(page.title)}</h1><p class="lead">${escape(page.description || 'Sebuah ruang baru untuk catatanmu.')}</p><div class="page-meta">${page.type === 'doc' ? `<button class="access-meta ${page.visibility === 'public' ? 'public-access' : ''}" id="file-access" onclick="openShare('${page.id}')" aria-label="Atur akses file">${accessLabel(page)}</button>` : `<span>${icon('lock')}Workspace pribadi</span>`}<span>${icon(page.type === 'doc' ? 'doc' : 'folder')}${page.type === 'doc' ? 'Dokumen Markdown' : 'Koleksi dokumen'}</span><span>${escape(dateLabel(page.modified))}</span></div>`; }
    function render() {
      const page = pages.find(p => p.id === current);
      $('detail-share').hidden = page?.type !== 'doc';
      if(Object.hasOwn(managementPages, current)) return renderManagementPage(current);
      if(page?.type === 'doc') return renderDoc(page);
      const isRecent = current === 'recent';
      const view = page || {title:'Terakhir dibuka',description:'Kembali ke dokumen yang baru saja kamu baca.',type:'folder'};
      const continuePages = (recent.length ? recent.map(id => pages.find(p => p.id === id)) : pages.filter(p => p.type === 'doc').sort((a,b) => b.modified.localeCompare(a.modified))).filter(Boolean).slice(0,3);
      const recentCards = current === 'home' ? `<section id="recent-section"><div class="section-heading"><h2>${recent.length ? 'Lanjutkan dari sini' : 'Dokumen terbaru'}</h2><button class="subtle" onclick="navigate('recent')">Lihat semua</button></div><div class="recent-grid">${continuePages.map(p => `<button class="recent-card" onclick="navigate('${p.id}')"><span class="doc-symbol">${icon('doc')}</span><strong>${escape(p.title)}</strong><small>${escape(pages.find(f => f.id === p.parent)?.title || 'Workspace')}</small></button>`).join('') || '<p class="subtle">Belum ada dokumen. Buat halaman pertamamu di bawah.</p>'}</div></section>` : '';
      $('main').innerHTML = header(view) + recentCards + `<section class="library" id="documents-section">
        <div class="section-heading library-title"><h2>${isRecent ? 'Riwayat bacaan' : 'Di dalam workspace'}</h2><span class="subtle" id="item-count"></span></div>
        <div class="library-toolbar"><div class="tabs" role="tablist" aria-label="Filter dokumen">
          <button class="tab ${filter === 'all' ? 'selected' : ''}" role="tab" aria-selected="${filter === 'all'}" onclick="setFilter('all')">${icon('list')}Semua</button>
          <button class="tab ${filter === 'folder' ? 'selected' : ''}" role="tab" aria-selected="${filter === 'folder'}" onclick="setFilter('folder')">Folder</button>
          <button class="tab ${filter === 'doc' ? 'selected' : ''}" role="tab" aria-selected="${filter === 'doc'}" onclick="setFilter('doc')">Halaman</button>
        </div><div class="library-actions"><button class="icon-button" onclick="openSearch()" aria-label="Cari dokumen" title="Cari dokumen">${icon('search')}</button><button class="small-button" onclick="openCreate('folder')">${icon('folder')}Folder</button><button class="small-button primary" onclick="openCreate('doc')">${icon('plus')}Baru</button></div></div>
        <div class="table-wrap"><table><thead><tr><th>Nama</th><th class="type-column">Jenis</th><th class="access-column">Akses</th><th class="action-column"><span class="sr-only">Aksi file</span></th></tr></thead><tbody id="entries"></tbody></table></div>
        <button class="add-row" onclick="openCreate('doc')">${icon('plus')}Tambah halaman baru</button>
      </section><aside class="callout" id="note-section">${icon('book')}<div><strong>Catatan yang rapi, pikiran yang lebih lega.</strong>Kelompokkan halaman berdasarkan proyek. Pakai favorit untuk menyimpan dokumen yang sering kamu buka.</div></aside><footer class="page-footer"><span>MD Previewer · Ruang untuk catatan kerja.</span></footer>`;
      renderEntries();
      $('outline').innerHTML = `<div class="outline-title">DI HALAMAN INI</div>${current === 'home' ? '<a href="#recent-section">Terakhir dibuka</a>' : ''}<a href="#documents-section">${isRecent ? 'Riwayat bacaan' : 'Isi workspace'}</a><a href="#note-section">Catatan kecil</a><div class="outline-help"><kbd>Ctrl</kbd> + <kbd>K</kbd> untuk cari<br><kbd>Esc</kbd> untuk tutup dialog</div>`;
    }
    function setFilter(value) { filter = value; render(); }
    function renderEntries() {
      const items = (current === 'recent' ? recent.map(id => pages.find(p => p.id === id)) : pages.filter(p => p.parent === current)).filter(p => filter === 'all' || p.type === filter);
      $('item-count').textContent = `${items.length} item`;
      $('entries').innerHTML = items.length ? items.map(p => `<tr>
        <td><button class="entry" onclick="navigate('${p.id}')">${icon(p.type === 'folder' ? 'folder' : 'doc', p.type === 'folder' ? 'folder-icon' : '')}<span>${escape(p.title)}</span>${icon('chevron','arrow')}</button></td>
        <td class="type-column">${p.type === 'folder' ? 'Folder' : 'Markdown'}</td>
        <td class="access-column">${p.type === 'doc' ? `<span class="file-access ${p.visibility === 'public' ? 'public-access' : ''}">${accessLabel(p)}</span>` : '<span aria-label="Akses diatur per file">/</span>'}</td>
        <td class="action-column">${p.type === 'doc' ? `<div class="row-actions"><button class="small-button row-share" onclick="openShare('${p.id}')" aria-label="Bagikan ${escape(p.title)}" title="Bagikan file">${icon('share')}<span>Bagikan</span></button><button class="small-button row-delete" onclick="deleteItem('${p.id}')" aria-label="Hapus ${escape(p.title)}" title="Hapus file">${icon('trash')}<span>Hapus</span></button></div>` : ''}</td>
      </tr>`).join('') : '<tr><td colspan="4"><div class="empty">Belum ada item di sini.<br>Buat halaman atau folder untuk mulai menulis.</div></td></tr>';
    }
    function renderDoc(page) {
      destroyLiveEditor();
      if (documentBuffer?.id !== page.id) documentBuffer = { id: page.id, content: page.body || '' };
      $('main').innerHTML = header(page) + `<div class="doc-toolbar"><div class="tabs"><button class="tab ${!editing ? 'selected' : ''}" onclick="setEditing(false)">${icon('book')}Dokumen</button><button class="tab ${editing ? 'selected' : ''}" onclick="setEditing(true)">${icon('code')}Markdown</button></div><div class="tool-actions"><button class="small-button" onclick="openHistory()">${icon('clock')}Riwayat</button><button class="small-button" onclick="downloadDoc()">${icon('upload')}Unduh .md</button><button class="small-button primary" id="save-document" onclick="saveDoc()" disabled>${icon('check')}Simpan</button></div></div>${editing ? `<label class="field-label" for="markdown-editor">Konten Markdown</label><textarea class="editor" id="markdown-editor" spellcheck="false">${escape(documentContent())}</textarea>` : `<div id="live-editor" aria-label="Konten dokumen, dapat diedit langsung" aria-busy="true"><article class="prose">${page.html || ''}</article></div>`}<p class="edit-hint">${editing ? 'Edit sumber Markdown.' : 'Klik teks untuk mengedit langsung. Format akan dirender saat kamu mengetik.'} Draft tersimpan otomatis dan tetap privat. Tekan Simpan atau Ctrl+S untuk memperbarui dokumen.</p><footer class="page-footer"><span>${escape(page.title)}.md · Versi ${page.revision}</span><span>${escape(dateLabel(page.modified))}</span></footer>`;
      $('outline').innerHTML = '<div class="outline-title">DI HALAMAN INI</div>';
      decorateHeadings(document.querySelector('#main .prose'), true);
      if(editing) {
        $('outline').insertAdjacentHTML('beforeend', '<span class="subtle">Mode edit Markdown</span>');
        $('markdown-editor').addEventListener('input', event => changeDocumentContent(event.target.value));
      } else {
        mountLiveEditor(page);
      }
      syncEditorLock();
      $('outline').insertAdjacentHTML('beforeend', '<div class="outline-help"><kbd>Ctrl</kbd> + <kbd>K</kbd> untuk cari</div>');
    }
    async function setEditing(value) {
      if(value === editing || saving || navigationPending || draftRequest || toolBusy) return;
      const page = pages.find(p => p.id === current);
      documentContent();
      if(draftState?.id !== page.id || !draftState.resolved || draftState.conflict) {
        try { await loadDraft(page); } catch(error) { return notify(error.message); }
        if(current !== page.id || !draftState?.resolved || draftState.conflict) return;
      }
      editing = value; renderDoc(pages.find(p => p.id === current));
      if(editing) $('markdown-editor').focus();
    }
    async function saveDoc() {
      if(saving || !isDirty() || draftState?.conflict || !draftState?.resolved) return;
      const page = pages.find(p => p.id === current); const content = documentContent();
      setBusy(true); $('save-document').disabled = true; $('save-state').textContent = 'Menyimpan…';
      try {
        await flushDraft();
        const data = await api('save', { filePath: page.path, content, revision: page.revision, draftToken: draftState?.token || undefined });
        page.body = content; page.html = data.html; page.modified = data.modified; page.revision = data.revision;
        draftState = { id: page.id, token: null, content, conflict: false, resolved: true };
        renderDoc(page); $('save-state').textContent = ''; notify('Perubahan disimpan.');
      } catch (error) { $('save-state').textContent = 'Gagal menyimpan'; notify(error.message); }
      finally { setBusy(false); }
    }
    function downloadDoc() {
      const page = pages.find(p => p.id === current);
      const url = URL.createObjectURL(new Blob([page.body || ''], { type: 'text/markdown;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = page.title + '.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function openSearch() { $('search-input').value = ''; renderSearch(); $('search-dialog').showModal(); $('search-input').focus(); }
    function renderSearch() { renderFullSearch(); }
    function activeFolder() {
      const page = pages.find(p => p.id === current);
      return page?.type === 'folder' ? page : pages.find(p => p.id === page?.parent) || pages[0];
    }
    function validName(value) { return value && !value.startsWith('.') && !/[<>:"/\\|?*\x00-\x1f]/.test(value) && !/[. ]$/.test(value); }
    function resetFileDrag() { fileDragDepth = 0; $('file-drop-zone').hidden = true; }
    async function openUploadPreview(file) {
      if(boot.mode !== 'workspace' || !file) return;
      if(saving || document.querySelector('dialog[open]')) return notify('Selesaikan dialog atau proses yang sedang berjalan terlebih dahulu.');
      if(!/\.(md|markdown)$/i.test(file.name)) return notify('Pilih file Markdown dengan ekstensi .md.');
      if(file.size > 5 * 1024 * 1024) return notify('Ukuran file maksimal 5 MB.');
      const folder = activeFolder();
      const upload = pendingUpload = { file, folderPath: folder.path, ready: false, uploadedPath: null };
      $('upload-name').value = file.name.replace(/\.markdown$/i, '.md');
      $('upload-name').disabled = false; $('upload-name').setCustomValidity('');
      $('upload-target').textContent = 'docs' + folder.path;
      $('upload-size').textContent = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(file.size / 1024) + ' KB';
      $('upload-content').value = '';
      $('upload-draft').hidden = !isDirty();
      $('upload-error').textContent = '';
      $('upload-status').textContent = 'Membaca file dari perangkat…';
      $('confirm-upload').textContent = 'Upload'; $('confirm-upload').disabled = true;
      $('upload-form').setAttribute('aria-busy', 'true');
      $('upload-dialog').showModal(); $('upload-name').focus();
      try {
        const content = await file.text();
        if(pendingUpload !== upload) return;
        $('upload-content').value = content;
        upload.ready = true; $('confirm-upload').disabled = false;
        $('upload-status').textContent = 'Isi Markdown asli · belum diupload';
      } catch {
        if(pendingUpload === upload) { $('upload-error').textContent = 'File tidak dapat dibaca. Tutup dialog dan pilih file kembali.'; $('upload-status').textContent = 'Gagal membaca file'; }
      } finally {
        if(pendingUpload === upload) $('upload-form').setAttribute('aria-busy', 'false');
      }
    }
    function closeUploadDialog() { if(!saving) $('upload-dialog').close(); }
    async function confirmUpload(event) {
      event.preventDefault();
      const upload = pendingUpload;
      if(!upload?.ready || saving) return;
      const name = $('upload-name').value.trim();
      if(!validName(name) || !/\.md$/i.test(name)) { $('upload-name').setCustomValidity('Gunakan nama file .md tanpa karakter path atau titik di awal/akhir.'); $('upload-name').reportValidity(); return; }
      const dialog = $('upload-dialog');
      setBusy(true); $('upload-error').textContent = ''; $('upload-form').setAttribute('aria-busy', 'true');
      dialog.querySelectorAll('button,input').forEach(control => control.disabled = true);
      $('confirm-upload').textContent = upload.uploadedPath ? 'Memuat ulang…' : 'Mengupload…';
      try {
        if(!upload.uploadedPath) {
          const data = new FormData();
          data.append('targetFolder', upload.folderPath); data.append('filename', name); data.append('file', upload.file);
          const result = await api('upload', data); upload.uploadedPath = result.path;
        }
        await refreshWorkspace();
        const folder = pages.find(page => page.type === 'folder' && page.path === upload.folderPath);
        await navigate(folder?.id || 'home', 'push', true);
        dialog.close(); $('main').focus(); notify('File diupload sebagai privat.');
      } catch (error) {
        $('upload-error').textContent = upload.uploadedPath ? 'File sudah diupload, tetapi daftar belum berhasil dimuat. Klik Muat ulang daftar untuk melanjutkan.' : error.message;
      } finally {
        setBusy(false); $('upload-form').setAttribute('aria-busy', 'false');
        dialog.querySelectorAll('button,input').forEach(control => control.disabled = false);
        $('upload-name').disabled = Boolean(upload.uploadedPath);
        $('confirm-upload').textContent = upload.uploadedPath ? 'Muat ulang daftar' : 'Upload';
      }
    }
    function openCreate(type) {
      createType = type;
      $('create-title').textContent = type === 'folder' ? 'Folder baru' : 'Halaman baru';
      $('name-label').textContent = type === 'folder' ? 'Nama folder' : 'Judul halaman';
      $('create-dialog').querySelector('.edit-hint').textContent = type === 'doc' ? 'Halaman baru dimulai sebagai privat. Ubah akses melalui Bagikan saat siap dipublikasikan.' : 'Folder disimpan di dalam ' + activeFolder().title + '.';
      $('new-name').value = ''; $('create-dialog').showModal();
      $('template-field').hidden = type !== 'doc';
      if(type === 'doc') prepareTemplatePicker();
    }
    $('create-form').addEventListener('submit', async event => {
      event.preventDefault();
      const name = $('new-name').value.trim();
      if(!validName(name)) { $('new-name').setCustomValidity('Gunakan nama tanpa karakter path atau titik di awal/akhir.'); $('new-name').reportValidity(); return; }
      if(!canLeave()) return;
      const type = createType, parent = activeFolder();
      const filename = type === 'doc' && !/\.md$/i.test(name) ? name + '.md' : name;
      const path = parent.path.replace(/\/$/, '') + '/' + filename;
      const submit = event.submitter; submit.disabled = true; setBusy(true);
      try {
        await api(type === 'folder' ? 'create-folder' : 'save', type === 'folder' ? { folderPath: path } : { filePath: path, content: documentInitialContent(name), create: true });
        editing = false; await refreshWorkspace(); $('create-dialog').close();
        const page = pages.find(p => p.path === path);
        if(page) { await navigate(page.id, 'push', true); setBusy(false); if(type === 'doc') setEditing(true); }
        notify(type === 'folder' ? 'Folder dibuat.' : 'Halaman privat siap ditulis.');
      } catch (error) { notify(error.message); }
      finally { setBusy(false); submit.disabled = false; }
    });
    function openManage(id) {
      const page = pages.find(p => p.id === id); if(!page || id === 'home') return;
      manageId = id; $('manage-title').textContent = page.type === 'folder' ? 'Kelola folder' : 'Kelola halaman';
      $('rename-name').value = page.title; $('manage-dialog').showModal();
    }
    async function renameItem(event) {
      event.preventDefault();
      const name = $('rename-name').value.trim();
      if(!validName(name)) { $('rename-name').setCustomValidity('Nama tidak valid.'); $('rename-name').reportValidity(); return; }
      if(!canLeave()) return;
      const page = pages.find(p => p.id === manageId), oldPages = pages;
      const submit = event.submitter; submit.disabled = true; setBusy(true);
      try {
        const result = await api('rename', { path: page.path, newName: name });
        editing = false; await refreshWorkspace();
        const remap = id => { const oldPath = oldPages.find(p => p.id === id)?.path; const nextPath = oldPath === page.path || oldPath?.startsWith(page.path + '/') ? result.path + oldPath.slice(page.path.length) : oldPath; return pages.find(p => p.path === nextPath)?.id; };
        recent = recent.map(remap).filter(Boolean); const nextFavorites = [...favorites].map(remap).filter(Boolean); favorites.clear(); nextFavorites.forEach(id => favorites.add(id)); persistNavigation();
        $('manage-dialog').close(); await navigate(pages.find(p => p.path === result.path).id, 'replace', true); notify('Nama diperbarui. Pengaturan akses dan link berbagi tetap tersimpan.');
      } catch (error) { notify(error.message); }
      finally { setBusy(false); submit.disabled = false; }
    }
    function deleteItem(id = manageId) {
      const page = pages.find(p => p.id === id); if(!page || id === 'home' || $('delete-dialog').open) return;
      if(saving) return notify('Tunggu hingga proses selesai.');
      deletion = { id, force: false, removed: false };
      $('delete-title').textContent = page.type === 'folder' ? 'Hapus folder?' : 'Hapus file?';
      $('delete-description').textContent = 'Item akan dipindahkan ke sampah dan bisa dipulihkan. Link publik tidak dapat dibuka selama item berada di sampah.';
      $('delete-filename').textContent = page.path.split('/').pop();
      $('delete-path').textContent = 'docs' + page.path;
      $('delete-draft').hidden = !isDirty();
      $('delete-error').textContent = '';
      $('confirm-delete').textContent = page.type === 'folder' ? 'Hapus folder' : 'Hapus file';
      $('delete-dialog').showModal(); $('cancel-delete').focus();
    }
    function closeDeleteDialog() {
      if(!saving) $('delete-dialog').close();
    }
    async function confirmDelete(event) {
      event.preventDefault();
      const target = deletion, page = pages.find(p => p.id === target?.id);
      if(!page || page.id === 'home' || saving) return;
      const dialog = $('delete-dialog'), button = $('confirm-delete');
      setBusy(true); $('delete-error').textContent = '';
      $('delete-form').setAttribute('aria-busy', 'true');
      dialog.querySelectorAll('button').forEach(control => control.disabled = true);
      button.textContent = target.removed ? 'Memuat ulang…' : 'Menghapus…';
      try {
        if(!target.removed) {
          await api('delete', { path: page.path, force: target.force });
          target.removed = true;
        }
        editing = false; await refreshWorkspace();
        recent = recent.filter(id => pages.some(p => p.id === id));
        [...favorites].filter(id => !pages.some(p => p.id === id)).forEach(id => favorites.delete(id)); persistNavigation();
        const destination = current === 'recent' || pages.some(p => p.id === current) ? current : pages.some(p => p.id === page.parent) ? page.parent : 'home';
        $('manage-dialog').close(); await navigate(destination, 'replace', true); dialog.close(); $('main').focus(); notify('Item dihapus.');
      } catch (error) {
        if(error.requiresConfirm) {
          target.force = true;
          $('delete-title').textContent = 'Hapus folder beserta isinya?';
          $('delete-description').textContent = 'Semua file dan subfolder akan dipindahkan ke sampah bersama folder ini. Konfirmasi sekali lagi untuk melanjutkan.';
        } else {
          $('delete-error').textContent = error.message;
          if(target.removed) $('delete-description').textContent = 'Item sudah dihapus, tetapi daftar belum berhasil dimuat ulang. Coba muat ulang daftar.';
        }
      } finally {
        setBusy(false); $('delete-form').setAttribute('aria-busy', 'false');
        dialog.querySelectorAll('button').forEach(control => control.disabled = false);
        button.textContent = target.removed ? 'Muat ulang daftar' : target.force ? 'Hapus semua isi' : page.type === 'folder' ? 'Hapus folder' : 'Hapus file';
        if(dialog.open && target.force) $('cancel-delete').focus();
      }
    }
    async function logout() {
      if(!canLeave()) return;
      setBusy(true);
      try { await api('logout', {}); editing = false; setBusy(false); location.replace(appUrl('/')); }
      catch (error) { notify(error.message); }
      finally { setBusy(false); }
    }
    async function authenticate(event) {
      event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('[type=submit]');
      const feedback = form.querySelector('[role=alert]'); feedback.textContent = ''; submit.disabled = true;
      try {
        await api('verify', { code: form.querySelector('[name=code]').value });
        if(boot.mode === 'workspace') { $('auth-dialog').close(); form.reset(); notify('Sesi aktif kembali. Kamu dapat melanjutkan.'); }
        else location.reload();
      } catch (error) { feedback.textContent = error.message; }
      finally { submit.disabled = false; }
    }
    const loginFields = `<label class="field-label" for="access-code">Kode akses</label><input class="text-input" id="access-code" name="code" type="password" required autocomplete="current-password" placeholder="Masukkan kode akses"><p class="form-error" role="alert"></p><button class="small-button primary" type="submit">Buka workspace</button>`;
    function renderAccessPage() {
      $('access-page').hidden = false;
      const theme = `<label class="theme-setting" for="visitor-theme">${icon('theme')}<span>Tampilan</span><select id="visitor-theme" onchange="setTheme(this.value)"><option value="system">Sistem</option><option value="light">Terang</option><option value="dark">Gelap</option></select></label>`;
      const toolbar = `<header class="public-topbar"><a class="public-brand" href="${escape(appUrl('/'))}">${icon('book')}MD Previewer</a>${theme}</header>`;
      if(boot.mode === 'public') {
        document.title = boot.document.title + ' · MD Previewer';
        $('access-page').innerHTML = toolbar + `<main class="public-document"><div class="visitor-meta">${icon('globe')}Publik · Hanya baca</div><h1>${escape(boot.document.title)}</h1><article class="prose">${boot.document.html}</article><footer class="page-footer"><span>MD Previewer</span><span>${escape(dateLabel(boot.document.modified))}</span></footer></main>`;
      } else if(boot.mode === 'login') {
        $('access-page').innerHTML = toolbar + `<main class="login-page"><div class="page-icon">${icon('lock')}</div><p class="page-kicker">Personal workspace</p><h1>Ruang untuk catatanmu.</h1><p class="lead">Masuk untuk membuka workspace dan mengelola dokumen privat.</p><form class="login-form" onsubmit="authenticate(event)">${loginFields}</form></main>`;
      } else {
        $('access-page').innerHTML = toolbar + `<main class="login-page"><div class="page-icon">${icon('lock')}</div><h1>${escape(boot.message || 'Halaman tidak tersedia')}</h1><p class="lead">${escape(boot.description || 'Periksa alamat halaman atau kembali ke workspace.')}</p><a class="small-button" href="${escape(appUrl('/'))}">Buka workspace</a></main>`;
      }
      $('visitor-theme').value = themePreference;
    }
    $('new-name').addEventListener('input', () => $('new-name').setCustomValidity(''));
    $('rename-name').addEventListener('input', () => $('rename-name').setCustomValidity(''));
    $('search-input').addEventListener('input', scheduleSearch);
    $('upload-name').addEventListener('input', () => $('upload-name').setCustomValidity(''));
    $('upload-input').addEventListener('change', event => { openUploadPreview(event.target.files[0]); event.target.value = ''; });
    if(boot.mode === 'workspace') {
      const isFileDrag = event => Array.from(event.dataTransfer?.types || []).includes('Files');
      const canDrop = () => !saving && !document.querySelector('dialog[open]');
      document.addEventListener('dragenter', event => {
        if(!isFileDrag(event)) return;
        event.preventDefault(); fileDragDepth++;
        if(canDrop()) { $('file-drop-target').textContent = 'Folder tujuan: docs' + activeFolder().path; $('file-drop-zone').hidden = false; }
      });
      document.addEventListener('dragover', event => {
        if(!isFileDrag(event)) return;
        event.preventDefault(); event.dataTransfer.dropEffect = canDrop() ? 'copy' : 'none';
      });
      document.addEventListener('dragleave', () => { if(fileDragDepth > 0 && --fileDragDepth === 0) resetFileDrag(); });
      document.addEventListener('drop', event => {
        if(!isFileDrag(event)) return;
        event.preventDefault(); resetFileDrag();
        if(!canDrop()) return notify('Selesaikan dialog atau proses yang sedang berjalan terlebih dahulu.');
        if(Array.from(event.dataTransfer.items || []).some(item => item.webkitGetAsEntry?.()?.isDirectory)) return notify('Pilih file .md, bukan folder.');
        const files = event.dataTransfer.files;
        if(files.length !== 1) return notify('Lepaskan satu file .md setiap kali upload.');
        if(!/\.md$/i.test(files[0].name)) return notify('Drag and drop hanya menerima file .md.');
        openUploadPreview(files[0]);
      });
      window.addEventListener('dragend', resetFileDrag); window.addEventListener('blur', resetFileDrag);
    }
    document.addEventListener('keydown', event => {
      if(boot.mode !== 'workspace') return;
      if((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if(!document.querySelector('dialog[open]')) openSearch(); }
      if(event.key === 'Escape') { resetFileDrag(); closeSidebar(); }
      if((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && pages.find(page => page.id === current)?.type === 'doc') { event.preventDefault(); if(!document.querySelector('dialog[open]')) saveDoc(); }
    });
    window.addEventListener('beforeunload', event => { if(isDirty() || saving) { event.preventDefault(); event.returnValue = ''; } });
    window.addEventListener('pageshow', event => { if(event.persisted) location.reload(); });
    window.addEventListener('popstate', async () => {
      if(boot.mode !== 'workspace') return;
      if(saving) { history.pushState({id: current}, '', activeUrl); notify('Tunggu hingga proses selesai.'); return; }
      let key; try { key = decodeURIComponent(location.pathname.slice(basePath.length)).replace(/\/$/, '') || '/'; } catch { location.reload(); return; }
      const id = requestedView() || pages.find(p => p.path === key)?.id;
      if(!id) { if(canLeave()) location.reload(); else history.pushState({id: current}, '', activeUrl); return; }
      if(id !== current && !await navigate(id, 'none')) history.pushState({id: current}, '', activeUrl);
    });
    $('theme-select').value = themePreference;
    matchMedia('(max-width:760px)').addEventListener('change', syncSidebar);
    if(boot.mode === 'workspace') {
      $('auth-fields').innerHTML = loginFields.replaceAll('access-code', 'session-code');
      $('workspace-app').hidden = false; renderTree();
      initializeWorkspace().catch(error => notify(error.message));
    } else { renderAccessPage(); decorateHeadings(document.querySelector('.public-document .prose')); scrollToHash(); }
