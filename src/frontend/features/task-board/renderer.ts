import { h, render } from 'vue'
import type { BoardContentProps } from '../../../shared/contracts/task-board'
import BoardContent from './components/BoardContent.vue'

export function createBoardRenderer() {
  let host: HTMLElement | null = null
  function destroyTaskBoardView() {
    if (host) render(null, host)
    host = null
  }
  function renderBoardContent(target: HTMLElement, props: BoardContentProps) {
    if (host !== target) {
      destroyTaskBoardView()
      target.replaceChildren()
    }
    host = target
    render(h(BoardContent, props), host)
  }
  return { renderBoardContent, destroyTaskBoardView }
}
