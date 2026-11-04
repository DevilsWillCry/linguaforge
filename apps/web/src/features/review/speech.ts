/** Waits briefly for the browser's voice list, which loads after the page does. */
async function englishVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in window)) return []
  const read = () => speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  if (read().length) return read()
  await new Promise((resolve) => {
    speechSynthesis.addEventListener('voiceschanged', resolve, { once: true })
    setTimeout(resolve, 800)
  })
  return read()
}

let voice: SpeechSynthesisVoice | undefined

/** Some systems, Linux above all, have no voices. Listening reviews are skipped there. */
export async function canSpeakEnglish(): Promise<boolean> {
  const voices = await englishVoices()
  voice = voices.find((v) => v.lang === 'en-US') ?? voices[0]
  return Boolean(voice)
}

export function speak(text: string, rate = 1) {
  if (!voice) return
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = rate
  speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}
