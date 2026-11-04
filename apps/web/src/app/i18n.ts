import { useLocalStorage } from '@vueuse/core'
import { watchEffect } from 'vue'
import { createI18n } from 'vue-i18n'
import { en } from './locales/en'
import { es } from './locales/es'

export type Locale = 'es' | 'en'

export const locale = useLocalStorage<Locale>('lf-locale', 'es')

export const i18n = createI18n({
  legacy: false,
  locale: locale.value,
  fallbackLocale: 'es',
  messages: { es, en },
})

watchEffect(() => {
  i18n.global.locale.value = locale.value
  document.documentElement.lang = locale.value
})
