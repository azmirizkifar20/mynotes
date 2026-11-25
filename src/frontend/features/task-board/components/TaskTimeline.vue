<script setup lang="ts">
import { computed } from 'vue'
import type { Task, TaskBoard } from '../../../../shared/contracts/task-board'
import { weekModel } from '../../../public/js/features/task-board/timeline.js'
import { formatDate, taskCode, taskDates, todayDate } from '../model'
import Button from '../../../components/ui/button/Button.vue'
import Icon from '../../../components/ui/Icon.vue'

const props = defineProps<{ board: TaskBoard; tasks: Task[]; week: string }>()
const model = computed(() => weekModel(props.tasks, props.week))
const heading = computed(() => formatDate(model.value.first, model.value.first.slice(0, 4) !== model.value.last.slice(0, 4)) + ' – ' + formatDate(model.value.last))
const days = computed(() => Array.from({ length: model.value.days }, (_, index) => {
  const date = new Date(model.value.first + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + index)
  return { day: index + 1, number: date.getUTCDate(), label: new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' }).format(date), weekend: [0, 6].includes(date.getUTCDay()), today: date.toISOString().slice(0, 10) === todayDate() }
}))
const today = computed(() => days.value.find(day => day.today)?.day)
const statusOf = (task: Task) => props.board.statuses.find(status => status.id === task.statusId)!
const label = (task: Task) => task.title + ' · ' + statusOf(task).name + ' · ' + taskDates(task)
</script>

<template>
  <div class="tb-timeline-controls"><div><h2>{{ heading }}</h2><p>{{ model.scheduled.length }} terjadwal minggu ini · Senin–Minggu</p></div><div class="tb-week-nav"><Button variant="icon" data-action="moveBoardWeek" data-arg="-1" aria-label="Minggu sebelumnya" :disabled="model.first === '0001-01-01'"><Icon name="chevron" /></Button><input id="board-timeline-week" type="date" class="text-input" :value="model.first" min="0001-01-01" max="9999-12-31" aria-label="Pilih tanggal dalam minggu timeline"><Button variant="icon" data-action="moveBoardWeek" data-arg="1" aria-label="Minggu berikutnya" :disabled="model.last === '9999-12-31'"><Icon name="chevron" /></Button><Button data-action="moveBoardWeek" data-arg="today">Minggu ini</Button></div></div>
  <div v-if="model.scheduled.length" class="tb-timeline-scroll" tabindex="0" role="region" :aria-label="`Jadwal task ${heading}. Geser untuk melihat tanggal lainnya.`"><table class="tb-timeline-table" :style="{ '--days': model.days }"><caption class="sr-only">Jadwal task {{ heading }}. Klik nama atau bar untuk membuka detail.</caption><colgroup><col class="tb-timeline-name-col"><col :span="model.days"></colgroup><thead><tr><th scope="col" class="tb-timeline-label">Task &amp; jadwal</th><th v-for="day in days" :key="day.day" scope="col" :class="{ 'tb-weekend': day.weekend, 'tb-today': day.today }"><span>{{ day.label }}</span><b>{{ day.number }}</b></th></tr></thead><tbody>
    <tr v-for="row in model.scheduled" :key="row.task.id"><th scope="row" class="tb-timeline-label"><button data-action="openBoardTask" :data-arg="row.task.id" class="tb-timeline-title">{{ row.task.title }}</button><small :title="taskDates(row.task)">{{ taskCode(row.task) }} · {{ taskDates(row.task, true) }}</small></th><td :colspan="model.days"><div class="tb-timeline-track"><span v-if="today" class="tb-today-line" :style="{ gridColumn: today }" aria-hidden="true"></span><button data-action="openBoardTask" :data-arg="row.task.id" class="tb-timeline-bar tb-status-chip" :class="{ 'tb-timeline-point': !row.task.startDate || !row.task.due }" :data-tone="statusOf(row.task).tone" :style="{ gridColumn: `${row.columns[0]} / ${row.columns[1]}` }" :title="label(row.task)" :aria-label="label(row.task)"><span aria-hidden="true">{{ !row.task.startDate || !row.task.due ? '◆ ' : '' }}{{ statusOf(row.task).name }}</span></button></div></td></tr>
  </tbody></table></div>
  <p v-else class="tb-empty-column">Tidak ada jadwal pada minggu ini. Pilih minggu lain atau tambahkan tanggal di detail task.</p>
  <details v-if="model.undated.length" class="tb-unscheduled"><summary>Belum dijadwalkan · {{ model.undated.length }} task</summary><div><div v-for="task in model.undated" :key="task.id" class="tb-unscheduled-task"><button data-action="openBoardTask" :data-arg="task.id" class="tb-timeline-title">{{ task.title }}</button><span class="tb-status-chip" :data-tone="statusOf(task).tone"><i class="tb-dot" aria-hidden="true"></i>{{ statusOf(task).name }}</span></div></div></details>
</template>
