<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { enrichmentRequest } from '@/domain/enrichment'
import { createEntry } from '@/domain/rows'
import type { EnrichmentDraft } from '@/domain/types'
import {
  AiRequestError,
  fetchAiModels,
  fetchAiSettings,
  requestEnrichment,
  resetAiSettings,
  saveAiSettings,
  type AiModelOption,
  type AiProviderId,
  type AiSettingsView,
} from '@/features/enrichment/enrichmentApi'
import { useEnrichmentStore } from '@/features/enrichment/enrichmentStore'
import { useLibraryStore } from '@/features/library/libraryStore'
import { notify } from '@/shared/ui/useToasts'

const { t, n } = useI18n()
const enrichment = useEnrichmentStore()
const library = useLibraryStore()

const PROVIDERS: AiProviderId[] = ['openrouter', 'anthropic', 'custom']

const saved = ref<AiSettingsView | null>(null)
const unreachable = ref(false)

const provider = ref<AiProviderId>('openrouter')
const model = ref('')
const tutorModel = ref('')
const baseUrl = ref('')
const apiKey = ref('')

const models = ref<AiModelOption[]>([])
const modelsState = ref<'idle' | 'loading' | 'failed'>('idle')
const freeOnly = ref(true)

// A local copy: a bound :value would reset what's being typed each time this panel re-renders.
const budgetInput = ref(enrichment.dailyBudget)

const busy = ref(false)
const testing = ref(false)
const testDraft = ref<EnrichmentDraft | null>(null)

/** The saved key only stays with the service and address it was entered for. */
const keyIsKept = computed(
  () =>
    Boolean(saved.value?.hasKey) &&
    saved.value?.provider === provider.value &&
    (provider.value !== 'custom' || saved.value?.baseUrl === baseUrl.value.trim().replace(/\/+$/, '')),
)

const shownModels = computed(() =>
  provider.value === 'openrouter' && freeOnly.value ? models.value.filter((m) => m.free) : models.value,
)

const isFreeModel = computed(() => {
  if (provider.value !== 'openrouter') return false
  const id = model.value.trim()
  return id.endsWith(':free') || id === 'openrouter/free' || Boolean(models.value.find((m) => m.id === id)?.free)
})

const canSave = computed(
  () =>
    !busy.value &&
    Boolean(model.value.trim()) &&
    (provider.value === 'custom' ? Boolean(baseUrl.value.trim()) : Boolean(apiKey.value.trim()) || keyIsKept.value),
)

/** A test runs what is saved, so unsaved changes have to be saved first. */
const isSaved = computed(
  () =>
    saved.value?.source === 'server' ||
    (saved.value?.source === 'user' &&
      saved.value.provider === provider.value &&
      saved.value.model === model.value.trim() &&
      (saved.value.tutorModel ?? '') === tutorModel.value.trim() &&
      !apiKey.value.trim() &&
      (provider.value !== 'custom' || saved.value.baseUrl === baseUrl.value.trim().replace(/\/+$/, ''))),
)

const errorMessage = (error: unknown) =>
  t(`enrich.errors.${error instanceof AiRequestError ? error.code : 'failed'}`)

async function loadModels() {
  models.value = []
  if (provider.value === 'custom' && !baseUrl.value.trim()) {
    modelsState.value = 'idle'
    return
  }
  modelsState.value = 'loading'
  const asked = provider.value
  try {
    const { models: list } = await fetchAiModels(asked, baseUrl.value.trim() || undefined)
    if (asked !== provider.value) return
    models.value = list
    modelsState.value = 'idle'
  } catch {
    if (asked === provider.value) modelsState.value = 'failed'
  }
}

function applySaved(view: AiSettingsView) {
  saved.value = view
  apiKey.value = ''
  if (view.source !== 'user' || !view.provider) return
  provider.value = view.provider
  model.value = view.model ?? ''
  tutorModel.value = view.tutorModel ?? ''
  baseUrl.value = view.baseUrl ?? ''
}

onMounted(async () => {
  try {
    applySaved(await fetchAiSettings())
  } catch {
    unreachable.value = true
    return
  }
  void loadModels()
})

