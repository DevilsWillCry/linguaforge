<script setup lang="ts">
import { Bookmark, Search, Trash2, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldOf } from '@/domain/rows'
import type { CoreField } from '@/domain/types'
import AppPopover from '@/shared/ui/AppPopover.vue'
import FacetMenu from './FacetMenu.vue'
import { useLibraryStore } from './libraryStore'

const { t } = useI18n()
const library = useLibraryStore()

const PRIORITIES = [0, 1, 2, 3, 4, 5]
const FACETS = [
  { target: 'kind', filter: 'kinds' },
  { target: 'tone', filter: 'tones' },
  { target: 'context', filter: 'contexts' },
  { target: 'status', filter: 'statuses' },
  { target: 'importance', filter: 'importance' },
] as const satisfies readonly { target: CoreField; filter: string }[]

/** Only the filters this deck has fields for. */
const facets = computed(() => {
  const deck = library.activeDeck
  if (!deck) return []
  return FACETS.flatMap(({ target, filter }) => {
    const field = fieldOf(deck, target)
    return field ? [{ filter, label: t(`fields.${field.key}`), options: field.options ?? [] }] : []
  })
})

const allTags = computed(() => [...new Set(library.entries.flatMap((entry) => entry.tags))].sort())

const viewName = ref('')
function saveView() {
  const name = viewName.value.trim()
  if (!name) return
  void library.saveCurrentView(name)
  viewName.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="relative">
      <Search :size="16" aria-hidden="true" class="pointer-events-none absolute top-3 left-3 text-muted" />
      <input
        v-model="library.filters.search"
        type="search"
        class="lf-input !pl-9"
        :aria-label="t('library.searchLabel')"
        :placeholder="t('library.searchPlaceholder')"
      />
    </div>

    <!-- One row that scrolls sideways on phones, so entries stay near the top of the screen. -->
    <div class="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible md:pb-0 [&>*]:shrink-0">
      <FacetMenu
        v-for="facet in facets"
        :key="facet.filter"
        v-model="library.filters[facet.filter]"
        :label="facet.label"
        :options="facet.options"
      />
      <FacetMenu v-model="library.filters.priorities" :label="t('fields.priority')" :options="PRIORITIES" />
      <FacetMenu
        v-if="allTags.length"
        v-model="library.filters.tags"
        :label="t('fields.tags')"
        :options="allTags"
      />
      <AppPopover>
        <template #trigger>
          <button type="button" class="lf-btn" :aria-pressed="Boolean(library.filters.source)">
            {{ t('library.sourceFilter') }}
          </button>
        </template>
        <label class="block p-1">
          <span class="lf-label">{{ t('library.sourceFilter') }}</span>
          <input
            v-model="library.filters.source"
            type="text"
            class="lf-input"
            :placeholder="t('library.sourcePlaceholder')"
          />
        </label>
      </AppPopover>
      <button
        type="button"
        class="lf-btn"
        :aria-pressed="library.filters.dueToday"
        @click="library.filters.dueToday = !library.filters.dueToday"
      >
        {{ t('library.dueToday') }}
      </button>

      <AppPopover>
        <template #trigger>
          <button type="button" class="lf-btn">
            <Bookmark :size="14" aria-hidden="true" />
            {{ t('library.saved.label') }}
          </button>
        </template>
        <p v-if="!library.savedViews.length" class="p-2 text-sm text-muted">{{ t('library.saved.none') }}</p>
        <ul v-else class="mb-2">
          <li v-for="view in library.savedViews" :key="view.id" class="flex items-center gap-1">
            <button
              type="button"
              class="min-h-9 min-w-0 flex-1 truncate rounded px-2 text-left text-sm hover:bg-raised"
              @click="library.applySavedView(view)"
            >
              {{ view.name }}
            </button>
            <button
              type="button"
              class="grid size-9 shrink-0 place-items-center rounded text-muted hover:bg-raised"
              :aria-label="t('library.saved.remove', { name: view.name })"
              @click="library.removeSavedView(view.id)"
            >
              <Trash2 :size="14" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <form class="flex gap-1 border-t border-line pt-2" @submit.prevent="saveView">
          <input
            v-model="viewName"
            type="text"
            class="lf-input min-w-0"
            :aria-label="t('library.saved.namePlaceholder')"
            :placeholder="t('library.saved.namePlaceholder')"
          />
          <button type="submit" class="lf-btn shrink-0" :disabled="!viewName.trim()">
            {{ t('library.saved.save') }}
          </button>
        </form>
      </AppPopover>

      <button v-if="library.hasFilters" type="button" class="lf-btn border-transparent text-muted" @click="library.clearFilters()">
        <X :size="14" aria-hidden="true" />
        {{ t('library.clearFilters') }}
      </button>
    </div>
  </div>
</template>
