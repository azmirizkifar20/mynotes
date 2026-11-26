<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { TodoItem, TodayContentProps, TodayTask as Task } from '../../../shared/contracts/today'
import Icon from '../../components/ui/Icon.vue'
import TodoRow from './TodoRow.vue'

const props = defineProps<TodayContentProps>()
const text = ref(''), localError = ref(''), announcement = ref(''), completedOpen = ref(true)
const input = ref<HTMLInputElement | null>(null), undoButton = ref<HTMLButtonElement | null>(null)
const active = computed(() => props.today.todos.filter(todo => !todo.done))
const completed = computed(() => props.today.todos.filter(todo => todo.done))
const percent = computed(() => props.today.todos.length ? Math.round(completed.value.length / props.today.todos.length * 100) : 0)
const focus = computed(() => props.today.focusIds.map(id => props.today.tasks.find(task => task.id === id)).filter((task): task is Task => Boolean(task)))
const groups = computed(() => {
  const tasks = [...props.today.tasks].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || Number(b.priority === 'high') - Number(a.priority === 'high') || Number(a.number) - Number(b.number))
  return [
    { key: 'due', title: 'Deadline hari ini', tasks: tasks.filter(task => task.due === props.today.day), empty: 'Tidak ada Deadline hari ini.' },
    { key: 'overdue', title: 'Lewat Deadline', tasks: tasks.filter(task => task.due && task.due < props.today.day), empty: 'Tidak ada task yang terlambat.' },
    { key: 'progress', title: 'Sedang dikerjakan', tasks: tasks.filter(task => props.today.statuses.find(status => status.id === task.statusId)?.inProgress), empty: 'Belum ada task berstatus Dikerjakan.' },
  ]
})
const statusOf = (task: Task) => props.today.statuses.find(status => status.id === task.statusId)
const dateLabel = (day: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(day + 'T12:00:00Z'))
const taskCode = (task: Task) => 'T-' + String(task.number).padStart(3, '0')

async function add() {
  if (props.busy) return
  const value = text.value.trim()
  if (!value) { localError.value = 'Tulis isi to-do terlebih dahulu.'; input.value?.focus(); return }
  localError.value = ''
  if (await props.createTodo(value)) { text.value = ''; announcement.value = 'To-do ditambahkan.' }
  await nextTick()
  input.value?.focus()
}
async function complete(todo: TodoItem, done: boolean) {
  if (props.busy) return
  if (done) completedOpen.value = true
  const saved = await props.completeTodo(todo, done)
  await nextTick()
  // A failed request must restore the native checkbox even when its prop stayed unchanged.
  const checkbox = document.querySelector<HTMLInputElement>(`[data-todo-check="${todo.id}"]`)
  if (checkbox) { checkbox.checked = props.today.todos.find(item => item.id === todo.id)?.done ?? todo.done; checkbox.focus() }
  if (saved) announcement.value = done ? 'To-do selesai.' : 'To-do dikembalikan ke daftar aktif.'
}
async function remove(todo: TodoItem) {
  if (props.busy) return
  if (await props.deleteTodo(todo)) { announcement.value = 'To-do dihapus. Kamu bisa mengurungkannya.'; await nextTick(); undoButton.value?.focus() }
}
async function restore() {
  const id = props.undo?.id
  if (!id || props.busy) return
  if (await props.undoDelete()) {
    completedOpen.value = true
    await nextTick()
    document.querySelector<HTMLInputElement>(`[data-todo-check="${id}"]`)?.focus()
    announcement.value = 'To-do dipulihkan.'
  }
}
watch(() => props.undo, async (value, previous) => {
  if (!value && previous && document.activeElement?.closest('.today-todo-toast')) { await nextTick(); input.value?.focus() }
})
</script>

