export type StatusTone = 'neutral' | 'blue' | 'amber' | 'green' | 'red'
export type TaskPriority = 'low' | 'normal' | 'high'
export type BoardView = 'active' | 'timeline' | 'list' | 'archive'

export interface TaskStatus {
  id: string
  name: string
  tone: StatusTone
  completed: boolean
  inProgress?: boolean
  position?: number
}

export interface TaskTag { id: string; name: string }
export interface DocumentReference { id: string; path: string }
export interface ChecklistItem { id: string; text: string; done: boolean }
export interface TaskAttachment {
  id: string
  filename: string
  size: number
  mime?: string
  createdAt?: string
}

export interface Task {
  id: string
  number: number | string
  title: string
  description: string
  result?: string
  statusId: string
  priority: TaskPriority
  startDate?: string
  due: string
  tagIds?: string[]
  checklist?: ChecklistItem[]
  attachments?: TaskAttachment[]
  archivedAt?: string | null
}

export interface TaskBoard {
  revision: number
  statuses: TaskStatus[]
  tags: TaskTag[]
  documents: DocumentReference[]
  tasks: Task[]
}

export interface BoardContentProps {
  board: TaskBoard
  view: BoardView
  week: string
  filtering?: boolean
}

export interface TaskBoardResponse { success: true; board: TaskBoard }
