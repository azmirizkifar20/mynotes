import { h, render } from 'vue'
import type { TodayContentProps } from '../../../shared/contracts/today'
import TodayContent from './TodayContent.vue'

export function createTodayRenderer() {
  let host: HTMLElement | null = null
  function destroyTodayView() {
    if (host) render(null, host)
    host = null
  }
  function renderTodayContent(target: HTMLElement, props: TodayContentProps) {
    if (host !== target) {
      destroyTodayView()
      target.replaceChildren()
    }
    host = target
    render(h(TodayContent, props), host)
  }
  return { renderTodayContent, destroyTodayView }
}
