<script setup lang="ts">
import { computed } from 'vue'
import type { Task, TaskBoard } from '../../../../shared/contracts/task-board'
import { taskTags } from '../model'
const props = withDefaults(defineProps<{ board: TaskBoard; task: Task; limit?: number }>(), { limit: 1 })
const tags = computed(() => taskTags(props.board, props.task))
const extra = computed(() => tags.value.slice(props.limit).map(tag => tag.name).join(', '))
</script>

<template>
  <ul v-if="tags.length" class="tb-tags" aria-label="Tag task">
    <li v-for="tag in tags.slice(0, limit)" :key="tag.id" :title="tag.name">{{ tag.name }}</li>
    <li v-if="tags.length > limit" class="tb-tag-more" :title="extra"><span aria-hidden="true">+{{ tags.length - limit }}</span><span class="sr-only">Tag lainnya: {{ extra }}</span></li>
  </ul>
</template>
