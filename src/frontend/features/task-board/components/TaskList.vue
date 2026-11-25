<script setup lang="ts">
import type { Task, TaskBoard } from '../../../../shared/contracts/task-board'
import { formatDate, overdue, priorities, taskCode } from '../model'
import TaskTags from './TaskTags.vue'
import Icon from '../../../components/ui/Icon.vue'
defineProps<{ board: TaskBoard; tasks: Task[] }>()
const dateKeys = ['startDate', 'due'] as const
const dateText = (value?: string) => value ? formatDate(value, true, true) : 'Belum diatur'
const dateLabel = (key: string) => key === 'due' ? 'Deadline' : 'Tanggal mulai'
</script>

<template>
  <div class="tb-list-wrap"><table class="tb-list"><thead><tr><th>Task</th><th>Status</th><th>Prioritas</th><th>Mulai</th><th>Deadline</th><th>Checklist</th></tr></thead><tbody>
    <tr v-for="task in tasks" :key="task.id"><td><button class="tb-list-title" data-action="openBoardTask" :data-arg="task.id">{{ task.title }}</button><div class="tb-list-meta"><small>{{ taskCode(task) }}</small><TaskTags :board="board" :task="task" /></div></td><td><select :value="task.statusId" data-board-quick="statusId" :data-task-id="task.id" :aria-label="`Status ${task.title}`"><option v-for="status in board.statuses" :key="status.id" :value="status.id" :data-tone="status.tone">{{ status.name }}</option></select></td><td :class="{ 'tb-priority-high': task.priority === 'high' }">{{ priorities[task.priority] }}</td>
      <td v-for="key in dateKeys" :key="key"><span class="tb-list-date"><button type="button" class="tb-list-date-button" :class="{ 'is-empty': !task[key], 'is-late': key === 'due' && overdue(board, task) }" :data-board-date="key" :aria-label="`${dateLabel(key)} ${task.title}: ${dateText(task[key])}${key === 'due' && overdue(board, task) ? ' · Lewat deadline' : ''}`" :title="dateText(task[key]) + (key === 'due' && overdue(board, task) ? ' · Lewat deadline' : '')"><span>{{ dateText(task[key]) }}</span><Icon name="calendar" /></button><input class="tb-list-date-input" type="date" tabindex="-1" aria-hidden="true" :value="task[key] || ''" :data-board-quick="key" :data-task-id="task.id" :aria-label="`${dateLabel(key)} ${task.title}`" :max="key === 'startDate' ? task.due || undefined : undefined" :min="key === 'due' ? task.startDate || undefined : undefined"></span></td>
      <td>{{ task.checklist?.length ? `${task.checklist.filter(item => item.done).length}/${task.checklist.length}` : '—' }}</td></tr>
  </tbody></table></div>
</template>
