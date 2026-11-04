<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { cellOf } from '@/domain/rows'
import TagBadge from '@/shared/ui/TagBadge.vue'
import { useFieldLabel } from '@/features/library/useFieldLabel'
import { useReviewStore } from './reviewStore'

const { t } = useI18n()
const review = useReviewStore()
const fieldLabel = useFieldLabel()

const RESULT_COLORS = { correct: 'green', close: 'amber', wrong: 'rose' } as const
const VERDICT_COLORS = { natural: 'green', understandable: 'amber', incorrect: 'rose' } as const

/** The expected text, for modes where the answer differs from the entry's own text. */
const expected = computed(() => {
  const card = review.card
  return card && 'answer' in card ? card.answer : ''
})

/** Decks without language fields show their own columns instead. */
const otherFields = computed(() => {
  const { deck, current } = review
  if (!deck || deck.schema.languageFeatures || !current) return []
  return deck.schema.fields
    .filter((field) => !field.target)
    .map((field) => ({ key: field.key, label: fieldLabel(field), value: cellOf(current, field) }))
    .filter((field) => field.value)
})
</script>

<template>
  <div v-if="review.current" class="flex flex-col gap-3 rounded-lg bg-raised p-4 text-sm" aria-live="polite" data-testid="review-answer">
    <p v-if="review.result" class="flex flex-wrap items-center gap-2">
      <TagBadge :label="t(`review.results.${review.result}`)" :color="RESULT_COLORS[review.result]" />
      <span class="font-medium wrap-break-word" lang="en" data-testid="expected-answer">{{ expected }}</span>
    </p>

    <template v-if="review.feedback">
      <p class="flex flex-wrap items-center gap-2">
        <TagBadge :label="t(`enrich.coach.verdict.${review.feedback.verdict}`)" :color="VERDICT_COLORS[review.feedback.verdict]" />
      </p>
      <p v-if="!review.feedback.usesTarget" class="font-medium">{{ t('enrich.coach.missingTarget', { name: review.current.text }) }}</p>
      <dl class="flex flex-col gap-2" data-testid="review-feedback">
        <div><dt class="text-xs text-muted">{{ t('enrich.coach.grammar') }}</dt><dd>{{ review.feedback.grammar }}</dd></div>
        <div><dt class="text-xs text-muted">{{ t('enrich.coach.naturalness') }}</dt><dd>{{ review.feedback.naturalness }}</dd></div>
        <div><dt class="text-xs text-muted">{{ t('enrich.coach.toneFit') }}</dt><dd>{{ review.feedback.toneFit }}</dd></div>
        <div><dt class="text-xs text-muted">{{ t('enrich.coach.betterVersion') }}</dt><dd class="font-medium" lang="en">{{ review.feedback.betterVersion }}</dd></div>
      </dl>
    </template>

    <div class="border-t border-line pt-3">
      <p class="font-semibold wrap-break-word" lang="en">{{ review.current.text }}</p>
      <p v-if="review.current.ipa" class="font-mono text-xs text-muted">{{ review.current.ipa }}</p>
    </div>
    <ul v-if="review.current.meanings.length" class="flex flex-col gap-1">
      <li v-for="meaning in review.current.meanings" :key="meaning" class="whitespace-pre-line">{{ meaning }}</li>
    </ul>
    <ul v-if="review.current.realExamples.length" class="flex flex-col gap-1 text-muted" lang="en">
      <li v-for="example in review.current.realExamples" :key="example" class="whitespace-pre-line">{{ example }}</li>
    </ul>
    <p v-if="review.current.notes" class="text-muted">{{ review.current.notes }}</p>
    <dl v-if="otherFields.length" class="flex flex-col gap-2">
      <div v-for="field in otherFields" :key="field.key">
        <dt class="text-xs text-muted">{{ field.label }}</dt>
        <dd class="whitespace-pre-line">{{ field.value }}</dd>
      </div>
    </dl>

    <button
      v-if="review.card?.mode === 'useIt' && review.typed.trim()"
      type="button"
      class="lf-btn self-start"
      :disabled="review.sentenceSaved"
      @click="review.saveSentence()"
    >
      {{ t('enrich.coach.add') }}
    </button>
  </div>
</template>
