import { afterEach, describe, expect, it } from 'vitest'
import { h, render } from 'vue'
import BoardContent from '../../src/frontend/features/task-board/components/BoardContent.vue'
import type { TaskBoard } from '../../src/shared/contracts/task-board'
import type { BoardContentProps } from '../../src/shared/contracts/task-board'

const hosts: HTMLElement[] = []
afterEach(() => { for (const host of hosts.splice(0)) render(null, host) })
function mount(props: BoardContentProps) {
  const host = document.createElement('div')
  hosts.push(host)
  const update = () => render(h(BoardContent, props), host)
  update()
  return { host, setProps(next: Partial<BoardContentProps>) { props = { ...props, ...next }; update() } }
}

const board: TaskBoard = {
  revision: 1,
  statuses: [
    { id: 'todo', name: 'Ide', tone: 'neutral', completed: false },
    { id: 'done', name: 'Selesai', tone: 'green', completed: true },
  ],
  tags: [{ id: 'tag', name: 'Catatan <script>' }],
  documents: [{ id: 'doc', path: '/notes.md' }],
  tasks: [
    { id: 'one', number: 1, title: '<img src=x onerror=alert(1)>', description: '', result: 'Hasil', statusId: 'todo', priority: 'high', due: '2026-11-25', startDate: '2026-11-23', tagIds: ['tag'], checklist: [{ id: 'c', text: 'Cek', done: true }], attachments: [] },
    { id: 'two', number: 2, title: 'Arsip', description: '', statusId: 'done', priority: 'normal', due: '', tagIds: [], archivedAt: '2026-11-24T12:00:00Z' },
  ],
}

describe('Vue task board', () => {
  it('preserves card DOM hooks, escapes titles and shows resources', () => {
    const { host } = mount({ board, view: 'active', week: '2026-11-23' })
    expect(host.querySelectorAll('.tb-card')).toHaveLength(1)
    expect(host.querySelector('[data-board-task="one"]')!.getAttribute('draggable')).toBe('true')
    expect(host.querySelector('.tb-card [data-action="openBoardTask"]')!.getAttribute('data-arg')).toBe('one')
    expect(host.textContent).toContain(board.tasks[0]!.title)
    expect(host.querySelector('img')).toBeNull()
    expect(host.querySelector('[aria-label="Checklist 1 dari 1"]')).not.toBeNull()
    expect(host.querySelectorAll('.tb-column')).toHaveLength(2)
  })

  it('updates cards reactively without replacing the host', async () => {
    const wrapper = mount({ board, view: 'active', week: '2026-11-23' })
    const element = wrapper.host.querySelector('.tb-card')
    wrapper.setProps({ board: { ...board, tasks: [{ ...board.tasks[0]!, title: 'Diubah' }] } })
    expect(wrapper.host.querySelector('.tb-card')).toBe(element)
    expect(wrapper.host.querySelector('h2')!.textContent).toBe('Diubah')
  })

  it('renders archives, editable list dates and seven-day timeline', async () => {
    const wrapper = mount({ board, view: 'archive', week: '2026-11-23' })
    expect(wrapper.host.querySelectorAll('.tb-archive-row')).toHaveLength(1)
    expect(wrapper.host.querySelector('[data-action="restoreBoardTask"]')!.getAttribute('data-arg')).toBe('two')
    wrapper.setProps({ view: 'list' })
    expect(wrapper.host.querySelector('[data-board-quick="due"]')!.getAttribute('min')).toBe('2026-11-23')
    expect(wrapper.host.querySelector('[data-board-quick="statusId"]')).toBeInstanceOf(HTMLSelectElement)
    wrapper.setProps({ view: 'timeline' })
    expect(wrapper.host.querySelectorAll('thead th')).toHaveLength(8)
    expect(wrapper.host.querySelector('.tb-timeline-bar')!.getAttribute('style')).toContain('grid-column: 1 / 4')
  })

  it('keeps empty and filtered-empty states distinct', () => {
    const empty = { ...board, tasks: [] }
    const wrapper = mount({ board: empty, view: 'active', week: '2026-11-23', filtering: false })
    expect(wrapper.host.textContent).toContain('Belum ada task')
    const filtered = mount({ board: empty, view: 'active', week: '2026-11-23', filtering: true })
    expect(filtered.host.textContent).toBe('')
  })
})