watch(provider, () => {
  testDraft.value = null
  // Each service names its models differently, so the old choice wouldn't carry over.
  model.value = saved.value?.provider === provider.value ? (saved.value.model ?? '') : ''
  tutorModel.value = saved.value?.provider === provider.value ? (saved.value.tutorModel ?? '') : ''
  void loadModels()
})

async function save() {
  if (!canSave.value) return
  busy.value = true
  testDraft.value = null
  try {
    const view = await saveAiSettings({
      provider: provider.value,
      model: model.value.trim(),
      ...(tutorModel.value.trim() ? { tutorModel: tutorModel.value.trim() } : {}),
      ...(provider.value === 'custom' ? { baseUrl: baseUrl.value.trim() } : {}),
      ...(apiKey.value.trim() ? { apiKey: apiKey.value.trim() } : {}),
    })
    applySaved(view)
    notify(t('settings.ai.saved'))
    await enrichment.retry()
  } catch (error) {
    notify(errorMessage(error), { tone: 'error' })
  } finally {
    busy.value = false
  }
}

async function reset() {
  busy.value = true
  testDraft.value = null
  try {
    saved.value = await resetAiSettings()
    apiKey.value = ''
    model.value = ''
    tutorModel.value = ''
    notify(t('settings.ai.resetDone'))
    await enrichment.retry()
  } catch (error) {
    notify(errorMessage(error), { tone: 'error' })
  } finally {
    busy.value = false
  }
}

