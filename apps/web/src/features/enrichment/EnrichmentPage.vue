<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import type { Entry } from '@/domain/types'
import { useLibraryStore } from '@/features/library/libraryStore'
import DraftReview from './DraftReview.vue'
import { useEnrichmentStore } from './enrichmentStore'

const { t } = useI18n()
const route = useRoute()
const enrichment = useEnrichmentStore()
const library = useLibraryStore()

const selectedId = ref<string | undefined>(typeof route.query.entry === 'string' ? route.query.entry : undefined)

// After a confirm or a regenerate the selected draft leaves the list, so the next one opens.
const selected = computed(
  () => enrichment.drafts.find((entry) => entry.id === selectedId.value) ?? enrichment.drafts[0],
)
watch(selected, (entry) => {
  selectedId.value = entry?.id
})
const selectedDeck = computed(() => selected.value && enrichment.deckOf(selected.value))

function selectNext() {
  const { drafts } = enrichment
  const index = drafts.findIndex((entry) => entry.id === selected.value?.id)
  selectedId.value = drafts[(index + 1) % drafts.length]?.id
}

const isEmpty = computed(
  () =>
    !enrichment.drafts.length &&
    !enrichment.pending.length &&
    !enrichment.waiting.length &&
    !enrichment.failed.length &&
    !enrichment.manual.length,
)

const statusMessage = computed(() => {
  if (enrichment.aiConfigured === false) return t('enrich.status.off')
  const { stop } = enrichment
  if (stop?.kind === 'budget') return t('enrich.status.budget')
  if (stop?.kind === 'paused') return t('enrich.status.paused', { reason: t(`enrich.errors.${stop.code}`) })
  return ''
})
const canRetry = computed(() => Boolean(statusMessage.value) || enrichment.failed.length > 0)

function edit(entry: Entry) {
  library.editing = entry
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <header>
      <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Sparkles :size="20" aria-hidden="true" class="text-accent" />
        {{ t('nav.enrich') }}
      </h1>
      <p class="mt-1 max-w-prose text-sm text-muted">{{ t('enrich.subtitle') }}</p>
    </header>

    <div
      v-if="statusMessage || canRetry"
      class="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-3 text-sm"
      role="status"
      data-testid="enrichment-status"
    >
      <p v-if="statusMessage" class="max-w-prose">{{ statusMessage }}</p>
      <button type="button" class="lf-btn" @click="enrichment.retry()">{{ t('enrich.retry') }}</button>
    </div>

    <p v-if="isEmpty" class="rounded-card border border-line bg-surface p-5 text-sm text-muted" data-testid="enrichment-empty">
      {{ t('enrich.empty') }}
    </p>

    <div v-else class="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav class="flex flex-col gap-3 rounded-card border border-line bg-surface p-3 lg:sticky lg:top-4" :aria-label="t('enrich.queue')">
        <p v-if="enrichment.pending.length" class="text-xs text-muted" aria-live="polite">
          {{ t('enrich.working', { n: enrichment.pending.length }) }}
        </p>

        <ul v-if="enrichment.drafts.length" class="flex max-h-44 flex-col gap-1 overflow-y-auto lg:max-h-none">
          <li v-for="entry in enrichment.drafts" :key="entry.id">
            <button
              type="button"
              class="min-h-9 w-full rounded-lg px-2.5 py-1.5 text-left text-sm wrap-break-word hover:bg-raised"
              :class="entry.id === selected?.id && 'bg-raised font-medium'"
              :aria-current="entry.id === selected?.id ? 'true' : undefined"
              data-testid="draft-item"
              @click="selectedId = entry.id"
            >
              {{ entry.text }}
            </button>
          </li>
        </ul>

        <ul v-if="enrichment.pending.length || enrichment.waiting.length" class="flex flex-col gap-1 text-sm text-muted">
          <li v-for="entry in [...enrichment.pending, ...enrichment.waiting]" :key="entry.id" class="flex items-baseline justify-between gap-2 px-2.5">
            <span class="wrap-break-word">{{ entry.text }}</span>
            <span class="shrink-0 text-xs">
              {{ entry.enrichment === 'pending' ? t('enrich.pendingBadge') : t('enrich.waiting') }}
            </span>
          </li>
        </ul>

        <ul v-if="enrichment.failed.length || enrichment.manual.length" class="flex flex-col gap-2 text-sm">
          <li
            v-for="entry in [...enrichment.failed, ...enrichment.manual]"
            :key="entry.id"
            class="rounded-lg border border-line p-2.5"
            data-testid="problem-item"
          >
            <p class="break-all">{{ entry.text }}</p>
            <p class="mt-1 text-xs text-muted">
              {{ entry.aiError ? t(`enrich.errors.${entry.aiError}`) : t('enrich.needsWord') }}
            </p>
            <button type="button" class="lf-btn mt-2" @click="edit(entry)">{{ t('enrich.edit') }}</button>
          </li>
        </ul>
      </nav>

      <div class="min-w-0 rounded-card border border-line bg-surface p-4 sm:p-5">
        <DraftReview
          v-if="selected?.aiDraft && selectedDeck"
          :key="selected.id"
          :entry="selected"
          :deck="selectedDeck"
          :draft="selected.aiDraft"
          :has-next="enrichment.drafts.length > 1"
          @next="selectNext"
        />
        <p v-else class="text-sm text-muted">{{ t('enrich.chooseDraft') }}</p>
      </div>
    </div>
  </section>
</template>
