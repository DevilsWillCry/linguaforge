import { hasBrowserVoice } from './browserVoice'
import { useVoiceStore } from './voiceStore'

/** Whether the app can read English aloud. Listening reviews are skipped if it can't. */
export async function canSpeakEnglish(): Promise<boolean> {
  const voice = useVoiceStore()
  voice.prepare()
  return (await hasBrowserVoice()) || voice.usingNatural
}

/** Reads a line with the voice chosen in Settings. */
export function speak(text: string, rate = 1) {
  void useVoiceStore().say(text, rate)
}

export function stopSpeaking() {
  useVoiceStore().stop()
}
