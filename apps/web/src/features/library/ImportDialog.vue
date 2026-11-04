<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { entryRepository } from '@/data/repositories'
import type { ParsedSheet } from '@/data/spreadsheet'
import {
  autoMapHeaders,
  canImport,
  guessDeck,
  planImport,
  remapRows,
  unmappedHeaders,
  type HeaderMapping,
} from '@/domain/importer'
import { applyRowToEntry } from '@/domain/rows'
import type { Entry } from '@/domain/types'
import AppModal from '@/shared/ui/AppModal.vue'
import { notify } from '@/shared/ui/useToasts'
import { useLibraryStore } from './libraryStore'
import { useFieldLabel } from './useFieldLabel'

const { t } = useI18n()
const library = useLibraryStore()
const fieldLabel = useFieldLabel()

const PREVIEW_LIMIT = 6

const open = computed({
  get: () => library.dialog === 'import',
  set: (value) => {
    if (!value) library.dialog = null
  },
})

const sheets = shallowRef<ParsedSheet[]>([])
const sheetIndex = ref(0)
const deckId = ref('')
const mapping = ref<HeaderMapping>({})
const existing = shallowRef<Entry[]>([])
const strategy = ref<'skip' | 'update'>('skip')
const error = ref('')
const saving = ref(false)

const sheet = computed(() => sheets.value[sheetIndex.value])
const deck = computed(() => library.decks.find((d) => d.id === deckId.value))

function reset() {
  sheets.value = []
  sheetIndex.value = 0
  mapping.value = {}
  strategy.value = 'skip'
  error.value = ''
}

watch(open, (isOpen) => {
  if (isOpen) reset()
})

// A new sheet picks its own best deck, which also handles workbooks holding both decks.
watch(sheet, (current) => {
  if (!current) return
  deckId.value = (guessDeck(current.headers, library.decks) ?? library.activeDeck)?.id ?? ''
})

watch([sheet, deck], async ([currentSheet, currentDeck]) => {
  if (!currentSheet || !currentDeck) return
  mapping.value = autoMapHeaders(currentSheet.headers, currentDeck.schema)
  existing.value = await entryRepository.listByDeck(currentDeck.id)
})

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  reset()
  try {
    // SheetJS is large, so it only loads when a file is actually chosen.
    const { parseSpreadsheetFile } = await import('@/data/spreadsheet')
    const parsed = await parseSpreadsheetFile(file)
    if (!parsed.length) error.value = t('import.noData')
    sheets.value = parsed
  } catch (cause) {
    console.error(cause)
    error.value = t('import.readError')
  }
}

const unmapped = computed(() => (sheet.value ? unmappedHeaders(sheet.value.headers, mapping.value) : []))
const ready = computed(() => Boolean(deck.value && canImport(mapping.value, deck.value)))

const plan = computed(() => {
  if (!sheet.value || !deck.value || !ready.value) return null
  const rows = remapRows(sheet.value.rows, mapping.value, deck.value.schema)
  return planImport(rows, deck.value, existing.value)
})

const previewEntries = computed(() => plan.value?.toCreate.slice(0, PREVIEW_LIMIT) ?? [])
const importCount = computed(() => {
  if (!plan.value) return 0
  return plan.value.toCreate.length + (strategy.value === 'update' ? plan.value.duplicates.length : 0)
})

