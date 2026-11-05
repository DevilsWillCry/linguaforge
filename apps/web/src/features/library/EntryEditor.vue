<script setup lang="ts">
import { ExternalLink, Sparkles } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { cellOf, editPatch } from '@/domain/rows'
import { normalizeText, safeHttpUrl } from '@/domain/text'
import type { Entry } from '@/domain/types'
import { appendOwnExample } from '@/domain/enrichment'
import OwnExampleCoach from '@/features/enrichment/OwnExampleCoach.vue'
import SourceLink from '@/features/video/SourceLink.vue'
import AppModal from '@/shared/ui/AppModal.vue'
import { notify } from '@/shared/ui/useToasts'
import FieldInput from './FieldInput.vue'
import { useLibraryStore } from './libraryStore'
import { useFieldLabel } from './useFieldLabel'

const { t } = useI18n()
const library = useLibraryStore()
const fieldLabel = useFieldLabel()

const open = computed({
  get: () => library.editing !== null,
  set: (value) => {
    if (!value) library.editing = null
  },
})

const entry = computed(() => library.editing)
const deck = computed(() => library.decks.find((d) => d.id === entry.value?.deckId))

const cells = ref<Record<string, string>>({})
const tags = ref('')
const notes = ref('')
const ipa = ref('')
const statusAutomatic = ref(false)

// Edits stay in this draft until Save, so closing the dialog discards them.
watch(entry, (current) => {
  if (!current || !deck.value) return
  cells.value = Object.fromEntries(deck.value.schema.fields.map((f) => [f.key, cellOf(current, f)]))
  tags.value = current.tags.join(', ')
  notes.value = current.notes ?? ''
  ipa.value = current.ipa ?? ''
  statusAutomatic.value = false
}, { immediate: true })

const ownField = computed(() => deck.value?.schema.fields.find((f) => f.target === 'ownExamples'))

function addOwnExample(sentence: string) {
  if (ownField.value) cells.value[ownField.value.key] = appendOwnExample(cells.value[ownField.value.key] ?? '', sentence)
}

const sourceUrl = computed(() => safeHttpUrl(entry.value?.source.url))

async function save() {
  const current = entry.value
  if (!current || !deck.value) return
  const textField = deck.value.schema.fields.find((f) => f.target === 'text')
  if (textField && !normalizeText(cells.value[textField.key] ?? '')) {
    notify(t('editor.textRequired'), { tone: 'error' })
    return
  }

  // Applied in order, so one field's change is visible to the next.
  let merged: Entry = current
  let patch: Partial<Entry> = {}
  for (const field of deck.value.schema.fields) {
    const cell = cells.value[field.key] ?? ''
    if (cell === cellOf(current, field)) continue
    const change = editPatch(merged, field, cell)
    merged = { ...merged, ...change }
    patch = { ...patch, ...change }
  }

  const saved = await library.patchEntry(current, {
    ...patch,
    tags: [...new Set(tags.value.split(',').map((tag) => tag.trim()).filter(Boolean))],
    notes: notes.value.trim() || undefined,
    ipa: ipa.value.trim() || undefined,
    ...(statusAutomatic.value ? { statusManual: undefined } : {}),
  })
  if (saved) library.editing = null
}

function remove() {
  const current = entry.value
  if (!current) return
  library.editing = null
  void library.removeEntry(current)
}
</script>

<template>
  <AppModal v-model:open="open" wide :title="t('editor.title')" :description="t('editor.description')">
    <form v-if="deck" class="flex flex-col gap-4" data-testid="entry-editor" @submit.prevent="save">
      <RouterLink
        v-if="entry?.enrichment === 'draft'"
        :to="{ path: '/enrich', query: { entry: entry.id } }"
        class="lf-btn self-start"
        @click="library.editing = null"
      >
        <Sparkles :size="15" aria-hidden="true" />
        {{ t('enrich.openDraft') }}
      </RouterLink>
      <div class="grid gap-4 sm:grid-cols-2">
        <div
          v-for="field in deck.schema.fields"
          :key="field.key"
          :class="(field.type === 'list' || field.type === 'multiline' || field.target === 'text') && 'sm:col-span-2'"
        >
          <label class="block">
            <span class="lf-label">{{ fieldLabel(field) }}</span>
            <FieldInput
              v-model="cells[field.key]!"
              :field="field"
              :placeholder="field.target === 'ownExamples' ? t('library.ownExamplePrompt') : undefined"
            />
          </label>
          <p v-if="field.target === 'ownExamples'" class="mt-1 text-xs text-muted">{{ t('editor.ownExampleHint') }}</p>
          <button
            v-if="field.target === 'status' && entry?.statusManual && !statusAutomatic"
            type="button"
            class="lf-btn mt-1"
            @click="statusAutomatic = true"
          >
            {{ t('editor.statusAutomatic') }}
          </button>
          <p v-else-if="field.type === 'list'" class="mt-1 text-xs text-muted">{{ t('editor.listHint') }}</p>
          <OwnExampleCoach v-if="field.target === 'ownExamples' && entry" :key="entry.id" class="mt-2" :entry="entry" @add="addOwnExample" />
          <SourceLink v-if="field.target === 'source' && entry" :source="entry.source" class="mt-1" @click="library.editing = null" />
          <a
            v-if="field.target === 'source' && sourceUrl"
            :href="sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1 inline-flex min-h-8 items-center gap-1 text-xs text-accent underline-offset-2 hover:underline"
          >
            <ExternalLink :size="12" aria-hidden="true" />
            {{ t('editor.openSource') }}
          </a>
        </div>
        <label v-if="deck.schema.languageFeatures" class="block">
          <span class="lf-label">{{ t('fields.ipa') }}</span>
          <input v-model="ipa" type="text" class="lf-input font-mono" />
        </label>
        <label class="block">
          <span class="lf-label">{{ t('fields.tags') }}</span>
          <input v-model="tags" type="text" class="lf-input" :placeholder="t('editor.tagsHint')" />
        </label>
        <label class="block sm:col-span-2">
          <span class="lf-label">{{ t('fields.notes') }}</span>
          <textarea v-model="notes" rows="2" class="lf-input" />
        </label>
      </div>

      <div class="flex items-center justify-between gap-2 border-t border-line pt-4">
        <button type="button" class="lf-btn lf-btn-danger" @click="remove">{{ t('editor.delete') }}</button>
        <div class="flex gap-2">
          <button type="button" class="lf-btn" @click="library.editing = null">{{ t('editor.cancel') }}</button>
          <button type="submit" class="lf-btn lf-btn-primary">{{ t('editor.save') }}</button>
        </div>
      </div>
    </form>
  </AppModal>
</template>
