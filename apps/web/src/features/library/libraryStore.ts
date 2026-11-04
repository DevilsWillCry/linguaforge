import { useLocalStorage } from '@vueuse/core'
import { liveQuery, type Subscription } from 'dexie'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { i18n } from '@/app/i18n'
import { deckRepository, entryRepository, savedViewRepository } from '@/data/repositories'
import { ENGLISH_DECK_ID } from '@/domain/deckPresets'
import { findDuplicatePairs } from '@/domain/duplicates'
import {
  DEFAULT_SORT,
  activeFilterCount,
  emptyFilters,
  matchesFilters,
  sortEntries,
  toggleSort,
  type LibraryFilters,
  type SortKey,
} from '@/domain/libraryQuery'
import { cellOf, editPatch } from '@/domain/rows'
import { normalizeText } from '@/domain/text'
import type { Deck, Entry, FieldDef, SavedView } from '@/domain/types'
import { notify } from '@/shared/ui/useToasts'

export type LibraryView = 'table' | 'cards' | 'kanban'
export type LibraryDialog = 'import' | 'export' | 'duplicates'

interface ColumnPrefs {
  hidden: string[]
  widths: Record<string, number>
}

const { t } = i18n.global

/** Plain copies for IndexedDB, which can't store Vue's reactive proxies. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** Like plain(), but keeps undefined values, because those are how a patch clears a field. */
function plainPatch(patch: Partial<Entry>): Partial<Entry> {
  const cleared = Object.keys(patch).filter((key) => patch[key as keyof Entry] === undefined)
  return { ...plain(patch), ...Object.fromEntries(cleared.map((key) => [key, undefined])) }
}

