<script setup lang="ts">
import { PenLine } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { cellOf } from '@/domain/rows'
import { parseArrowList } from '@/domain/text'
import type { Entry, FieldDef } from '@/domain/types'
import EnrichmentBadge from '@/features/enrichment/EnrichmentBadge.vue'
import PriorityBars from '@/shared/ui/PriorityBars.vue'
import StatusBadge from '@/shared/ui/StatusBadge.vue'
import TagBadge from '@/shared/ui/TagBadge.vue'
import {
  FIELD_ICONS,
  colorFor,
  contextIcon,
  importanceVisual,
  isCodeField,
  kindVisual,
  toneColor,
  triggerIcon,
} from './fieldVisuals'

const props = defineProps<{ entry: Entry; field: FieldDef }>()
const { t } = useI18n()

/** More than this would make every row tall. The editor always shows the whole list. */
const MAX_LIST_ITEMS = 2

const value = computed(() => cellOf(props.entry, props.field))
const target = computed(() => props.field.target)

const items = computed(() => (props.field.type === 'list' ? parseArrowList(value.value) : []))
const shownItems = computed(() => items.value.slice(0, MAX_LIST_ITEMS))
const hiddenCount = computed(() => items.value.length - shownItems.value.length)

const sourceLabel = computed(() => props.entry.source.title ?? props.entry.source.url ?? '')
</script>

<template>
  <PriorityBars v-if="target === 'priority'" :priority="entry.priority" />

  <span v-else-if="target === 'text'" class="flex flex-col items-start gap-1">
    <span class="font-medium wrap-break-word">{{ value }}</span>
    <EnrichmentBadge :entry="entry" />
  </span>

  <StatusBadge v-else-if="target === 'status'" :status="value" />

  <span v-else-if="!value && target === 'ownExamples'" class="inline-flex items-center gap-1.5 text-xs text-accent italic">
    <PenLine :size="13" aria-hidden="true" class="shrink-0" />
    {{ t('library.ownExamplePrompt') }}
  </span>

  <span v-else-if="!value" class="text-line" aria-hidden="true">—</span>

  <TagBadge
    v-else-if="target === 'kind'"
    :label="value"
    :icon="kindVisual(value).icon"
    :color="kindVisual(value).color"
  />
  <TagBadge v-else-if="target === 'tone'" :label="value" :color="toneColor(value)" />
  <TagBadge v-else-if="target === 'context'" plain :label="value" :icon="contextIcon(value)" />
  <TagBadge v-else-if="target === 'trigger'" plain :label="value" :icon="triggerIcon(value)" />
  <TagBadge
    v-else-if="target === 'importance'"
    :label="value"
    :icon="importanceVisual(value).icon"
    :color="importanceVisual(value).color"
  />
  <TagBadge v-else-if="target === 'source'" plain :label="sourceLabel" :icon="FIELD_ICONS.source" />
  <TagBadge v-else-if="field.key === 'category'" :label="value" :color="colorFor(value)" />

  <span v-else-if="field.type === 'list'" class="flex flex-col gap-1">
    <span v-for="(item, index) in shownItems" :key="index" class="flex gap-2">
      <span class="mt-[0.45em] size-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
      <span class="line-clamp-2 min-w-0 wrap-break-word whitespace-pre-line">{{ item }}</span>
    </span>
    <span v-if="hiddenCount" class="ml-3 text-xs text-muted">{{ t('library.moreItems', { n: hiddenCount }) }}</span>
  </span>

  <code
    v-else-if="isCodeField(field.key)"
    class="line-clamp-4 rounded bg-raised px-1.5 py-0.5 font-mono text-xs wrap-break-word whitespace-pre-line"
  >{{ value }}</code>

  <span v-else class="line-clamp-3 wrap-break-word whitespace-pre-line">{{ value }}</span>
</template>
