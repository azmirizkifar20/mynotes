const assert = require('node:assert/strict');
const { loadFrontend } = require('./helpers/frontend.cjs');

(async () => {
  const { view } = await loadFrontend({ view: 'features/task-board/view.js' });
  const actions = { escape: (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]), icon: () => '', appUrl: (value) => '/mynotes' + value };
  const ui = view.createFeature({ actions });
  const doc = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const task = { id: 'task-one', title: '<active>', description: '', number: '1', priority: 'normal', due: '', statusId: 'done', archivedAt: null };
  const board = { statuses: [{ id: 'done', name: 'Done', tone: 'green', completed: true }], documents: [{ id: doc, path: '/new name.md' }], tasks: [task, { ...task, id: 'task-two', number: '2', title: '<archived>', description: `@[old.md](doc:${doc})`, archivedAt: '2026-11-23T04:00:00Z' }] };
  let result = ui.boardColumns(board, '');
  assert.equal(result.count, 1); assert(result.html.includes('&lt;active&gt;')); assert(!result.html.includes('&lt;archived&gt;'));
  result = ui.boardColumns(board, '', true);
  assert.equal(result.count, 1); assert(!result.html.includes('&lt;active&gt;')); assert(result.html.includes('&lt;archived&gt;'));
  assert(!result.html.includes('draggable="true"')); assert(result.html.includes('data-action="openBoardTask"'));
  assert.equal(ui.boardColumns(board, 'new name', true).count, 1);
  assert.equal(ui.boardColumns(board, 'nothing', true).count, 0);
  assert(ui.boardColumns({ ...board, tasks: [] }, '', true).html.includes('Arsip masih kosong'));
  const rows = ui.statusRows(board.statuses);
  assert.match(rows, /type="checkbox"[^>]*data-board-field="completed"[^>]*checked/);
  assert(!ui.statusRows([{ ...board.statuses[0], completed: false }]).includes(' checked'));
  console.log('Archive filtering, search/current mentions, safe HTML, stable links, empty state and completed status checkbox passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
