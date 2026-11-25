<script setup lang="ts">
import { computed } from 'vue'
import type { BoardContentProps } from '../../../../shared/contracts/task-board'
import TaskCard from './TaskCard.vue'
import TaskList from './TaskList.vue'
import TaskTags from './TaskTags.vue'
import TaskTimeline from './TaskTimeline.vue'
import Button from '../../../components/ui/button/Button.vue'
import Icon from '../../../components/ui/Icon.vue'
import { taskCode } from '../model'

const props = defineProps<BoardContentProps>()
const tasks = computed(() => props.board.tasks.filter(task => Boolean(task.archivedAt) === (props.view === 'archive')))
</script>

<template>
  <template v-if="tasks.length">
    <div v-if="view === 'archive'" class="tb-archive-list"><div class="tb-archive-head">Task diarsipkan · tidak ditampilkan di papan aktif</div><article v-for="task in tasks" :key="task.id" class="tb-archive-row" :data-board-task="task.id"><div><button class="tb-card-open" data-action="openBoardTask" :data-arg="task.id" :aria-label="`Lihat arsip ${task.title}`"><h2>{{ task.title }}</h2></button><small class="tb-task-code">{{ taskCode(task) }}</small><TaskTags :board="board" :task="task" :limit="2" /></div><span class="tb-status-chip tb-status-badge" :data-tone="board.statuses.find(status => status.id === task.statusId)?.tone"><i class="tb-dot" aria-hidden="true"></i>{{ board.statuses.find(status => status.id === task.statusId)?.name }}</span><span class="tb-archive-date">{{ new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(task.archivedAt!)) }}</span><Button data-action="restoreBoardTask" :data-arg="task.id" :aria-label="`Pulihkan ${task.title}`">Pulihkan</Button></article></div>
    <TaskTimeline v-else-if="view === 'timeline'" :board="board" :tasks="tasks" :week="week" />
    <TaskList v-else-if="view === 'list'" :board="board" :tasks="tasks" />
    <template v-else><section v-for="status in board.statuses" :key="status.id" class="tb-column" :data-board-status="status.id" :aria-label="status.name"><div class="tb-column-head"><span class="tb-status-chip" :data-tone="status.tone"><i class="tb-dot" aria-hidden="true"></i><span>{{ status.name }}</span></span><span class="tb-column-count">{{ tasks.filter(task => task.statusId === status.id).length }}</span><Button variant="icon" data-action="openBoardTask" data-arg="" :data-arg1="status.id" :aria-label="`Tambah task di ${status.name}`"><Icon name="plus" /></Button></div><div class="tb-cards"><TaskCard v-for="task in tasks.filter(task => task.statusId === status.id)" :key="task.id" :board="board" :task="task" /><p v-if="!tasks.some(task => task.statusId === status.id)" class="tb-empty-column">Belum ada task di status ini.</p></div></section></template>
  </template>
  <div v-else-if="!filtering" class="tb-empty-state"><h2>{{ view === 'archive' ? 'Arsip masih kosong' : 'Belum ada task' }}</h2><p>{{ view === 'archive' ? 'Arsipkan task selesai secara manual dari detail task.' : 'Mulai dengan pekerjaan pertama. Detail, jadwal dan tag bisa ditambahkan nanti.' }}</p><Button v-if="view !== 'archive'" variant="primary" data-action="openBoardTask">Tambah task</Button></div>
</template>
