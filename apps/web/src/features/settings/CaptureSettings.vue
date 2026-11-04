<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { notify } from '@/shared/ui/useToasts'

const { t } = useI18n()

const bookmarklet = computed(() => {
  const base = `${location.origin}/capture`
  const script = `(()=>{const e=encodeURIComponent;window.open('${base}?text='+e(String(getSelection()).trim())+'&url='+e(location.href)+'&title='+e(document.title),'linguaforge-capture','width=560,height=480')})()`
  return `javascript:${script}`
})

async function copy() {
  try {
    await navigator.clipboard.writeText(bookmarklet.value)
    notify(t('settings.capture.copied'))
  } catch (error) {
    console.error(error)
    notify(t('errors.save'), { tone: 'error' })
  }
}
</script>

<template>
  <section class="rounded-card border border-line bg-surface p-5">
    <h2 class="font-semibold">{{ t('settings.capture.title') }}</h2>
    <p class="mt-1 text-sm text-muted">{{ t('settings.capture.description') }}</p>
    <div class="mt-4 flex flex-wrap gap-2">
      <!-- Meant for dragging to the bookmarks bar. Clicking it here would do nothing useful. -->
      <a :href="bookmarklet" class="lf-btn lf-btn-primary" data-testid="bookmarklet" @click.prevent>
        {{ t('settings.capture.button') }}
      </a>
      <button type="button" class="lf-btn" @click="copy">{{ t('settings.capture.copy') }}</button>
    </div>
  </section>
</template>
