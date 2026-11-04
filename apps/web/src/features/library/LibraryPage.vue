<script setup lang="ts">
import { Columns3, CopyCheck, Download, Sparkles, Upload } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useEnrichmentStore } from '@/features/enrichment/enrichmentStore'
import AppPopover from '@/shared/ui/AppPopover.vue'
import CardsView from './CardsView.vue'
import DuplicatesDialog from './DuplicatesDialog.vue'
import ExportDialog from './ExportDialog.vue'
import FilterBar from './FilterBar.vue'
import ImportDialog from './ImportDialog.vue'
import KanbanView from './KanbanView.vue'
import { useLibraryStore, type LibraryView } from './libraryStore'
import TableView from './TableView.vue'
import { useFieldLabel } from './useFieldLabel'

const { t } = useI18n()
const library = useLibraryStore()
const enrichment = useEnrichmentStore()
const fieldLabel = useFieldLabel()

const VIEWS: LibraryView[] = ['table', 'cards', 'kanban']
const VIEW_COMPONENTS = { table: TableView, cards: CardsView, kanban: KanbanView }

const duplicateCount = computed(() => library.duplicatePairs.length)
</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('nav.library') }}</h1>
      <div class="flex flex-wrap gap-2">
        <RouterLink v-if="enrichment.drafts.length" to="/enrich" class="lf-btn lf-btn-primary">
          <Sparkles :size="15" aria-hidden="true" />
          {{ t('enrich.reviewDrafts', { n: enrichment.drafts.length }) }}
        </RouterLink>
        <button type="button" class="lf-btn" :aria-pressed="duplicateCount > 0" @click="library.dialog = 'duplicates'">
          <CopyCheck :size="15" aria-hidden="true" />
          {{ duplicateCount ? t('library.duplicatesButton', { n: duplicateCount }) : t('library.duplicatesNone') }}
        </button>
        <button type="button" class="lf-btn" @click="library.dialog = 'import'">
          <Upload :size="15" aria-hidden="true" />
          {{ t('library.import') }}
        </button>
        <button type="button" class="lf-btn" @click="library.dialog = 'export'">
          <Download :size="15" aria-hidden="true" />
          {{ t('library.export') }}
        </button>
      </div>
    </header>

    <p v-if="library.failed" role="alert" class="text-sm">{{ t('errors.load') }}</p>

    <template v-else-if="library.activeDeck">
      <div role="group" :aria-label="t('library.decks')" class="flex flex-wrap gap-2">
        <button
          v-for="deck in library.decks"
          :key="deck.id"
          type="button"
          class="lf-btn"
          :aria-pressed="deck.id === library.activeDeck.id"
          @click="library.activeDeckId = deck.id"
        >
          {{ deck.name }}
        </button>
      </div>

      <FilterBar />

      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-muted" data-testid="entry-count" aria-live="polite">
          {{ t('library.count', { shown: library.visibleEntries.length, total: library.entries.length }) }}
        </p>
        <div class="flex items-center gap-2">
          <AppPopover v-if="library.view === 'table'">
            <template #trigger>
              <button type="button" class="lf-btn">
                <Columns3 :size="15" aria-hidden="true" />
                {{ t('library.columns') }}
              </button>
            </template>
            <label
              v-for="field in library.activeDeck.schema.fields"
              :key="field.key"
              class="flex min-h-9 items-center gap-2 rounded px-2 text-sm hover:bg-raised"
            >
              <input
                type="checkbox"
                class="accent-(--accent)"
                :checked="library.visibleFields.includes(field)"
                :disabled="field.target === 'text'"
                @change="library.toggleColumn(field)"
              />
              {{ fieldLabel(field) }}
            </label>
          </AppPopover>
          <div role="group" :aria-label="t('library.views.label')" class="flex gap-1">
            <button
              v-for="option in VIEWS"
              :key="option"
              type="button"
              class="lf-btn"
              :aria-pressed="library.view === option"
              @click="library.view = option"
            >
              {{ t(`library.views.${option}`) }}
            </button>
          </div>
        </div>
      </div>

      <p v-if="library.loading" class="text-sm text-muted">{{ t('loading') }}</p>
      <p v-else-if="!library.entries.length" class="rounded-card border border-dashed border-line p-8 text-sm text-muted">
        {{ t('library.empty') }}
      </p>
      <p v-else-if="!library.visibleEntries.length" class="rounded-card border border-dashed border-line p-8 text-sm text-muted">
        {{ t('library.noResults') }}
      </p>
      <component :is="VIEW_COMPONENTS[library.view]" v-else />
    </template>

    <p v-else class="text-sm text-muted">{{ t('loading') }}</p>

    <ImportDialog />
    <ExportDialog />
    <DuplicatesDialog />
  </section>
</template>
