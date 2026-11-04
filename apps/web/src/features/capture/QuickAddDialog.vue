<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { entryRepository } from '@/data/repositories'
import { areNearDuplicates } from '@/domain/duplicates'
import { quickAddEntry } from '@/domain/rows'
import { normalizeText } from '@/domain/text'
import type { Entry } from '@/domain/types'
import { useLibraryStore } from '@/features/library/libraryStore'
import AppModal from '@/shared/ui/AppModal.vue'
import { notify } from '@/shared/ui/useToasts'
import { useCaptureStore } from './captureStore'

const MAX_SIMILAR = 3

const { t } = useI18n()
const router = useRouter()
const library = useLibraryStore()
const capture = useCaptureStore()
const { quickAddOpen } = storeToRefs(capture)

const text = ref('')

watch(quickAddOpen, (isOpen) => {
  if (isOpen) text.value = capture.prefill.text
})

const similar = computed(() => {
  const normalized = normalizeText(text.value)
  if (normalized.length < 3) return []
  return library.entries
    .filter((entry) => areNearDuplicates(normalized, entry.normalizedText))
    .slice(0, MAX_SIMILAR)
})

const sourceLabel = computed(() => capture.prefill.source?.title ?? capture.prefill.source?.url)

function openEntry(entry: Entry) {
  quickAddOpen.value = false
  library.editing = entry
}

/** The bookmarklet opens a small popup with this name, which can close once saved. */
function closeCapturePopup() {
  if (window.name === 'linguaforge-capture') window.close()
}

async function save() {
  const value = text.value.trim()
  const deck = library.activeDeck
  if (!value || !deck) return
  try {
    const existing = await entryRepository.findByText(deck.id, normalizeText(value))
    if (existing) {
      notify(t('capture.exists', { name: existing.text }), {
        actionLabel: t('capture.open'),
        action: () => openEntry(existing),
      })
      return
    }

    const { source, trigger } = capture.prefill
    const entry = quickAddEntry(value, deck, new Date(), {
      ...(source ? { source } : {}),
      ...(trigger ? { trigger } : {}),
    })
    await entryRepository.add(entry)
    quickAddOpen.value = false
    notify(t('capture.added', { name: entry.text }), {
      actionLabel: t('capture.open'),
      action: () => openEntry(entry),
    })
    closeCapturePopup()
    if (router.currentRoute.value.name === 'capture') await router.replace('/library')
  } catch (error) {
    console.error(error)
    notify(t('errors.save'), { tone: 'error' })
  }
}
</script>

<template>
  <AppModal
    v-model:open="quickAddOpen"
    :title="t('capture.quickAddTitle')"
    :description="t('capture.quickAddDescription', { deck: library.activeDeck?.name ?? '' })"
  >
    <form class="flex flex-col gap-3" data-testid="quick-add" @submit.prevent="save">
      <input
        v-model="text"
        type="text"
        class="lf-input"
        autocomplete="off"
        :aria-label="t('capture.placeholder')"
        :placeholder="t('capture.placeholder')"
      />
      <p v-if="sourceLabel" class="truncate text-xs text-muted">
        {{ t('capture.capturedFrom', { source: sourceLabel }) }}
      </p>
      <div v-if="similar.length" class="text-sm" data-testid="quick-add-similar">
        <p class="text-xs text-muted">{{ t('capture.similar') }}</p>
        <ul class="mt-1 flex flex-wrap gap-1">
          <li v-for="entry in similar" :key="entry.id">
            <button type="button" class="lf-btn !min-h-8 !px-2 text-xs" @click="openEntry(entry)">
              {{ entry.text }}
            </button>
          </li>
        </ul>
      </div>
      <button type="submit" class="lf-btn lf-btn-primary self-end" :disabled="!text.trim()">
        {{ t('capture.submit') }}
      </button>
    </form>
  </AppModal>
</template>
