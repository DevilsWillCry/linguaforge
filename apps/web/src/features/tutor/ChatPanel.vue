<script setup lang="ts">
import { BookmarkPlus, CheckCircle2, Mic, MicOff, Volume2 } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { speak, stopSpeaking } from '@/features/voice/speech'
import { useVoiceStore } from '@/features/voice/voiceStore'
import TagBadge from '@/shared/ui/TagBadge.vue'
import { notify } from '@/shared/ui/useToasts'
import { useTutorStore } from './tutorStore'
import { useSpeechInput } from './useSpeechInput'
import WordDiff from './WordDiff.vue'

const { t } = useI18n()
const tutor = useTutorStore()
const voice = useVoiceStore()

const draft = ref('')
const list = ref<HTMLElement | null>(null)
const box = ref<HTMLTextAreaElement | null>(null)

const mic = useSpeechInput(
  (heard) => {
    draft.value = draft.value ? `${draft.value} ${heard}` : heard
  },
  () => notify(t('tutor.micFailed'), { tone: 'error' }),
)

async function toBottom() {
  await nextTick()
  if (list.value) list.value.scrollTop = list.value.scrollHeight
}
onMounted(toBottom)
onBeforeUnmount(stopSpeaking)
watch(() => tutor.conversation?.messages.length, toBottom)

async function send() {
  const text = draft.value
  if (!text.trim() || tutor.sending) return
  // Cleared first so typing feels immediate, and restored if sending fails.
  draft.value = ''
  if (!(await tutor.send(text))) draft.value = text
  await nextTick()
  box.value?.focus()
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void send()
  }
}
</script>

<template>
  <section v-if="tutor.conversation" class="flex flex-col gap-3" data-testid="chat">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-semibold">{{ t(`tutor.scenarios.${tutor.conversation.scenario}`) }}</h2>
      <button type="button" class="lf-btn" @click="tutor.finish()">{{ t('tutor.newChat') }}</button>
    </header>

    <div v-if="tutor.targets.length" class="flex flex-col gap-1.5" data-testid="chat-targets">
      <p class="text-xs text-muted">{{ t('tutor.targets') }}</p>
      <ul class="flex flex-wrap gap-1.5">
        <li v-for="target in tutor.targets" :key="target.id" :data-used="tutor.usedTargets.has(target.text)">
          <TagBadge
            :label="target.text"
            :icon="tutor.usedTargets.has(target.text) ? CheckCircle2 : undefined"
            :color="tutor.usedTargets.has(target.text) ? 'green' : undefined"
          />
        </li>
      </ul>
    </div>

    <ol ref="list" class="flex max-h-[28rem] flex-col gap-3 overflow-y-auto rounded-card border border-line bg-surface p-3 sm:max-h-[calc(100dvh-24rem)] sm:p-4" aria-live="polite" data-testid="chat-messages">
      <li v-for="(message, index) in tutor.conversation.messages" :key="index" class="flex flex-col gap-2" :data-role="message.role">
        <div v-if="message.role === 'assistant'" class="flex max-w-[90%] flex-col items-start gap-1 self-start rounded-lg bg-raised p-3 text-sm">
          <p lang="en" class="whitespace-pre-line">{{ message.content }}</p>
          <button v-if="tutor.canSpeak" type="button" class="lf-btn min-h-8" @click="speak(message.content)">
            <Volume2 :size="14" aria-hidden="true" />
            {{ t('tutor.listen') }}
          </button>
          <div v-if="message.newExpression" class="mt-1 flex flex-col items-start gap-1 border-t border-line pt-2" data-testid="new-expression">
            <p class="text-xs text-muted">{{ t('tutor.newExpression') }}</p>
            <p><span class="font-medium" lang="en">{{ message.newExpression.text }}</span> <span class="text-muted" lang="en">— {{ message.newExpression.meaning }}</span></p>
            <button type="button" class="lf-btn min-h-8" :disabled="message.saved" @click="tutor.saveExpression(index)">
              <BookmarkPlus :size="14" aria-hidden="true" />
              {{ message.saved ? t('tutor.saved') : t('tutor.saveExpression', { phrase: message.newExpression.text }) }}
            </button>
          </div>
        </div>

        <template v-else>
          <p lang="en" class="max-w-[90%] self-end rounded-lg border border-line p-3 text-sm whitespace-pre-line">{{ message.content }}</p>
          <div v-if="message.correction" class="flex max-w-[90%] flex-col items-start gap-1.5 self-end text-sm" data-testid="correction">
            <TagBadge v-if="message.correction.isNatural" :label="t('tutor.natural')" :icon="CheckCircle2" color="green" />
            <template v-else>
              <p class="text-xs text-muted">{{ t('tutor.betterAs') }}</p>
              <WordDiff :before="message.content" :after="message.correction.natural" />
              <p>{{ message.correction.reason }}</p>
              <button
                type="button"
                class="lf-btn min-h-8"
                :disabled="message.saved"
                @click="tutor.saveMistake(index)"
              >
                <BookmarkPlus :size="14" aria-hidden="true" />
                {{ message.saved ? t('tutor.saved') : t('tutor.saveMistake', { phrase: message.correction.keyPhrase || message.correction.natural }) }}
              </button>
            </template>
            <p v-if="message.correction.toneNote" class="text-xs text-muted">{{ message.correction.toneNote }}</p>
          </div>
        </template>
      </li>
      <li v-if="tutor.sending" class="text-sm text-muted" data-testid="chat-thinking">
        {{ tutor.conversation.messages.length ? t('tutor.thinking') : t('tutor.starting') }}
      </li>
    </ol>

    <form class="flex flex-col gap-2" @submit.prevent="send">
      <label class="block">
        <span class="lf-label">{{ t('tutor.yourLine') }}</span>
        <textarea ref="box" v-model="draft" rows="2" class="lf-input" lang="en" spellcheck="false" @keydown="onKey" />
      </label>
      <div class="flex flex-wrap items-center gap-2">
        <button type="submit" class="lf-btn lf-btn-primary" :disabled="!draft.trim() || tutor.sending">{{ t('tutor.send') }}</button>
        <button v-if="mic.supported" type="button" class="lf-btn" :aria-pressed="mic.listening.value" @click="mic.listening.value ? mic.stop() : mic.start()">
          <component :is="mic.listening.value ? MicOff : Mic" :size="15" aria-hidden="true" />
          {{ mic.listening.value ? t('tutor.micStop') : t('tutor.mic') }}
        </button>
        <label v-if="tutor.canSpeak" class="inline-flex min-h-8 items-center gap-2 text-sm">
          <input v-model="tutor.voiceReplies" type="checkbox" />
          {{ t('tutor.voiceReplies') }}
        </label>
      </div>
      <p v-if="voice.preparing" class="text-xs text-muted" role="status" data-testid="voice-preparing">{{ t('settings.voice.preparing') }}</p>
      <p v-else-if="tutor.canSpeak && !voice.usingNatural" class="text-xs text-muted" data-testid="voice-nudge">
        <RouterLink class="underline" :to="{ name: 'settings' }">{{ t('tutor.voiceNudge') }}</RouterLink>
      </p>
      <p class="text-xs text-muted">{{ t('tutor.sendHint') }}</p>
      <p v-if="mic.supported" class="text-xs text-muted">{{ t('tutor.micPrivacy') }}</p>
    </form>
  </section>
</template>
