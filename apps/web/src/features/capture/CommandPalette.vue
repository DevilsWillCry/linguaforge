<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { NAV_ITEMS } from '@/app/router'
import { foldText } from '@/domain/text'
import { useLibraryStore, type LibraryDialog } from '@/features/library/libraryStore'
import AppModal from '@/shared/ui/AppModal.vue'
import { useCaptureStore } from './captureStore'

const { t } = useI18n()
const router = useRouter()
const library = useLibraryStore()
const capture = useCaptureStore()
const { paletteOpen } = storeToRefs(capture)

const query = ref('')
const activeIndex = ref(0)

async function openLibraryDialog(dialog: LibraryDialog) {
  paletteOpen.value = false
  await router.push('/library')
  library.dialog = dialog
}

interface Command {
  id: string
  label: string
  hint?: string
  run: () => void
}

const commands = computed<Command[]>(() => [
  { id: 'add', label: t('capture.quickAddTitle'), hint: '+', run: () => capture.openQuickAdd() },
  ...NAV_ITEMS.map((item) => ({
    id: `go-${item.name}`,
    label: t('capture.palette.goTo', { page: t(`nav.${item.label}`) }),
    run: () => {
      paletteOpen.value = false
      void router.push(item.path)
    },
  })),
  { id: 'import', label: t('library.import'), run: () => void openLibraryDialog('import') },
  { id: 'export', label: t('library.export'), run: () => void openLibraryDialog('export') },
  { id: 'duplicates', label: t('library.duplicatesNone'), run: () => void openLibraryDialog('duplicates') },
])

const results = computed(() => {
  const terms = foldText(query.value).split(/\s+/).filter(Boolean)
  return commands.value.filter((command) => {
    const label = foldText(command.label)
    return terms.every((term) => label.includes(term))
  })
})

watch(paletteOpen, (isOpen) => {
  if (isOpen) query.value = ''
}, { immediate: true })

watch(query, (value) => {
  activeIndex.value = 0
  // "+" is read from the text, so it works on any keyboard layout. Text after it carries over.
  if (value.startsWith('+')) capture.openQuickAdd({ text: value.slice(1).trimStart() })
})

function onKeydown(event: KeyboardEvent) {
  const count = results.value.length
  if (event.key === 'ArrowDown' && count) {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % count
  } else if (event.key === 'ArrowUp' && count) {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + count) % count
  } else if (event.key === 'Enter') {
    event.preventDefault()
    results.value[activeIndex.value]?.run()
  }
}
</script>

<template>
  <AppModal
    v-model:open="paletteOpen"
    :title="t('capture.palette.title')"
    :description="t('capture.palette.description')"
  >
    <input
      v-model="query"
      type="text"
      role="combobox"
      aria-expanded="true"
      aria-controls="palette-results"
      autocomplete="off"
      class="lf-input"
      :aria-label="t('capture.palette.placeholder')"
      :aria-activedescendant="results[activeIndex] ? `palette-${results[activeIndex]?.id}` : undefined"
      :placeholder="t('capture.palette.placeholder')"
      data-testid="palette-input"
      @keydown="onKeydown"
    />
    <p v-if="!results.length" class="mt-3 text-sm text-muted">{{ t('capture.palette.none') }}</p>
    <ul
      id="palette-results"
      role="listbox"
      :aria-label="t('capture.palette.results')"
      class="mt-2 flex flex-col gap-0.5"
    >
      <li
        v-for="(command, index) in results"
        :id="`palette-${command.id}`"
        :key="command.id"
        role="option"
        :aria-selected="index === activeIndex"
        class="flex min-h-10 cursor-pointer items-center justify-between rounded-lg px-3 text-sm"
        :class="index === activeIndex ? 'bg-accent-soft font-medium' : 'hover:bg-raised'"
        @pointermove="activeIndex = index"
        @click="command.run()"
      >
        {{ command.label }}
        <kbd v-if="command.hint" class="font-mono text-xs text-muted">{{ command.hint }}</kbd>
      </li>
    </ul>
  </AppModal>
</template>
