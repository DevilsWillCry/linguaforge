/** Kokoro's best-graded voices for each accent. Its other English voices are graded D or worse. */
export const VOICES = [
  { id: 'af_heart', name: 'Heart', accent: 'us' },
  { id: 'af_bella', name: 'Bella', accent: 'us' },
  { id: 'af_nicole', name: 'Nicole', accent: 'us' },
  { id: 'am_michael', name: 'Michael', accent: 'us' },
  { id: 'am_fenrir', name: 'Fenrir', accent: 'us' },
  { id: 'bf_emma', name: 'Emma', accent: 'uk' },
  { id: 'bf_isabella', name: 'Isabella', accent: 'uk' },
  { id: 'bm_george', name: 'George', accent: 'uk' },
  { id: 'bm_fable', name: 'Fable', accent: 'uk' },
] as const

export type VoiceId = (typeof VOICES)[number]['id']
export const DEFAULT_VOICE: VoiceId = 'af_heart'

/** Where the download is kept: one cache for the model, and one for the voices. */
export const MODEL_CACHES = ['transformers-cache', 'kokoro-voices']

/** The address the library reads a voice from, which is also its key in the voices cache. */
export const voiceFileUrl = (id: VoiceId) =>
  `https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/${id}.bin`
