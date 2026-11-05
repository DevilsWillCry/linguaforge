<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { AlertTriangle, CheckCircle2, Undo2, Volume2 } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import type { ReviewRating } from '@/domain/review'
import { useEnrichmentStore } from '@/features/enrichment/enrichmentStore'
import { useLibraryStore } from '@/features/library/libraryStore'
import { useVoiceStore } from '@/features/voice/voiceStore'
import { stopSpeaking } from '@/features/voice/speech'
import AnswerDetails from './AnswerDetails.vue'
import { useReviewStore } from './reviewStore'

const { t } = useI18n()
const review = useReviewStore()
const library = useLibraryStore()
const enrichment = useEnrichmentStore()

const answerInput = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
const RATINGS: ReviewRating[] = [1, 2, 3, 4]
const RATING_KEYS = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' } as const

const voice = useVoiceStore()

const isTypingCard = computed(() => review.card?.mode !== 'useIt')

onMounted(() => void review.start())
onBeforeUnmount(stopSpeaking)

// A new card puts the cursor in its answer box, so the whole session works from the keyboard.
watch(
  () => review.phase,
  async (phase) => {
    if (phase !== 'answering') return
    await nextTick()
    answerInput.value?.focus()
  },
)

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  // While the entry editor is open, or in a box being typed in, keys are ordinary typing.
  const inField =
    event.target instanceof HTMLElement && event.target.matches('input:not([readonly]), textarea:not([readonly]), select')
  if (inField || library.editing) return

  if (review.phase === 'revealed' && ['1', '2', '3', '4'].includes(event.key) && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    void review.grade(Number(event.key) as ReviewRating)
  } else if (event.key.toLowerCase() === 'u' && !event.ctrlKey && !event.metaKey && review.canUndo) {
    void review.undo()
  }
})

// Works from inside the answer box too, because listening means typing while replaying.
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.altKey && event.key.toLowerCase() === 'r') {
    event.preventDefault()
    review.playSpeech()
  }
})