async function commit() {
  if (!plan.value || !deck.value) return
  const currentDeck = deck.value
  const toUpdate =
    strategy.value === 'update'
      ? plan.value.duplicates.map(({ existing: entry, row }) => applyRowToEntry(entry, row, currentDeck))
      : []
  saving.value = true
  try {
    await entryRepository.saveImport(plan.value.toCreate, toUpdate)
    notify(t('import.done', { created: plan.value.toCreate.length, updated: toUpdate.length }))
    library.activeDeckId = currentDeck.id
    open.value = false
  } catch (cause) {
    console.error(cause)
    notify(t('errors.save'), { tone: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" wide :title="t('import.title')" :description="t('import.description')">
    <div class="flex flex-col gap-5" data-testid="import-dialog">
      <label class="block">
        <span class="lf-label">{{ t('import.chooseFile') }}</span>
        <input
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm"
          class="lf-input"
          data-testid="import-file"
          @change="onFile"
        />
      </label>
      <p v-if="error" role="alert" class="text-sm text-danger">{{ error }}</p>

      <template v-if="sheet && deck">
        <div class="grid gap-4 sm:grid-cols-2">
          <label v-if="sheets.length > 1" class="block">
            <span class="lf-label">{{ t('import.sheet') }}</span>
            <select v-model.number="sheetIndex" class="lf-input">
              <option v-for="(item, index) in sheets" :key="item.name" :value="index">{{ item.name }}</option>
            </select>
          </label>
          <label class="block">
            <span class="lf-label">{{ t('import.deck') }}</span>
            <select v-model="deckId" class="lf-input">
              <option v-for="item in library.decks" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>
        </div>

        <p v-if="!ready" role="alert" class="text-sm text-danger">{{ t('import.textRequired') }}</p>

        <section v-if="plan">
          <h3 class="text-sm font-medium">{{ t('import.preview') }}</h3>
          <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" data-testid="import-summary">
            <li class="font-medium">{{ t('import.newEntries', { n: plan.toCreate.length }) }}</li>
            <li>{{ t('import.duplicates', { n: plan.duplicates.length }) }}</li>
            <li class="text-muted">{{ t('import.blankRows', { n: plan.blankRows }) }}</li>
            <li v-if="plan.repeatedInFile" class="text-muted">{{ t('import.repeated', { n: plan.repeatedInFile }) }}</li>
          </ul>
          <ul
            v-if="previewEntries.length"
            class="mt-3 divide-y divide-line rounded-lg border border-line text-sm"
          >
            <li v-for="entry in previewEntries" :key="entry.id" class="px-3 py-2">
              <span class="font-medium">{{ entry.text }}</span>
              <span v-if="entry.meanings[0]" class="text-muted"> · {{ entry.meanings[0] }}</span>
            </li>
            <li v-if="plan.toCreate.length > PREVIEW_LIMIT" class="px-3 py-2 text-muted">
              {{ t('import.moreRows', { n: plan.toCreate.length - PREVIEW_LIMIT }) }}
            </li>
          </ul>

          <fieldset v-if="plan.duplicates.length" class="mt-4">
            <legend class="text-sm font-medium">{{ t('import.strategy') }}</legend>
            <label class="mt-2 flex min-h-9 items-center gap-2 text-sm">
              <input v-model="strategy" type="radio" value="skip" class="accent-(--accent)" />
              {{ t('import.skip') }}
            </label>
            <label class="flex min-h-9 items-center gap-2 text-sm">
              <input v-model="strategy" type="radio" value="update" class="accent-(--accent)" />
              {{ t('import.update') }}
            </label>
            <p class="mt-1 text-xs text-muted">{{ t('import.updateHint') }}</p>
          </fieldset>

          <p v-if="!importCount" class="mt-3 text-sm text-muted">{{ t('import.nothing') }}</p>
        </section>

        <p v-if="unmapped.length" class="text-sm text-muted">
          {{ t('import.unmapped', { names: unmapped.join(', ') }) }}
        </p>

        <!-- Usually matched automatically, so it only opens by itself when it needs attention. -->
        <details class="rounded-lg border border-line" :open="!ready">
          <summary class="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">
            {{ t('import.mapping') }}
          </summary>
          <div class="px-3 pb-3">
            <p class="text-xs text-muted">{{ t('import.mappingHint') }}</p>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <label v-for="field in deck.schema.fields" :key="field.key" class="block">
                <span class="lf-label">{{ fieldLabel(field) }}</span>
                <select v-model="mapping[field.key]" class="lf-input">
                  <option value="">{{ t('import.notMapped') }}</option>
                  <option v-for="header in sheet.headers" :key="header" :value="header">{{ header }}</option>
                </select>
              </label>
            </div>
          </div>
        </details>

        <div class="flex justify-end border-t border-line pt-4">
          <button type="button" class="lf-btn lf-btn-primary" :disabled="!importCount || saving" @click="commit">
            {{ t('import.confirm') }}
          </button>
        </div>
      </template>
    </div>
  </AppModal>
</template>