export const useLibraryStore = defineStore('library', () => {
  // shallowRef everywhere for database data: rows stay plain objects, so they can be
  // written straight back to IndexedDB, and Vue doesn't track thousands of nested fields.
  const decks = shallowRef<Deck[]>([])
  const entries = shallowRef<Entry[]>([])
  const savedViews = shallowRef<SavedView[]>([])
  const dismissedDuplicates = shallowRef<Set<string>>(new Set())
  const loading = ref(true)
  const failed = ref(false)

  const activeDeckId = useLocalStorage('lf-active-deck', ENGLISH_DECK_ID)
  const activeDeck = computed(
    () => decks.value.find((deck) => deck.id === activeDeckId.value) ?? decks.value[0],
  )

  const filters = ref<LibraryFilters>(emptyFilters())
  const sort = ref<SortKey[]>([...DEFAULT_SORT])
  const hasFilters = computed(() => activeFilterCount(filters.value) > 0)

  // Phones start on cards, since a wide table is hard to use on a small screen.
  const view = useLocalStorage<LibraryView>(
    'lf-library-view',
    matchMedia('(min-width: 768px)').matches ? 'table' : 'cards',
  )
  const columnPrefs = useLocalStorage<Record<string, ColumnPrefs>>('lf-library-columns', {})

  const dialog = ref<LibraryDialog | null>(null)
  /** The entry open in the full editor. */
  const editing = shallowRef<Entry | null>(null)

  const visibleEntries = computed(() => {
    const deck = activeDeck.value
    if (!deck) return []
    const now = new Date()
    const matching = entries.value.filter((entry) => matchesFilters(entry, filters.value, now))
    return sortEntries(matching, sort.value, deck)
  })

  const duplicatePairs = computed(() => findDuplicatePairs(entries.value, dismissedDuplicates.value))

  const prefsFor = (deckId: string): ColumnPrefs => columnPrefs.value[deckId] ?? { hidden: [], widths: {} }

  const visibleFields = computed<FieldDef[]>(() => {
    const deck = activeDeck.value
    if (!deck) return []
    const { hidden } = prefsFor(deck.id)
    return deck.schema.fields.filter((field) => !hidden.includes(field.key))
  })

  function columnWidth(field: FieldDef): number {
    const saved = activeDeck.value && prefsFor(activeDeck.value.id).widths[field.key]
    if (saved) return saved
    if (field.target === 'text') return 220
    if (field.type === 'number') return 148
    if (field.type === 'select') return 180
    return field.type === 'list' ? 300 : 220
  }

  function setColumnWidth(field: FieldDef, width: number) {
    const deckId = activeDeck.value?.id
    if (!deckId) return
    const prefs = prefsFor(deckId)
    const widths = { ...prefs.widths, [field.key]: Math.min(800, Math.max(72, width)) }
    columnPrefs.value = { ...columnPrefs.value, [deckId]: { ...prefs, widths } }
  }

  function toggleColumn(field: FieldDef) {
    const deckId = activeDeck.value?.id
    // The text column stays visible, since it's what identifies each row.
    if (!deckId || field.target === 'text') return
    const prefs = prefsFor(deckId)
    const hidden = prefs.hidden.includes(field.key)
      ? prefs.hidden.filter((key) => key !== field.key)
      : [...prefs.hidden, field.key]
    columnPrefs.value = { ...columnPrefs.value, [deckId]: { ...prefs, hidden } }
  }

  function setSort(key: string, additive: boolean) {
    sort.value = toggleSort(sort.value, key, additive)
  }

  function clearFilters() {
    filters.value = emptyFilters()
  }

  function showError(error: unknown) {
    console.error(error)
    notify(t('errors.save'), { tone: 'error' })
  }

  /** Saves changes to an entry. Returns false if nothing could be saved. */
  async function patchEntry(entry: Entry, patch: Partial<Entry>): Promise<boolean> {
    try {
      if (patch.normalizedText && patch.normalizedText !== entry.normalizedText) {
        const clash = await entryRepository.findByText(entry.deckId, patch.normalizedText)
        if (clash && clash.id !== entry.id) {
          notify(t('editor.duplicateWarning', { name: clash.text }))
        }
      }
      await entryRepository.patch(entry.id, plainPatch(patch))
      return true
    } catch (error) {
      showError(error)
      return false
    }
  }

  /** Saves one edited cell. A blank text is rejected, since the entry would have no name. */
  async function updateCell(entry: Entry, field: FieldDef, cell: string): Promise<boolean> {
    if (cell === cellOf(entry, field)) return true
    if (field.target === 'text' && !normalizeText(cell)) {
      notify(t('editor.textRequired'), { tone: 'error' })
      return false
    }
    return patchEntry(entry, editPatch(entry, field, cell))
  }

  async function removeEntry(entry: Entry) {
    try {
      await entryRepository.remove(entry.id)
      notify(t('editor.deleted', { name: entry.text }), {
        actionLabel: t('editor.undo'),
        action: () => {
          entryRepository.add(entry).catch(showError)
        },
      })
    } catch (error) {
      showError(error)
    }
  }

  async function saveCurrentView(name: string) {
    const deckId = activeDeck.value?.id
    if (!deckId) return
    try {
      await savedViewRepository.add({
        id: nanoid(),
        deckId,
        name,
        filters: plain(filters.value),
        sort: plain(sort.value),
      })
      notify(t('library.saved.added'))
    } catch (error) {
      showError(error)
    }
  }

  function applySavedView(saved: SavedView) {
    filters.value = { ...emptyFilters(), ...plain(saved.filters) }
    sort.value = plain(saved.sort)
  }

  function removeSavedView(id: string) {
    savedViewRepository.remove(id).catch(showError)
  }

  // liveQuery re-runs whenever the data changes, even from another tab, which keeps
  // every view current without manual refreshes.
  function live<T>(query: () => Promise<T>, onValue: (value: T) => void): Subscription {
    return liveQuery(query).subscribe({
      next: onValue,
      error: (error) => {
        console.error(error)
        failed.value = true
        loading.value = false
      },
    })
  }

  live(() => deckRepository.list(), (value) => (decks.value = value))
  live(
    () => entryRepository.listDismissedDuplicates(),
    (value) => (dismissedDuplicates.value = new Set(value)),
  )

  let deckSubscriptions: Subscription[] = []
  watch(
    activeDeckId,
    (deckId) => {
      deckSubscriptions.forEach((subscription) => subscription.unsubscribe())
      loading.value = true
      clearFilters()
      sort.value = [...DEFAULT_SORT]
      deckSubscriptions = [
        live(
          () => entryRepository.listByDeck(deckId),
          (value) => {
            entries.value = value
            loading.value = false
          },
        ),
        live(() => savedViewRepository.listByDeck(deckId), (value) => (savedViews.value = value)),
      ]
    },
    { immediate: true },
  )

  return {
    decks,
    entries,
    savedViews,
    loading,
    failed,
    activeDeckId,
    activeDeck,
    filters,
    sort,
    hasFilters,
    view,
    dialog,
    editing,
    visibleEntries,
    duplicatePairs,
    visibleFields,
    columnWidth,
    setColumnWidth,
    toggleColumn,
    setSort,
    clearFilters,
    patchEntry,
    updateCell,
    removeEntry,
    saveCurrentView,
    applySavedView,
    removeSavedView,
  }
})
