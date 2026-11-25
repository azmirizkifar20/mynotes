<script setup lang="ts">
import { computed } from 'vue'
import type { Task, TaskBoard } from '../../../../shared/contracts/task-board'
import { formatDate, overdue, referenceCount, taskCode, taskTags } from '../model'
import Icon from '../../../components/ui/Icon.vue'
import TaskTags from './TaskTags.vue'

const props = defineProps<{ board: TaskBoard; task: Task }>()
const late = computed(() => overdue(props.board, props.task))
const completed = computed(() => props.board.statuses.find(status => status.id === props.task.statusId)?.completed)
const date = computed(() => props.task.due || props.task.startDate || '')
const prefix = computed(() => !props.task.due ? 'Mulai ' : late.value ? 'Lewat · ' : completed.value ? 'Deadline ' : '')
const references = computed(() => referenceCount(props.board, props.task))
const attachments = computed(() => props.task.attachments?.length || 0)
const result = computed(() => Boolean(props.task.result?.trim()))
const checklist = computed(() => props.task.checklist || [])
const done = computed(() => checklist.value.filter(item => item.done).length)
</script>

<template>
  <article class="tb-card" draggable="true" :data-board-task="task.id">
    <button class="tb-card-open" data-action="openBoardTask" :data-arg="task.id" :aria-label="`Edit ${task.title}`"><h2>{{ task.title }}</h2></button>
    <div v-if="taskTags(board, task).length || date" class="tb-card-context"><TaskTags :board="board" :task="task" /><span v-if="date" class="tb-date" :class="{ 'tb-overdue': late }" :title="`${task.due ? 'Deadline ' : 'Mulai '}${formatDate(date, false)}`">{{ prefix }}{{ formatDate(date, false) }}</span></div>
    <div class="tb-card-meta"><span class="tb-task-code">{{ taskCode(task) }}</span><span v-if="task.priority === 'high'" class="tb-priority tb-priority-high">Tinggi</span><span v-if="references || attachments || result || checklist.length" class="tb-card-resources"><span v-if="checklist.length" class="tb-linked" :aria-label="`Checklist ${done} dari ${checklist.length}`"><Icon name="check" />{{ done }}/{{ checklist.length }}</span><span v-if="references" class="tb-linked" :aria-label="`${references} dokumen disebut`" :title="`${references} dokumen disebut`"><Icon name="doc" />{{ references }}</span><span v-if="attachments" class="tb-linked" :aria-label="`${attachments} lampiran`" :title="`${attachments} lampiran`"><Icon name="attachment" />{{ attachments }}</span><span v-if="result" class="tb-linked" role="img" aria-label="Hasil task sudah diisi" title="Hasil task sudah diisi"><Icon name="check" /></span></span></div>
  </article>
</template>