async function test() {
  const deck = library.decks.find((candidate) => candidate.schema.languageFeatures)
  if (!deck || !enrichment.budgetLeft()) {
    notify(t('enrich.errors.budget'), { tone: 'error' })
    return
  }
  testing.value = true
  testDraft.value = null
  try {
    const { results, usage } = await requestEnrichment(enrichmentRequest([createEntry(deck, 'figure out')], deck))
    enrichment.spend(usage)
    testDraft.value = results[0] ?? null
  } catch (error) {
    notify(errorMessage(error), { tone: 'error' })
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-4 rounded-card border border-line bg-surface p-5" data-testid="ai-settings">
    <h2 class="font-semibold">{{ t('settings.ai.title') }}</h2>

    <p class="text-sm" role="status" data-testid="ai-status">
      <template v-if="unreachable">{{ t('settings.ai.statusUnreachable') }}</template>
      <template v-else>{{ enrichment.aiConfigured ? t('settings.ai.statusOn') : t('settings.ai.statusOff') }}</template>
    </p>
    <p v-if="saved?.source === 'server'" class="max-w-prose text-sm text-muted">{{ t('settings.ai.usingServer') }}</p>
    <p class="max-w-prose text-sm text-muted">{{ t('settings.ai.description') }}</p>

    <form v-if="!unreachable" class="flex max-w-xl flex-col gap-4" @submit.prevent="save">
      <label class="block">
        <span class="lf-label">{{ t('settings.ai.provider') }}</span>
        <select v-model="provider" class="lf-input">
          <option v-for="id in PROVIDERS" :key="id" :value="id">{{ t(`settings.ai.providers.${id}`) }}</option>
        </select>
      </label>

      <div v-if="provider === 'custom'">
        <label class="block">
          <span class="lf-label">{{ t('settings.ai.baseUrl') }}</span>
          <input v-model="baseUrl" type="url" class="lf-input font-mono" autocomplete="off" spellcheck="false" @change="loadModels" />
        </label>
        <p class="mt-1 text-xs text-muted">{{ t('settings.ai.baseUrlHint') }}</p>
      </div>

      <div>
        <label class="block">
          <span class="lf-label">{{ t('settings.ai.apiKey') }}</span>
          <input
            v-model="apiKey"
            type="password"
            class="lf-input font-mono"
            autocomplete="new-password"
            spellcheck="false"
          />
        </label>
        <p class="mt-1 text-xs text-muted">
          <template v-if="keyIsKept">{{ t('settings.ai.apiKeySaved', { hint: saved?.keyHint ?? '…' }) }}</template>
          <template v-else-if="provider === 'custom'">{{ t('settings.ai.apiKeyOptional') }}</template>
          {{ t('settings.ai.apiKeySafety') }}
        </p>
      </div>

      <div>
        <label class="block">
          <span class="lf-label">{{ t('settings.ai.model') }}</span>
          <input
            v-model="model"
            type="text"
            class="lf-input font-mono"
            list="lf-ai-models"
            autocomplete="off"
            spellcheck="false"
            :placeholder="t('settings.ai.modelPlaceholder')"
          />
        </label>
        <datalist id="lf-ai-models">
          <option v-for="option in shownModels" :key="option.id" :value="option.id">{{ option.name }}</option>
        </datalist>
        <p class="mt-1 text-xs text-muted" aria-live="polite">
          <template v-if="modelsState === 'loading'">{{ t('settings.ai.loadingModels') }}</template>
          <template v-else-if="modelsState === 'failed'">{{ t('settings.ai.modelsFailed') }}</template>
          <template v-else-if="shownModels.length">{{ t('settings.ai.modelCount', { n: shownModels.length }) }}</template>
        </p>
        <label v-if="provider === 'openrouter'" class="mt-2 inline-flex min-h-8 items-center gap-2 text-sm">
          <input v-model="freeOnly" type="checkbox" />
          {{ t('settings.ai.freeOnly') }}
        </label>
      </div>

      <label class="block">
        <span class="lf-label">{{ t('settings.ai.tutorModel') }}</span>
        <input
          v-model="tutorModel"
          type="text"
          class="lf-input font-mono"
          list="lf-ai-models"
          autocomplete="off"
          spellcheck="false"
          data-testid="tutor-model"
          :placeholder="model"
        />
        <span class="mt-1 block text-xs text-muted">{{ t('settings.ai.tutorModelHint') }}</span>
      </label>

      <p v-if="isFreeModel" class="rounded-lg border border-line bg-raised p-3 text-sm" data-testid="free-warning">
        {{ t('settings.ai.freeWarning') }}
      </p>

      <div class="flex flex-wrap gap-2">
        <button type="submit" class="lf-btn lf-btn-primary" :disabled="!canSave">{{ t('settings.ai.save') }}</button>
        <button type="button" class="lf-btn" :disabled="!enrichment.aiConfigured || !isSaved || testing" @click="test">
          {{ testing ? t('settings.ai.testing') : t('settings.ai.test') }}
        </button>
        <button v-if="saved?.source === 'user'" type="button" class="lf-btn lf-btn-danger" :disabled="busy" @click="reset">
          {{ t('settings.ai.reset') }}
        </button>
      </div>
      <p class="text-xs text-muted">{{ t('settings.ai.testHint') }}</p>
    </form>

    <div v-if="testDraft" class="flex max-w-xl flex-col gap-2 rounded-lg bg-raised p-3 text-sm" aria-live="polite" data-testid="ai-test-result">
      <p class="text-xs text-muted">{{ t('settings.ai.testResult') }}</p>
      <p v-if="testDraft.ipa" class="font-mono">{{ testDraft.ipa }}</p>
      <ul class="flex flex-col gap-1" lang="en">
        <li v-for="meaning in testDraft.meanings" :key="meaning">{{ meaning }}</li>
      </ul>
      <ul class="flex flex-col gap-1 text-muted" lang="en">
        <li v-for="example in testDraft.realExamples" :key="example">{{ example }}</li>
      </ul>
      <p v-if="testDraft.notes">{{ testDraft.notes }}</p>
    </div>

    <div class="flex flex-col gap-1 border-t border-line pt-4">
      <label class="block max-w-xs">
        <span class="lf-label">{{ t('settings.ai.budget') }}</span>
        <input
          v-model.number="budgetInput"
          type="number"
          min="0"
          step="1000"
          class="lf-input"
          @change="enrichment.setBudget(budgetInput)"
        />
      </label>
      <p class="text-xs text-muted">
        {{ t('settings.ai.used', { used: n(enrichment.usedToday), budget: n(enrichment.dailyBudget) }) }}
      </p>
    </div>
  </section>
</template>
