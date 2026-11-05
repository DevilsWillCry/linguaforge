<script setup lang="ts">
import { nextTick, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { entryRepository } from '@/data/repositories'
import { checkAnswer, type AnswerResult } from '@/domain/answers'
import type { Entry } from '@/domain/types'

const QUESTIONS = 3

const { t } = useI18n()
const questions = shallowRef<Entry[]>([])
const index = ref(0)
const typed = ref('')
const result = ref<AnswerResult | null>(null)
const right = ref(0)
const box = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const entries = await entryRepository.getMany(await entryRepository.reviewedSince(midnight))
  // Retrieval needs a clue that isn't the answer, so items with no meaning can't be asked.
  questions.value = entries.filter((entry) => entry.meanings.length).slice(0, QUESTIONS)
})

function check() {
  const entry = questions.value[index.value]
  if (!entry || result.value || !typed.value.trim()) return
  result.value = checkAnswer(entry.text, typed.value)
  if (result.value !== 'wrong') right.value++
}

async function next() {
  index.value++
  typed.value = ''
  result.value = null
  await nextTick()
  box.value?.focus()
}
</script>

<template>
  <section class="flex w-full max-w-md flex-col gap-2 rounded-lg border border-line p-3" data-testid="today-recap">
    <h3 class="text-sm font-semibold">{{ t('today.recap.title') }}</h3>
    <p v-if="!questions.length" class="text-sm text-muted">{{ t('today.recap.empty') }}</p>
    <p v-else-if="index >= questions.length" class="text-sm font-medium" role="status" data-testid="recap-done">
      {{ t('today.recap.done', { right, total: questions.length }) }}
    </p>
    <form v-else class="flex flex-col gap-2" @submit.prevent="result ? next() : check()">
      <p class="text-xs text-muted">{{ t('today.recap.question', { n: index + 1, total: questions.length }) }}</p>
      <p class="text-sm">{{ questions[index]!.meanings[0] }}</p>
      <label class="block">
        <span class="lf-label">{{ t('today.recap.answer') }}</span>
        <input ref="box" v-model="typed" class="lf-input" lang="en" spellcheck="false" autocomplete="off" :readonly="Boolean(result)" />
      </label>
      <p v-if="result" class="text-sm" role="status" data-testid="recap-result">
        {{ result === 'wrong' ? t('today.recap.wrong') : t(`today.recap.${result}`) }}<span v-if="result !== 'correct'" lang="en">: {{ questions[index]!.text }}</span>
      </p>
      <button type="submit" class="lf-btn self-start">{{ result ? t('today.recap.next') : t('today.recap.check') }}</button>
    </form>
  </section>
</template>
