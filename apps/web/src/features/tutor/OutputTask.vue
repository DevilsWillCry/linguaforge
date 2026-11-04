<script setup lang="ts">
import { CheckCircle2, Mic, MicOff } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { wordCount } from '@/domain/tutor'
import TagBadge from '@/shared/ui/TagBadge.vue'
import { notify } from '@/shared/ui/useToasts'
import { useTutorStore } from './tutorStore'
import { useSpeechInput } from './useSpeechInput'
import WordDiff from './WordDiff.vue'

const { t } = useI18n()
const tutor = useTutorStore()

const text = ref('')
const words = computed(() => wordCount(text.value))

const mic = useSpeechInput(
  (heard) => {
    text.value = text.value ? `${text.value} ${heard}` : heard
  },
  () => notify(t('tutor.micFailed'), { tone: 'error' }),
)

function again() {
  tutor.clearReview()
  text.value = ''
}

const itemLabel = (item: { used: boolean; correct: boolean }) =>
  t(item.correct ? 'tutor.output.correct' : item.used ? 'tutor.output.wrong' : 'tutor.output.unused')
const itemColor = (item: { used: boolean; correct: boolean }) => (item.correct ? 'green' : item.used ? 'amber' : undefined)
</script>

<template>
  <section class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4" data-testid="output-task">
    <p class="text-sm">{{ t('tutor.output.prompt') }}</p>
    <ul v-if="tutor.targets.length" class="flex flex-wrap gap-1.5" data-testid="output-targets">
      <li v-for="target in tutor.targets" :key="target.id"><TagBadge :label="target.text" /></li>
    </ul>
    <p v-else class="text-sm text-muted">{{ t('tutor.noTargets') }}</p>

    <template v-if="!tutor.review">
      <label class="block">
        <span class="lf-label">{{ t('tutor.output.label') }}</span>
        <textarea v-model="text" rows="7" class="lf-input" lang="en" spellcheck="false" />
      </label>
      <p class="text-xs text-muted tabular-nums" data-testid="output-words">{{ t('tutor.output.words', { n: words }) }}</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="lf-btn lf-btn-primary" :disabled="!text.trim() || tutor.reviewing" @click="tutor.submitOutput(text)">
          {{ tutor.reviewing ? t('tutor.output.submitting') : t('tutor.output.submit') }}
        </button>
        <button v-if="mic.supported" type="button" class="lf-btn" :aria-pressed="mic.listening.value" @click="mic.listening.value ? mic.stop() : mic.start()">
          <component :is="mic.listening.value ? MicOff : Mic" :size="15" aria-hidden="true" />
          {{ mic.listening.value ? t('tutor.micStop') : t('tutor.mic') }}
        </button>
      </div>
      <p v-if="mic.supported" class="text-xs text-muted">{{ t('tutor.micPrivacy') }}</p>
    </template>

    <div v-else class="flex flex-col gap-3 text-sm" aria-live="polite" data-testid="output-review">
      <div>
        <h3 class="text-xs text-muted">{{ t('tutor.output.feedback') }}</h3>
        <p>{{ tutor.review.feedback }}</p>
      </div>
      <div>
        <h3 class="text-xs text-muted">{{ t('tutor.output.changes') }}</h3>
        <WordDiff :before="tutor.reviewedText" :after="tutor.review.corrected" />
      </div>
      <div>
        <h3 class="text-xs text-muted">{{ t('tutor.output.items') }}</h3>
        <ul class="mt-1 flex flex-col gap-2">
          <li v-for="item in tutor.review.items" :key="item.text" class="flex flex-col gap-1" data-testid="output-item">
            <p class="flex flex-wrap items-center gap-2">
              <span class="font-medium" lang="en">{{ item.text }}</span>
              <TagBadge :label="itemLabel(item)" :icon="item.correct ? CheckCircle2 : undefined" :color="itemColor(item)" />
            </p>
            <p class="text-muted">{{ item.note }}</p>
          </li>
        </ul>
      </div>
      <button type="button" class="lf-btn self-start" @click="again">{{ t('tutor.output.again') }}</button>
    </div>
  </section>
</template>
