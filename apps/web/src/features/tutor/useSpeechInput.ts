import { onBeforeUnmount, ref } from 'vue'

interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type RecognitionClass = new () => Recognition

function recognitionClass(): RecognitionClass | undefined {
  const candidates = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass }
  return candidates.SpeechRecognition ?? candidates.webkitSpeechRecognition
}

/** Speech to text with the browser's own service. Some browsers don't have one. */
export function useSpeechInput(onText: (text: string) => void, onFailure: () => void) {
  const Available = recognitionClass()
  const listening = ref(false)
  let recognition: Recognition | null = null

  function start() {
    if (!Available || listening.value) return
    recognition = new Available()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => {
      const heard = Array.from(event.results).map((result) => result[0]?.transcript ?? '').join(' ').trim()
      if (heard) onText(heard)
    }
    recognition.onerror = onFailure
    recognition.onend = () => {
      listening.value = false
    }
    try {
      recognition.start()
      listening.value = true
    } catch {
      onFailure()
    }
  }

  const stop = () => recognition?.stop()
  onBeforeUnmount(stop)

  return { supported: Boolean(Available), listening, start, stop }
}
