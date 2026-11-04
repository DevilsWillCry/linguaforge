<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { appendOwnExample, confirmPatch, draftCell, initialCells, reviewFields } from '@/domain/enrichment'
import { cellOf, fieldOf } from '@/domain/rows'
import type { Deck, Entry, EnrichmentDraft } from '@/domain/types'
import FieldInput from '@/features/library/FieldInput.vue'
import { useLibraryStore } from '@/features/library/libraryStore'
import { useFieldLabel } from '@/features/library/useFieldLabel'
import { notify } from '@/shared/ui/useToasts'
import { useEnrichmentStore } from './enrichmentStore'
import OwnExampleCoach from './OwnExampleCoach.vue'

const props = defineProps<{ entry: Entry; deck: Deck; draft: EnrichmentDraft; hasNext: boolean }>()
const emit = defineEmits<{ next: [] }>()

const { t } = useI18n()
const library = useLibraryStore()
const enrichment = useEnrichmentStore()
const fieldLabel = useFieldLabel()

// The parent keys this component by entry, so these only initialize once per draft.
const fields = computed(() => reviewFields(props.deck))
const cells = ref(initialCells(props.entry, props.deck, props.draft))
const ipa = ref(props.entry.ipa || props.draft.ipa)
const notes = ref(props.entry.notes || props.draft.notes)

const ownField = computed(() => fieldOf(props.deck, 'ownExamples'))
const ownExamples = ref(ownField.value ? cellOf(props.entry, ownField.value) : '')

async function confirm() {
  const saved = await library.patchEntry(
    props.entry,
    confirmPatch(props.entry, props.deck, {
      cells: cells.value,
      ownExamples: ownExamples.value,
      ipa: ipa.value,
      notes: notes.value,
    }),
  )
  if (saved) notify(t('enrich.confirmed', { name: props.entry.text }))
}

function addOwnExample(sentence: string) {
  ownExamples.value = appendOwnExample(ownExamples.value, sentence)
}
</script>

<template>
  <form class="flex flex-col gap-5" data-testid="draft-review" @submit.prevent="confirm" @keydown.ctrl.enter.prevent="confirm" @keydown.meta.enter.prevent="confirm">
    <header class="flex flex-wrap items-baseline gap-3">
      <h2 class="text-xl font-semibold wrap-break-word" lang="en">{{ entry.text }}</h2>
    </header>

    <div class="flex flex-col gap-4">
      <div class="hidden gap-4 text-xs font-medium text-muted md:grid md:grid-cols-2" aria-hidden="true">
        <span>{{ t('enrich.aiDraft') }}</span>
        <span>{{ t('enrich.yourVersion') }}</span>
      </div>

      <div v-for="field in fields" :key="field.key" class="grid gap-2 md:grid-cols-2 md:gap-4" data-testid="review-row">
        <div class="rounded-lg bg-raised p-3 text-sm">
          <p class="mb-1 text-xs text-muted">{{ fieldLabel(field) }} · {{ t('enrich.aiDraft') }}</p>
          <p class="whitespace-pre-line" :class="!draftCell(draft, field) && 'text-muted'" lang="en">
            {{ draftCell(draft, field) || t('enrich.blankValue') }}
          </p>
        </div>
        <div>
          <label class="block">
            <span class="lf-label">{{ fieldLabel(field) }}</span>
            <FieldInput v-model="cells[field.key]!" :field="field" :rows="4" />
          </label>
          <p v-if="field.target === 'realExamples'" class="mt-1 text-xs text-muted">{{ t('enrich.aiExamplesHint') }}</p>
        </div>
      </div>

      <div class="grid gap-2 md:grid-cols-2 md:gap-4" data-testid="review-row">
        <div class="rounded-lg bg-raised p-3 text-sm">
          <p class="mb-1 text-xs text-muted">{{ t('fields.ipa') }} · {{ t('enrich.aiDraft') }}</p>
          <p class="font-mono" :class="!draft.ipa && 'font-sans text-muted'">{{ draft.ipa || t('enrich.blankValue') }}</p>
        </div>
        <label class="block">
          <span class="lf-label">{{ t('fields.ipa') }}</span>
          <input v-model="ipa" type="text" class="lf-input font-mono" />
        </label>
      </div>

      <div class="grid gap-2 md:grid-cols-2 md:gap-4" data-testid="review-row">
        <div class="rounded-lg bg-raised p-3 text-sm">
          <p class="mb-1 text-xs text-muted">{{ t('fields.notes') }} · {{ t('enrich.aiDraft') }}</p>
          <p class="whitespace-pre-line" :class="!draft.notes && 'text-muted'">{{ draft.notes || t('enrich.blankValue') }}</p>
        </div>
        <label class="block">
          <span class="lf-label">{{ t('fields.notes') }}</span>
          <textarea v-model="notes" rows="2" class="lf-input" />
        </label>
      </div>
    </div>

    <section v-if="ownField" class="flex flex-col gap-3 border-t border-line pt-5">
      <label class="block">
        <span class="lf-label">{{ fieldLabel(ownField) }}</span>
        <FieldInput v-model="ownExamples" :field="ownField" :placeholder="t('library.ownExamplePrompt')" />
      </label>
      <p class="text-xs text-muted">{{ t('editor.ownExampleHint') }}</p>
      <OwnExampleCoach :entry="entry" @add="addOwnExample" />
    </section>

    <div class="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
      <button type="button" class="lf-btn" @click="enrichment.regenerate(entry)">{{ t('enrich.regenerate') }}</button>
      <button v-if="hasNext" type="button" class="lf-btn" @click="emit('next')">{{ t('enrich.skip') }}</button>
      <button type="submit" class="lf-btn lf-btn-primary">{{ t('enrich.confirm') }}</button>
    </div>
  </form>
</template>
