<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { feedbackTarget, sameSentence } from '@/domain/enrichment'
import type { Entry, SentenceFeedback } from '@/domain/types'
import { useLibraryStore } from '@/features/library/libraryStore'
import TagBadge from '@/shared/ui/TagBadge.vue'
import { notify } from '@/shared/ui/useToasts'
import { AiRequestError, requestFeedback } from './enrichmentApi'
import { useEnrichmentStore } from './enrichmentStore'

const props = defineProps<{ entry: Entry }>()
const emit = defineEmits<{ add: [sentence: string] }>()

const { t } = useI18n()
const library = useLibraryStore()
const enrichment = useEnrichmentStore()

const sentence = ref('')
const asking = ref(false)
const result = ref<{ sentence: string; feedback: SentenceFeedback } | null>(props.entry.aiFeedback ?? null)

const hasSentence = computed(() => sentence.value.trim().length > 0)
const VERDICT_COLORS = { natural: 'green', understandable: 'amber', incorrect: 'rose' } as const

async function ask() {
  const text = sentence.value.trim()
  if (!text || asking.value) return

  const cached = props.entry.aiFeedback
  if (cached && sameSentence(cached.sentence, text)) {
    result.value = cached
    return
  }
  if (!enrichment.budgetLeft()) {
    notify(t('enrich.errors.budget'), { tone: 'error' })
    return
  }

  asking.value = true
  try {
    const { feedback, usage } = await requestFeedback({ target: feedbackTarget(props.entry), sentence: text })
    enrichment.spend(usage)
    const saved = { sentence: text, feedback }
    result.value = saved
    // Cached on the entry, so the same question never has to be paid for twice.
    await library.patchEntry(props.entry, { aiFeedback: saved })
  } catch (error) {
    const code = error instanceof AiRequestError ? error.code : 'failed'
    notify(t(`enrich.errors.${code}`), { tone: 'error' })
  } finally {
    asking.value = false
  }
}

function add() {
  const text = sentence.value.trim()
  if (!text) return
  emit('add', text)
  sentence.value = ''
  notify(t('enrich.coach.added'))
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded-card border border-line p-3" data-testid="own-example-coach">
    <label class="block">
      <span class="lf-label">{{ t('enrich.coach.label') }}</span>
      <textarea v-model="sentence" rows="2" class="lf-input" />
    </label>
    <p class="text-xs text-muted">{{ enrichment.aiConfigured ? t('enrich.coach.hint') : t('enrich.coach.off') }}</p>
    <div class="flex flex-wrap gap-2">
      <button
        v-if="enrichment.aiConfigured"
        type="button"
        class="lf-btn"
        :disabled="!hasSentence || asking"
        @click="ask"
      >
        {{ asking ? t('enrich.coach.asking') : t('enrich.coach.ask') }}
      </button>
      <button type="button" class="lf-btn" :disabled="!hasSentence" @click="add">{{ t('enrich.coach.add') }}</button>
    </div>

    <div v-if="result" class="flex flex-col gap-2 border-t border-line pt-3 text-sm" aria-live="polite" data-testid="sentence-feedback">
      <p class="text-xs text-muted">«{{ result.sentence }}»</p>
      <p>
        <TagBadge :label="t(`enrich.coach.verdict.${result.feedback.verdict}`)" :color="VERDICT_COLORS[result.feedback.verdict]" />
      </p>
      <p v-if="!result.feedback.usesTarget" class="font-medium">{{ t('enrich.coach.missingTarget', { name: entry.text }) }}</p>
      <dl class="flex flex-col gap-2">
        <div>
          <dt class="text-xs text-muted">{{ t('enrich.coach.grammar') }}</dt>
          <dd>{{ result.feedback.grammar }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">{{ t('enrich.coach.naturalness') }}</dt>
          <dd>{{ result.feedback.naturalness }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">{{ t('enrich.coach.toneFit') }}</dt>
          <dd>{{ result.feedback.toneFit }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">{{ t('enrich.coach.betterVersion') }}</dt>
          <dd class="font-medium" lang="en">{{ result.feedback.betterVersion }}</dd>
        </div>
      </dl>
      <p class="text-xs text-muted">{{ t('enrich.coach.retype') }}</p>
    </div>
  </div>
</template>
