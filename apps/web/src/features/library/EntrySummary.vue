<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Entry } from '@/domain/types'
import PriorityBars from '@/shared/ui/PriorityBars.vue'
import StatusBadge from '@/shared/ui/StatusBadge.vue'
import TagBadge from '@/shared/ui/TagBadge.vue'
import EnrichmentBadge from '@/features/enrichment/EnrichmentBadge.vue'
import { importanceVisual, kindVisual } from './fieldVisuals'
import { useLibraryStore } from './libraryStore'

const props = defineProps<{ entry: Entry; hideStatus?: boolean }>()
const { t } = useI18n()
const library = useLibraryStore()

const summary = computed(() => props.entry.meanings[0] ?? props.entry.custom.whatItDoes)
</script>

<template>
  <!--
    Clicking anywhere opens the entry, while the title button gives keyboards and screen
    readers the same action. The body can't itself be a button: Firefox won't start a
    drag from inside one, which would break the Kanban board.
  -->
  <div class="min-w-0 cursor-pointer" @click="library.editing = entry">
    <button
      type="button"
      class="block w-full rounded text-left font-medium wrap-break-word"
      :aria-label="t('library.open', { name: entry.text })"
      @click.stop="library.editing = entry"
    >
      {{ entry.text }}
    </button>
    <p class="mt-2 flex flex-wrap items-center gap-1.5">
      <PriorityBars v-if="entry.priority" :priority="entry.priority" />
      <TagBadge
        v-if="entry.kind"
        :label="entry.kind"
        :icon="kindVisual(entry.kind).icon"
        :color="kindVisual(entry.kind).color"
      />
      <TagBadge
        v-if="entry.importance"
        :label="entry.importance"
        :icon="importanceVisual(entry.importance).icon"
        :color="importanceVisual(entry.importance).color"
      />
      <EnrichmentBadge :entry="entry" />
      <StatusBadge v-if="entry.enrichment === 'confirmed' && !hideStatus" :status="entry.status" />
    </p>
    <p v-if="summary" class="mt-2 line-clamp-3 text-sm whitespace-pre-line text-muted">{{ summary }}</p>
    <p
      v-if="library.activeDeck?.schema.languageFeatures && entry.enrichment === 'confirmed' && !entry.ownExamples.length"
      class="mt-2 text-sm text-accent italic"
    >
      {{ t('library.ownExamplePrompt') }}
    </p>
  </div>
</template>
