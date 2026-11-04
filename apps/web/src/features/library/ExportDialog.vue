<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { createBackup } from '@/data/backup'
import { deckRepository, entryRepository } from '@/data/repositories'
import type { SheetData } from '@/data/spreadsheet'
import { toAnkiText } from '@/domain/anki'
import { DEFAULT_SORT, sortEntries } from '@/domain/libraryQuery'
import { entryToRow } from '@/domain/rows'
import type { Deck } from '@/domain/types'
import { datedFileName, downloadFile } from '@/shared/download'
import AppModal from '@/shared/ui/AppModal.vue'
import { notify } from '@/shared/ui/useToasts'
import { useLibraryStore } from './libraryStore'

const { t } = useI18n()
const library = useLibraryStore()

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const open = computed({
  get: () => library.dialog === 'export',
  set: (value) => {
    if (!value) library.dialog = null
  },
})

const deck = computed(() => library.activeDeck)

// Reads from the database, so an export ignores any filters on screen and is always complete.
async function sortedEntries(target: Deck) {
  return sortEntries(await entryRepository.listByDeck(target.id), DEFAULT_SORT, target)
}

async function sheetFor(target: Deck): Promise<SheetData> {
  return {
    name: target.name,
    columns: target.schema.fields.map((field) => field.column),
    rows: (await sortedEntries(target)).map((entry) => entryToRow(entry, target)),
  }
}

const exporters = computed(() => {
  const current = deck.value
  if (!current) return []
  return [
    {
      id: 'xlsx',
      label: t('export.xlsx'),
      hint: t('export.xlsxHint'),
      async run() {
        const { writeXlsx } = await import('@/data/spreadsheet')
        const name = datedFileName(current.name, 'xlsx')
        downloadFile(name, writeXlsx([await sheetFor(current)]), XLSX_TYPE)
        return name
      },
    },
    {
      id: 'csv',
      label: t('export.csv'),
      hint: t('export.csvHint'),
      async run() {
        const { writeCsv } = await import('@/data/spreadsheet')
        const name = datedFileName(current.name, 'csv')
        downloadFile(name, writeCsv(await sheetFor(current)), 'text/csv;charset=utf-8')
        return name
      },
    },
    {
      id: 'xlsx-all',
      label: t('export.xlsxAll'),
      hint: t('export.xlsxAllHint'),
      async run() {
        const { writeXlsx } = await import('@/data/spreadsheet')
        const decks = await deckRepository.list()
        const name = datedFileName('all-decks', 'xlsx')
        downloadFile(name, writeXlsx(await Promise.all(decks.map(sheetFor))), XLSX_TYPE)
        return name
      },
    },
    {
      id: 'anki',
      label: t('export.anki'),
      hint: t('export.ankiHint'),
      async run() {
        const name = datedFileName(`${current.name}-anki`, 'txt')
        downloadFile(name, toAnkiText(await sortedEntries(current), current), 'text/plain;charset=utf-8')
        return name
      },
    },
    {
      id: 'json',
      label: t('export.json'),
      hint: t('export.jsonHint'),
      async run() {
        const name = datedFileName('backup', 'json')
        downloadFile(name, JSON.stringify(await createBackup(), null, 2), 'application/json')
        return name
      },
    },
  ]
})

async function run(exporter: { run: () => Promise<string> }) {
  try {
    notify(t('export.done', { name: await exporter.run() }))
  } catch (error) {
    console.error(error)
    notify(t('errors.save'), { tone: 'error' })
  }
}
</script>

<template>
  <AppModal
    v-model:open="open"
    :title="t('export.title')"
    :description="t('export.description', { deck: deck?.name ?? '', n: library.entries.length })"
  >
    <ul class="flex flex-col gap-2">
      <li v-for="exporter in exporters" :key="exporter.id">
        <button
          type="button"
          class="w-full rounded-lg border border-line px-3 py-2.5 text-left hover:bg-raised"
          :data-testid="`export-${exporter.id}`"
          @click="run(exporter)"
        >
          <span class="block text-sm font-medium">{{ exporter.label }}</span>
          <span class="block text-xs text-muted">{{ exporter.hint }}</span>
        </button>
      </li>
    </ul>
  </AppModal>
</template>
