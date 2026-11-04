<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { safeHttpUrl } from '@/domain/text'
import { useCaptureStore } from './captureStore'

/**
 * The target of the bookmarklet, and later of a browser extension:
 * /capture?text=…&url=…&title=…
 *
 * It only pre-fills Quick Add. Any website can link here, so saving always waits
 * for the user to confirm, and a page can't add entries on its own.
 */
const route = useRoute()
const capture = useCaptureStore()

const param = (name: string) => {
  const value = route.query[name]
  return typeof value === 'string' ? value.trim() : ''
}

onMounted(() => {
  const url = safeHttpUrl(param('url'))
  const title = param('title')
  capture.openQuickAdd({
    text: param('text') || url || '',
    source: { ...(title ? { title } : {}), ...(url ? { url } : {}) },
    trigger: 'Reading',
  })
})
</script>

<template>
  <section aria-hidden="true" />
</template>
