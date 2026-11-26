import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, render } from 'vue'
import type { TodayContentProps } from '../../src/shared/contracts/today'
import TodayContent from '../../src/frontend/features/today/TodayContent.vue'

const hosts: HTMLElement[] = []
afterEach(() => { for (const host of hosts.splice(0)) { render(null, host); host.remove() } })
function mount() {
  const host = document.createElement('div')
  document.body.append(host); hosts.push(host)
  let props: TodayContentProps = {
    today: { day: '2026-11-25', token: null, focusIds: [], tasks: [], statuses: [], todos: [
      { id: 'one', text: '<img src=x onerror=alert(1)>', done: false, revision: 1, createdAt: '2026-11-25' },
      { id: 'two', text: 'Selesai', done: true, revision: 1, createdAt: '2026-11-25' },
    ] },
    busy: false, error: '', undo: null,
    createTodo: vi.fn(async () => false), completeTodo: vi.fn(async () => false), deleteTodo: vi.fn(async () => false), undoDelete: vi.fn(async () => false),
    dismissUndo: vi.fn(), chooseFocus: vi.fn(), openTask: vi.fn(), openBoard: vi.fn(),
  }
  const update = (value: Partial<TodayContentProps> = {}) => { props = { ...props, ...value }; render(h(TodayContent, props), host) }
  update()
  return { host, props, update }
}
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 0)); await nextTick() }

describe('Today to-dos', () => {
  it('escapes text, shows progress and collapses completed items', async () => {
    const { host } = mount()
    expect(host.querySelector('img')).toBeNull()
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(host.querySelector('[role=progressbar]')!.getAttribute('aria-valuenow')).toBe('50')
    const toggle = host.querySelector<HTMLButtonElement>('.today-todo-completed-toggle')!
    toggle.click(); await nextTick()
    expect(host.querySelector<HTMLElement>('#today-completed-todos')!.hidden).toBe(true)
  })
  it('preserves text after a failed creation and after polling updates', async () => {
    const { host, props, update } = mount()
    const input = host.querySelector<HTMLInputElement>('#today-todo-input')!
    input.value = 'Catatan baru'; input.dispatchEvent(new Event('input', { bubbles: true }))
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await flush()
    expect(props.createTodo).toHaveBeenCalledWith('Catatan baru')
    expect(input.value).toBe('Catatan baru')
    update({ today: { ...props.today, todos: [] }, error: 'Sambungan gagal' }); await nextTick()
    expect(host.querySelector('#today-todo-input')).toBe(input)
    expect(input.value).toBe('Catatan baru')
    expect(host.querySelector('[role=alert]')!.textContent).toBe('Sambungan gagal')
  })
  it('restores the native checkbox after a failed completion request', async () => {
    const { host, props } = mount()
    const checkbox = host.querySelector<HTMLInputElement>('[data-todo-check=one]')!
    checkbox.checked = true; checkbox.dispatchEvent(new Event('change', { bubbles: true })); await flush()
    expect(props.completeTodo).toHaveBeenCalledWith(props.today.todos[0], true)
    expect(checkbox.checked).toBe(false)
  })
  it('keeps empty and all-done states distinct and displays undo only for a successful deletion', async () => {
    const { host, props, update } = mount()
    update({ today: { ...props.today, todos: [] } }); await nextTick()
    expect(host.textContent).toContain('Belum ada to-do.')
    update({ today: { ...props.today, todos: [props.today.todos[1]!] }, undo: { id: 'one', revision: 2 } }); await nextTick()
    expect(host.textContent).toContain('Semua to-do sudah selesai.')
    expect(host.querySelector('.today-todo-toast')!.textContent).toContain('Urungkan')
    update({ busy: true }); await nextTick()
    expect(host.querySelector<HTMLInputElement>('#today-todo-input')!.disabled).toBe(true)
    expect(host.querySelector<HTMLButtonElement>('.today-todo-delete')!.disabled).toBe(true)
  })
})
