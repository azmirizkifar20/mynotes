import type { Task, TaskStatus } from './task-board'

export type TodayTask = Pick<Task, 'id' | 'number' | 'title' | 'statusId' | 'priority' | 'due' | 'startDate'>

export interface TodoItem {
  id: string
  text: string
  done: boolean
  revision: number
  createdAt: string
}

export interface TodaySnapshot {
  day: string
  token: string | null
  focusIds: string[]
  statuses: TaskStatus[]
  tasks: TodayTask[]
  todos: TodoItem[]
}

export interface TodoUndo {
  id: string
  revision: number
}

export interface TodayContentProps {
  today: TodaySnapshot
  busy: boolean
  error: string
  undo: TodoUndo | null
  createTodo(text: string): Promise<boolean>
  completeTodo(todo: TodoItem, done: boolean): Promise<boolean>
  deleteTodo(todo: TodoItem): Promise<boolean>
  undoDelete(): Promise<boolean>
  dismissUndo(): void
  chooseFocus(): void
  openTask(id: string): void
  openBoard(): void
}
