<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
</script>

<template>
  <section>
    <h1 class="text-2xl font-semibold tracking-tight">{{ t(`nav.${String(route.meta.label)}`) }}</h1>
    <div class="mt-6 rounded-card border border-dashed border-line p-8">
      <p class="font-medium">{{ t('placeholder.title') }}</p>
      <p class="mt-1 text-sm text-muted">
        {{ t('placeholder.body', { phase: route.meta.phase as number }) }}
      </p>
    </div>
  </section>
</template>
