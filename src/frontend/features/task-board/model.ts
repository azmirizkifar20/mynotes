import type { Task, TaskBoard } from '../../../shared/contracts/task-board'
import { descriptionParts } from '../../public/js/features/task-board/mention-text.js'

export const priorities = { low: 'Rendah', normal: 'Normal', high: 'Tinggi' }
export const taskCode = (task: Task) => 'T-' + String(task.number).padStart(3, '0')
export const taskTags = (board: TaskBoard, task: Task) => (board.tags || []).filter(tag => task.tagIds?.includes(tag.id))
export function todayDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
export const overdue = (board: TaskBoard, task: Task) => Boolean(task.due && task.due < todayDate() && !board.statuses.find(status => status.id === task.statusId)?.completed)
export const formatDate = (day: string, year = true, padded = false) => new Intl.DateTimeFormat('id-ID', {
  day: padded ? '2-digit' : 'numeric', month: 'short', ...(year ? { year: 'numeric' as const } : {}), timeZone: 'UTC',
}).format(new Date(day + 'T12:00:00Z'))

export function referenceCount(board: TaskBoard, task: Task) {
  const parts: Array<{ id?: string }> = descriptionParts((task.description || '') + '\n' + (task.result || ''))
  return new Set(parts.filter(part => part.id && board.documents.some(doc => doc.id === part.id)).map(part => part.id)).size
}

export function taskDates(task: Task, compact = false) {
  if (!task.startDate) return formatDate(task.due, !compact) + ' · Tanpa tanggal mulai'
  if (!task.due) return formatDate(task.startDate, !compact) + ' · Tanpa deadline'
  return formatDate(task.startDate, !compact) + (task.startDate === task.due ? '' : ' – ' + formatDate(task.due, !compact))
}