function onAnswerKey(event: KeyboardEvent) {
  // A sentence can use several lines, so there it takes Ctrl+Enter.
  if (event.key === 'Enter' && (isTypingCard.value || event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    void review.reveal()
  }
}
</script>

<template>
  <section class="mx-auto flex max-w-2xl flex-col gap-4">
    <header class="flex flex-wrap items-baseline justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('nav.review') }}</h1>
      <p v-if="review.phase !== 'finished' && review.current" class="text-sm text-muted tabular-nums" data-testid="review-progress">
        {{ t('review.remaining', { n: review.remaining, minutes: review.minutesLeft }) }}
      </p>
    </header>

    <p v-if="review.phase === 'loading' || review.phase === 'idle'" class="text-sm text-muted">{{ t('loading') }}</p>

    <div v-else-if="review.phase === 'finished'" class="flex flex-col items-start gap-3 rounded-card border border-line bg-surface p-6" data-testid="review-finished">
      <CheckCircle2 :size="24" aria-hidden="true" class="text-accent" />
      <h2 class="text-lg font-semibold">
        {{ review.answered ? t('review.doneTitle', { n: review.answered }) : t('review.emptyTitle') }}
      </h2>
      <p class="text-sm text-muted">{{ review.answered ? t('review.doneBody') : t('review.emptyBody', { deck: review.deck?.name ?? '' }) }}</p>
      <div class="flex flex-wrap gap-2">
        <button v-if="review.canUndo" type="button" class="lf-btn" @click="review.undo()">
          <Undo2 :size="15" aria-hidden="true" />
          {{ t('review.undo') }}
        </button>
        <RouterLink to="/" class="lf-btn lf-btn-primary">{{ t('review.backToToday') }}</RouterLink>
      </div>
    </div>

    <article v-else-if="review.card && review.current" class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:p-6" data-testid="review-card" :data-mode="review.card.mode">
      <p class="text-xs font-medium text-muted">{{ t(`review.modes.${review.card.mode}.title`) }}</p>
      <p class="text-sm text-muted">{{ t(`review.modes.${review.card.mode}.prompt`) }}</p>

      <!-- Cloze: the sentence with the target hidden. -->
      <template v-if="review.card.mode === 'cloze'">
        <p class="text-lg whitespace-pre-line" lang="en" data-testid="cloze-sentence">
          <template v-for="(part, index) in review.card.parts" :key="index">
            <mark v-if="part.hidden && review.phase === 'revealed'" class="rounded bg-raised px-1 font-semibold text-ink">{{ part.text }}</mark>
            <span v-else-if="part.hidden" class="font-mono text-muted" :aria-label="t('review.blank')">_____</span>
            <template v-else>{{ part.text }}</template>
          </template>
        </p>
        <button v-if="!review.hintShown && review.phase === 'answering' && review.card.hint.length" type="button" class="lf-btn self-start" @click="review.hintShown = true">
          {{ t('review.showHint') }}
        </button>
        <ul v-if="review.hintShown" class="flex flex-col gap-1 text-sm text-muted" data-testid="review-hint">
          <li v-for="clue in review.card.hint" :key="clue">{{ clue }}</li>
        </ul>
      </template>

      <!-- Production: the meaning, with the target removed from it. -->
      <ul v-else-if="review.card.mode === 'production'" class="flex flex-col gap-1 text-lg" data-testid="production-clues">
        <li v-for="clue in review.card.clues" :key="clue">{{ clue }}</li>
      </ul>

      <!-- Listening: only the audio. -->
      <div v-else-if="review.card.mode === 'listening'" class="flex flex-wrap gap-2">
        <button type="button" class="lf-btn" @click="review.playSpeech()">
          <Volume2 :size="15" aria-hidden="true" />
          {{ t('review.listen') }}
          <kbd class="text-xs text-muted">Alt R</kbd>
        </button>
        <button type="button" class="lf-btn" @click="review.playSpeech(0.7)">{{ t('review.listenSlow') }}</button>
        <span v-if="voice.preparing" class="self-center text-sm text-muted" role="status">{{ t('settings.voice.preparing') }}</span>
      </div>

      <!-- Use it: the item itself, since the task is to produce a new sentence with it. -->
      <div v-else-if="review.card.mode === 'useIt'" class="flex flex-col gap-1">
        <p class="text-lg font-semibold wrap-break-word" lang="en">{{ review.card.target }}</p>
        <ul class="flex flex-col gap-1 text-sm text-muted">
          <li v-for="meaning in review.card.meanings" :key="meaning">{{ meaning }}</li>
        </ul>
      </div>

      <label class="block">
        <span class="lf-label">{{ t(`review.modes.${review.card.mode}.answer`) }}</span>
        <textarea
          v-if="review.card.mode === 'useIt'"
          ref="answerInput"
          v-model="review.typed"
          rows="3"
          class="lf-input"
          lang="en"
          spellcheck="false"
          :readonly="review.phase !== 'answering'"
          @keydown="onAnswerKey"
        />
        <input
          v-else
          ref="answerInput"
          v-model="review.typed"
          type="text"
          class="lf-input"
          lang="en"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :readonly="review.phase !== 'answering'"
          @keydown="onAnswerKey"
        />
      </label>

      <!-- Retrieval first: nothing about the answer exists on the page before this. -->
      <div v-if="review.phase === 'answering'" class="flex flex-wrap gap-2">
        <button type="button" class="lf-btn lf-btn-primary" @click="review.reveal()">
          {{ review.card.mode === 'useIt' ? t('review.checkSentence') : t('review.check') }}
        </button>
        <span class="self-center text-xs text-muted">{{ review.card.mode === 'useIt' ? 'Ctrl + Enter' : 'Enter' }}</span>
      </div>
      <p v-else-if="review.phase === 'checking'" class="text-sm text-muted" aria-live="polite">{{ t('enrich.coach.asking') }}</p>

      <template v-else-if="review.phase === 'revealed'">
        <AnswerDetails />

        <div v-if="review.currentIsLeech" class="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-raised p-3 text-sm" data-testid="leech-notice">
          <AlertTriangle :size="16" aria-hidden="true" class="shrink-0" />
          <p class="min-w-0 flex-1">{{ t('review.leech') }}</p>
          <button type="button" class="lf-btn" @click="library.editing = review.current">{{ t('enrich.edit') }}</button>
        </div>

        <div role="group" :aria-label="t('review.gradeLabel')" class="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="grades">
          <button
            v-for="rating in RATINGS"
            :key="rating"
            type="button"
            class="lf-btn min-h-12 justify-between"
            :class="review.suggestion === rating && 'lf-btn-primary'"
            @click="review.grade(rating)"
          >
            {{ t(`review.grades.${RATING_KEYS[rating]}`) }}
            <kbd class="text-xs opacity-70">{{ rating }}</kbd>
          </button>
        </div>
      </template>

      <div v-if="review.canUndo" class="border-t border-line pt-3">
        <button type="button" class="lf-btn" @click="review.undo()">
          <Undo2 :size="15" aria-hidden="true" />
          {{ t('review.undo') }}
          <kbd class="text-xs text-muted">U</kbd>
        </button>
      </div>
    </article>

    <p v-if="review.phase === 'answering' && review.card?.mode === 'useIt' && !enrichment.aiConfigured" class="text-xs text-muted">
      {{ t('review.noAi') }}
    </p>
    <p v-if="review.deck?.schema.languageFeatures && !review.canSpeak && review.phase !== 'loading'" class="text-xs text-muted" data-testid="no-voice">
      {{ t('review.noVoice') }}
    </p>
  </section>
</template>
