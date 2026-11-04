import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { EntrySource } from '@/domain/types'

export interface CaptureDetails {
  text: string
  source?: EntrySource
  trigger?: string
}

/** Which capture dialog is open, and what it's pre-filled with. */
export const useCaptureStore = defineStore('capture', () => {
  const paletteOpen = ref(false)
  const quickAddOpen = ref(false)
  const prefill = shallowRef<CaptureDetails>({ text: '' })

  function openQuickAdd(details: CaptureDetails = { text: '' }) {
    paletteOpen.value = false
    prefill.value = details
    quickAddOpen.value = true
  }

  return { paletteOpen, quickAddOpen, prefill, openQuickAdd }
})
