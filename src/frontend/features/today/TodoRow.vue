<script setup lang="ts">
import type { TodoItem } from '../../../shared/contracts/today'
import Icon from '../../components/ui/Icon.vue'

defineProps<{ todo: TodoItem; busy: boolean }>()
const emit = defineEmits<{ complete: [todo: TodoItem, done: boolean]; remove: [todo: TodoItem] }>()
</script>

<template>
  <li class="today-todo-row" :class="{ 'is-done': todo.done }">
    <label class="today-todo-label">
      <input class="today-todo-check" type="checkbox" :checked="todo.done" :disabled="busy" :data-todo-check="todo.id" @change="emit('complete', todo, ($event.target as HTMLInputElement).checked)">
      <span class="today-todo-text">{{ todo.text }}</span>
    </label>
    <button type="button" class="today-icon-button today-todo-delete" :disabled="busy" :aria-label="`Hapus to-do: ${todo.text}`" title="Hapus to-do" @click="emit('remove', todo)"><Icon name="trash" /></button>
  </li>
</template>
