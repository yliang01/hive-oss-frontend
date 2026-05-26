<template>
  <span>
    <template v-for="(part, idx) in parts" :key="idx">
      <mark v-if="part.highlight">{{ part.text }}</mark>
      <span v-else>{{ part.text }}</span>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  text?: string
  keyword?: string
  maxLength?: number
}>(), {
  text: '',
  keyword: '',
  maxLength: 40,
})

function truncate(value: string, len: number) {
  if (value.length <= len) return value
  return value.slice(0, Math.floor(len * 0.6)) + '...' + value.slice(-Math.floor(len * 0.4))
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const parts = computed(() => {
  const text = truncate(props.text || '', props.maxLength)
  const keyword = props.keyword.trim()
  if (!keyword) return [{ text, highlight: false }]

  const re = new RegExp(`(${escapeRegExp(keyword)})`, 'gi')
  return text.split(re).filter(Boolean).map(part => ({
    text: part,
    highlight: part.toLowerCase() === keyword.toLowerCase(),
  }))
})
</script>
