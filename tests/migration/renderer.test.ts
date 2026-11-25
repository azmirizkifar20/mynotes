import { expect, it } from 'vitest'
import { createBoardRenderer } from '../../src/frontend/features/task-board/renderer'

it('replaces the loading placeholder and unmounts before leaving a board', () => {
  const host = document.createElement('div')
  host.innerHTML = '<p class="tb-loading">Memuat task…</p>'
  const renderer = createBoardRenderer()
  renderer.renderBoardContent(host, { board: { revision: 1, statuses: [], tasks: [], tags: [], documents: [] }, view: 'active', week: '2026-11-23' })
  expect(host.querySelector('.tb-loading')).toBeNull()
  expect(host.textContent).toContain('Belum ada task')
  renderer.destroyTaskBoardView()
  expect(host.textContent).toBe('')
})
