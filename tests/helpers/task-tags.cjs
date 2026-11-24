const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

module.exports = async function checkTags(db, service, board) {
  const rejects = (status) => (error) => error.status === status;
  assert.deepEqual(board.tags, []);
  assert(board.tasks.every((task) => Array.isArray(task.tagIds) && !task.tagIds.length));
  const first = { id: randomUUID(), name: '  Backend  ' }, second = { id: randomUUID(), name: '<Frontend>' };
  for (const tags of [null, {}, [null], [{ ...first, id: 'bad' }], [{ ...first, name: '' }], [{ ...first, name: 'x\0' }], [{ ...first, name: 'x'.repeat(33) }], [first, { ...first, id: first.id.toUpperCase() }], [first, { ...second, name: 'backend' }], Array.from({ length: 101 }, (_, n) => ({ id: randomUUID(), name: 'Tag' + n }))])
    await assert.rejects(service.saveTags({ revision: board.revision, tags }), rejects(400));
  let result = await service.saveTags({ tags: [first, second], revision: board.revision }); board = result.board;
  assert.equal(board.tags.find((tag) => tag.id === first.id).name, 'Backend');
  await assert.rejects(service.saveTags({ tags: [], revision: board.revision - 1 }), rejects(409));
  const task = board.tasks[0];
  for (const tagIds of [null, 'bad', ['bad'], [first.id, first.id.toUpperCase()], Array.from({ length: 21 }, () => randomUUID())])
    await assert.rejects(service.saveTask({ ...task, tagIds, revision: board.revision }), rejects(400));
  await assert.rejects(service.saveTask({ ...task, tagIds: [randomUUID()], revision: board.revision }), rejects(409));
  assert.equal((await service.list()).revision, board.revision, 'Invalid tags roll revision back');
  result = await service.saveTask({ ...task, tagIds: [first.id.toUpperCase(), second.id], revision: board.revision }); board = result.board;
  assert.deepEqual(new Set(board.tasks[0].tagIds), new Set([first.id, second.id]));
  const { tagIds: omitted, ...oldPayload } = board.tasks[0];
  result = await service.saveTask({ ...oldPayload, revision: board.revision }); board = result.board;
  assert.deepEqual(new Set(board.tasks[0].tagIds), new Set(omitted), 'Old client retains task tags');
  await db.query('UPDATE mdpreview.tasks SET archived_at=now() WHERE id=$1', [task.id]);
  await assert.rejects(service.saveTask({ ...board.tasks[0], tagIds: [], revision: board.revision }), rejects(409));
  const beforeRename = (await db.query('SELECT to_jsonb(t) AS data FROM mdpreview.tasks t WHERE id=$1', [task.id])).rows[0].data;
  result = await service.saveTags({ tags: [{ ...first, name: second.name }, { ...second, name: 'Backend' }], revision: board.revision }); board = result.board;
  assert.equal(board.tags.find((tag) => tag.id === first.id).name, second.name, 'Swap keeps IDs and links');
  assert.equal(board.tasks[0].tagIds.length, 2);
  result = await service.saveTags({ tags: [{ ...second, name: 'Renamed' }], revision: board.revision }); board = result.board;
  assert.deepEqual(board.tasks[0].tagIds, [second.id], 'Deleting tag detaches archived references');
  assert.deepEqual((await db.query('SELECT to_jsonb(t) AS data FROM mdpreview.tasks t WHERE id=$1', [task.id])).rows[0].data, beforeRename, 'Tag edits never rewrite or remove tasks');
  await db.query('UPDATE mdpreview.tasks SET archived_at=NULL WHERE id=$1', [task.id]);
  const many = Array.from({ length: 20 }, (_, n) => ({ id: randomUUID(), name: 'Tag' + n }));
  result = await service.saveTags({ tags: many, revision: board.revision }); board = result.board;
  result = await service.saveTask({ ...board.tasks[0], tagIds: many.map((tag) => tag.id), revision: board.revision }); board = result.board;
  assert.equal(board.tasks[0].tagIds.length, 20);
  result = await service.saveTask({ ...board.tasks[0], tagIds: [], revision: board.revision }); board = result.board;
  assert.deepEqual(board.tasks[0].tagIds, []);
  const races = await Promise.allSettled([service.saveTags({ tags: [], revision: board.revision }), service.saveTags({ tags: [], revision: board.revision })]);
  assert.equal(races.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(races.find((result) => result.status === 'rejected').reason.status, 409);
  board = await service.list();
  await db.initialize(); assert.deepEqual(await service.list(), board, 'Tag schema startup is idempotent');
  assert((await db.query("SELECT 1 FROM mdpreview.audit WHERE action='TASK_TAGS_SAVE'")).rowCount);
  console.log('Tag CRUD, validation, CAS/rollback, old clients, multi-select limits, archived links, swaps and safe deletion passed.');
  return board;
};
