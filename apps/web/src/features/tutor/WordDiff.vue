<script setup lang="ts">
import { computed } from 'vue'
import { diffWords } from '@/domain/transcriptWords'

const props = defineProps<{ before: string; after: string }>()

// diffWords lists the first text's words as "missing", which here means what the learner
// wrote and should change, and the second's as "extra", which is what replaces them.
const words = computed(() => diffWords(props.before, props.after).words)
</script>

<template>
  <p lang="en" data-testid="word-diff">
    <template v-for="(word, index) in words" :key="index">
      <del v-if="word.kind === 'missing'" class="text-muted">{{ word.word }}</del>
      <ins v-else-if="word.kind === 'extra'" class="font-semibold no-underline">{{ word.word }}</ins>
      <span v-else>{{ word.word }}</span>{{ ' ' }}
    </template>
  </p>
</template>
