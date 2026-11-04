<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { entryRepository } from '@/data/repositories'
import type { DuplicatePair } from '@/domain/duplicates'
import AppModal from '@/shared/ui/AppModal.vue'
import { notify } from '@/shared/ui/useToasts'
import { useLibraryStore } from './libraryStore'

const { t } = useI18n()
const library = useLibraryStore()

const open = computed({
  get: () => library.dialog === 'duplicates',
  set: (value) => {
    if (!value) library.dialog = null
  },
})

const sides = (pair: DuplicatePair) => [
  { entry: pair.a, other: pair.b },
  { entry: pair.b, other: pair.a },
]

async function run(action: () => Promise<void>, success?: string) {
  try {
    await action()
    if (success) notify(success)
  } catch (error) {
    console.error(error)
    notify(t('errors.save'), { tone: 'error' })
  }
}
</script>

<template>
  <AppModal v-model:open="open" wide :title="t('duplicates.title')" :description="t('duplicates.description')">
    <p v-if="!library.duplicatePairs.length" class="text-sm text-muted">{{ t('duplicates.none') }}</p>
    <ul class="flex flex-col gap-3">
      <li
        v-for="pair in library.duplicatePairs"
        :key="pair.key"
        class="rounded-lg border border-line p-3"
        data-testid="duplicate-pair"
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <div v-for="{ entry, other } in sides(pair)" :key="entry.id" class="flex min-w-0 flex-col gap-2">
            <p class="font-medium break-words">{{ entry.text }}</p>
            <p class="text-xs text-muted">
              {{ entry.status }} ·
              {{ t('duplicates.meanings', { n: entry.meanings.length }) }} ·
              {{ t('duplicates.examples', { n: entry.realExamples.length + entry.ownExamples.length }) }}
            </p>
            <p v-if="entry.meanings[0]" class="line-clamp-2 text-sm text-muted">{{ entry.meanings[0] }}</p>
            <button
              type="button"
              class="lf-btn mt-auto h-auto py-1.5"
              @click="run(() => entryRepository.merge(entry.id, other.id), t('duplicates.merged'))"
            >
              {{ t('duplicates.keep', { name: entry.text }) }}
            </button>
          </div>
        </div>
        <button
          type="button"
          class="mt-2 min-h-9 text-sm text-muted underline-offset-2 hover:underline"
          @click="run(() => entryRepository.dismissDuplicate(pair.a.id, pair.b.id))"
        >
          {{ t('duplicates.notDuplicates') }}
        </button>
      </li>
    </ul>
  </AppModal>
</template>