<template>
  <div class="today-columns">
    <section class="today-todo-panel" aria-labelledby="today-todo-title" :aria-busy="busy">
      <header class="today-todo-heading">
        <div class="today-section-title"><h2 id="today-todo-title">To-do hari ini</h2><span class="today-count">{{ completed.length }}/{{ today.todos.length }} selesai</span></div>
        <p>Catat hal kecil yang ingin kamu selesaikan hari ini.</p>
        <div class="today-todo-progress" role="progressbar" aria-label="To-do selesai" :aria-valuenow="percent" :aria-valuetext="`${completed.length} dari ${today.todos.length} to-do selesai`" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: `${percent}%` }"></span></div>
      </header>
      <form class="today-todo-form" @submit.prevent="add">
        <Icon name="plus" /><label class="sr-only" for="today-todo-input">To-do baru</label>
        <input id="today-todo-input" ref="input" v-model="text" :disabled="busy" placeholder="Apa yang mau diselesaikan?" maxlength="200" autocomplete="off" required @input="localError = ''">
        <button class="small-button primary" type="submit" :disabled="busy">{{ busy ? 'Tunggu…' : 'Tambah' }}</button>
      </form>
      <p v-if="localError || error" class="today-todo-error" role="alert">{{ localError || error }}</p>
      <ul class="today-todo-list" aria-label="To-do belum selesai"><TodoRow v-for="todo in active" :key="todo.id" :todo="todo" :busy="busy" @complete="complete" @remove="remove" /></ul>
      <div v-if="!today.todos.length" class="today-todo-empty"><strong>Belum ada to-do.</strong><p>Tulis satu hal yang ingin kamu kerjakan lewat kolom di atas.</p></div>
      <div v-else-if="!active.length" class="today-todo-empty"><strong>Semua to-do sudah selesai.</strong><p>Kamu bisa menambah item atau membuka kembali to-do di bagian Selesai.</p></div>
      <section v-if="completed.length" class="today-todo-completed">
        <button class="today-todo-completed-toggle" type="button" :aria-expanded="completedOpen" aria-controls="today-completed-todos" @click="completedOpen = !completedOpen"><Icon name="chevron" :class="{ 'is-open': completedOpen }" /><span>Selesai ({{ completed.length }})</span></button>
        <ul id="today-completed-todos" class="today-todo-list" aria-label="To-do selesai" :hidden="!completedOpen"><TodoRow v-for="todo in completed" :key="todo.id" :todo="todo" :busy="busy" @complete="complete" @remove="remove" /></ul>
      </section>
      <footer class="today-todo-footer">To-do ini terpisah dari task board.</footer>
    </section>
    <aside class="today-context" aria-label="Task dari task board">
      <section class="today-context-section">
        <header><h2>Fokus hari ini <span>{{ focus.length }}/3</span></h2><button class="today-text-button" type="button" :disabled="busy" @click="chooseFocus">Pilih fokus</button></header>
        <div class="today-focus-list">
          <button v-for="task in focus" :key="task.id" class="today-context-task" type="button" :disabled="busy" @click="openTask(task.id)">
            <span class="today-context-copy"><span class="today-context-code">{{ taskCode(task) }}</span><span class="today-context-title">{{ task.title }}</span><span class="today-context-meta"><span class="today-context-status" :data-tone="statusOf(task)?.tone">{{ statusOf(task)?.name }}</span><span v-if="task.due">· {{ dateLabel(task.due) }}</span></span></span><Icon name="chevron" />
          </button>
          <p v-if="!focus.length" class="today-context-empty">Belum ada fokus. Klik Pilih fokus untuk memilih task.</p>
        </div>
        <p class="today-focus-note">Pilih hingga 3 task dari task board untuk jadi fokus hari ini.</p>
      </section>
      <section class="today-context-section">
        <header><h2>Dari task board</h2></header>
        <div class="today-agenda">
          <details v-for="group in groups" :key="group.key" :data-today-group="group.key" :open="group.key === 'due'">
            <summary><Icon name="chevron" /><span :class="{ 'today-is-late': group.key === 'overdue' }">{{ group.title }}</span><span class="today-count">{{ group.tasks.length }}</span></summary>
            <button v-for="task in group.tasks" :key="task.id" type="button" class="today-context-task" :disabled="busy" @click="openTask(task.id)"><span class="today-context-copy"><span class="today-context-code">{{ taskCode(task) }}</span><span class="today-context-title">{{ task.title }}</span><span class="today-context-meta" :class="{ 'today-is-late': group.key === 'overdue' }">{{ group.key === 'progress' ? statusOf(task)?.name : task.due ? 'Deadline ' + dateLabel(task.due) : '' }}</span></span><Icon name="chevron" /></button>
            <p v-if="!group.tasks.length" class="today-context-empty">{{ group.empty }}</p>
          </details>
        </div>
        <footer class="today-context-footer"><span>Task tetap dikelola di task board.</span><button class="today-text-button" type="button" :disabled="busy" @click="openBoard">Buka papan →</button></footer>
      </section>
    </aside>
  </div>
  <div v-if="undo" class="today-todo-toast"><span role="status">To-do dihapus.</span><button ref="undoButton" type="button" :disabled="busy" @click="restore">Urungkan</button><button type="button" :disabled="busy" aria-label="Tutup notifikasi" @click="dismissUndo"><Icon name="close" /></button></div>
  <span class="sr-only" role="status" aria-live="polite">{{ announcement }}</span>
</template>
