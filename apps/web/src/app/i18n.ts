import { useLocalStorage } from '@vueuse/core'
import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import { es } from './locales/es'

export type Locale = 'es' | 'en'

export const locale = useLocalStorage<Locale>('lf-locale', 'es')

export const i18n = createI18n({
  legacy: false,
  locale: locale.value,
  fallbackLocale: 'es',
  // Spanish is the default, so English only loads for people who choose it.
  messages: { es } as Record<Locale, typeof es>,
})

/** Applies a language, loading its messages first so no raw keys ever show. */
export async function applyLocale(next: Locale) {
  if (next === 'en' && !i18n.global.availableLocales.includes('en')) {
    const { en } = await import('./locales/en')
    i18n.global.setLocaleMessage('en', en as typeof es)
  }
  // The choice may have changed again while the messages were loading.
  if (next !== locale.value) return
  i18n.global.locale.value = next
  document.documentElement.lang = next
}

watch(locale, (next) => void applyLocale(next))
