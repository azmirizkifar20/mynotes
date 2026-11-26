const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
assert.equal(process.env.MDPREVIEW_TEST_ISOLATED, '1', 'Use only the disposable fixture database');
assert.equal(process.env.DB_HOST, '127.0.0.1');
assert.equal(process.env.DB_USER, 'fixture');
assert.equal(process.env.DB_NAME, 'postgres');
assert.equal(fs.existsSync(path.join(__dirname, '../.env')), false, 'Do not load shared workspace credentials');
const db = require('../dist/server/backend/database');
const service = require('../dist/server/backend/modules/task-board/todo-service');
const status = value => error => error.status === value;

(async () => {
  await db.initialize();
  const taskCount = (await db.query('SELECT count(*) FROM mdpreview.tasks')).rows[0].count;
  const id = randomUUID();
  for (const body of [null, [], {}, { id, text: ' ' }, { id, text: 'x'.repeat(201) }, { id, text: 'x\0' }, { id: 'bad', text: 'todo' }, { id, text: 'todo', done: true }])
    await assert.rejects(service.create(body), status(400));
  let result = await service.create({ id, text: '  <script>To-do</script>  ' });
  assert.equal(result.todos.length, 1);
  const original = result.todos[0];
  assert.equal(original.text, '<script>To-do</script>');
  assert.equal(original.done, false);
  assert.equal(original.revision, 1);
  assert.equal((await service.create({ id, text: '<script>To-do</script>' })).todos.length, 1, 'Retry is idempotent');
  await assert.rejects(service.create({ id, text: 'different' }), status(409));
  for (const body of [{ id, revision: 1, done: 'yes' }, { id, revision: 0, done: true }, { id: 'bad', revision: 1, done: true }, { id, revision: 1, done: true, text: 'other' }])
    await assert.rejects(service.complete(body), status(400));
  result = await service.complete({ id, revision: 1, done: true });
  assert.equal(result.todos[0].done, true);
  await assert.rejects(service.complete({ id, revision: 1, done: false }), status(409));
  result = await service.remove({ id, revision: 2 });
  assert.equal(result.todos.length, 0);
  assert.equal(result.item.revision, 3);
  await assert.rejects(service.create({ id, text: original.text }), status(409), 'Create retry cannot resurrect a deleted to-do');
  await assert.rejects(service.restore({ id, revision: 2 }), status(409));
  result = await service.restore({ id, revision: 3 });
  assert.equal(result.todos[0].done, true);
  assert.equal(result.todos[0].createdAt, original.createdAt);
  assert.equal(result.todos[0].revision, 4);
  result = await service.complete({ id, revision: 4, done: false });
  assert.equal(result.todos[0].done, false);
  await assert.rejects(service.remove({ id, revision: 3 }), status(409));
  assert.equal((await db.query('SELECT count(*) FROM mdpreview.tasks')).rows[0].count, taskCount, 'To-dos do not create or modify tasks');
  assert.equal((await db.query("SELECT count(*) FROM mdpreview.audit WHERE action LIKE 'TODO_%'")).rows[0].count, '5');
  console.log('To-dos: validation, idempotent create, revision conflicts, completion, delete/undo and task isolation passed.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.pool.end());
