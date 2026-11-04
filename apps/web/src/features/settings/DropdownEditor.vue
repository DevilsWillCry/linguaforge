<script setup lang="ts">
import { Lock, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { deckRepository } from '@/data/repositories'
import type { FieldDef } from '@/domain/types'
import { useLibraryStore } from '@/features/library/libraryStore'
import { useFieldLabel } from '@/features/library/useFieldLabel'
import { notify } from '@/shared/ui/useToasts'

/** Automatic status progression in Phase 3 depends on these names. */
const LOCKED_STATUSES = ['New', 'Learning', 'Familiar', 'Natural']

const { t } = useI18n()
const library = useLibraryStore()
const fieldLabel = useFieldLabel()

const deckId = ref<string>()
const deck = computed(() => library.decks.find((d) => d.id === deckId.value) ?? library.decks[0])
const selectFields = computed(() => deck.value?.schema.fields.filter((f) => f.type === 'select') ?? [])
const newOptions = ref<Record<string, string>>({})

const isLocked = (field: FieldDef, option: string) =>
  field.target === 'status' && LOCKED_STATUSES.includes(option)

const hasOption = (field: FieldDef, option: string) =>
  (field.options ?? []).some((existing) => existing.toLowerCase() === option.toLowerCase())

async function run(action: () => Promise<void>) {
  try {
    await action()
  } catch (error) {
    console.error(error)
    notify(t('errors.save'), { tone: 'error' })
  }
}

function add(field: FieldDef) {
  const value = newOptions.value[field.key]?.trim()
  if (!value || !deck.value) return
  if (hasOption(field, value)) {
    notify(t('settings.dropdowns.exists', { name: value }), { tone: 'error' })
    return
  }
  const { id } = deck.value
  void run(() => deckRepository.setFieldOptions(id, field.key, [...(field.options ?? []), value]))
  newOptions.value[field.key] = ''
}

function rename(field: FieldDef, from: string, event: Event) {
  const input = event.target as HTMLInputElement
  const to = input.value.trim()
  if (!deck.value || to === from) return
  // Duplicates and blanks go back to the old name, rather than breaking the list.
  if (!to || hasOption(field, to)) {
    input.value = from
    if (to) notify(t('settings.dropdowns.exists', { name: to }), { tone: 'error' })
    return
  }
  const { id } = deck.value
  void run(() => deckRepository.renameOption(id, field.key, from, to))
}

function remove(field: FieldDef, option: string) {
  if (!deck.value) return
  const { id } = deck.value
  const remaining = (field.options ?? []).filter((existing) => existing !== option)
  void run(async () => {
    await deckRepository.setFieldOptions(id, field.key, remaining)
    notify(t('settings.dropdowns.removed', { name: option }))
  })
}
</script>

<template>
  <section class="rounded-card border border-line bg-surface p-5" data-testid="dropdown-editor">
    <h2 class="font-semibold">{{ t('settings.dropdowns.title') }}</h2>
    <p class="mt-1 text-sm text-muted">{{ t('settings.dropdowns.description') }}</p>

    <label class="mt-4 block max-w-xs">
      <span class="lf-label">{{ t('settings.dropdowns.deck') }}</span>
      <select v-model="deckId" class="lf-input">
        <option v-for="item in library.decks" :key="item.id" :value="item.id">{{ item.name }}</option>
      </select>
    </label>

    <div class="mt-4 flex flex-col gap-2">
      <details v-for="field in selectFields" :key="`${deck?.id}-${field.key}`" class="rounded-lg border border-line">
        <summary class="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-sm font-medium">
          {{ fieldLabel(field) }}
          <span class="text-xs font-normal text-muted tabular-nums">{{ field.options?.length ?? 0 }}</span>
        </summary>
        <ul class="flex flex-col gap-1 px-3 pb-3">
          <li v-for="option in field.options" :key="option" class="flex items-center gap-1">
            <input
              :value="option"
              type="text"
              class="lf-input"
              :readonly="isLocked(field, option)"
              :title="isLocked(field, option) ? t('settings.dropdowns.locked') : undefined"
              :aria-label="t('settings.dropdowns.optionLabel', { field: fieldLabel(field) })"
              @change="rename(field, option, $event)"
            />
            <span
              v-if="isLocked(field, option)"
              class="grid size-10 shrink-0 place-items-center text-muted"
              :title="t('settings.dropdowns.locked')"
              :aria-label="t('settings.dropdowns.locked')"
              role="img"
            >
              <Lock :size="14" aria-hidden="true" />
            </span>
            <button
              v-else
              type="button"
              class="grid size-10 shrink-0 place-items-center rounded text-muted hover:bg-raised"
              :aria-label="t('settings.dropdowns.remove', { name: option })"
              @click="remove(field, option)"
            >
              <Trash2 :size="14" aria-hidden="true" />
            </button>
          </li>
          <li>
            <form class="mt-1 flex gap-1" @submit.prevent="add(field)">
              <input
                v-model="newOptions[field.key]"
                type="text"
                class="lf-input"
                :aria-label="t('settings.dropdowns.addLabel', { field: fieldLabel(field) })"
                :placeholder="t('settings.dropdowns.addLabel', { field: fieldLabel(field) })"
              />
              <button type="submit" class="lf-btn shrink-0" :disabled="!newOptions[field.key]?.trim()">
                {{ t('settings.dropdowns.add') }}
              </button>
            </form>
          </li>
        </ul>
      </details>
    </div>
  </section>
</template>
