<script setup lang="ts">
import EntrySummary from './EntrySummary.vue'
import { useLibraryStore } from './libraryStore'

const library = useLibraryStore()
</script>

<template>
  <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
    <li
      v-for="entry in library.visibleEntries"
      :key="entry.id"
      class="rounded-card border border-line bg-surface p-4 transition-colors hover:border-muted"
      data-testid="entry"
    >
      <EntrySummary :entry="entry" />
    </li>
  </ul>
</template>
