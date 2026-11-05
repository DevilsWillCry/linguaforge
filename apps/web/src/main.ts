import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { applyLocale, i18n, locale } from './app/i18n'
import { router } from './app/router'
import './app/styles.css'

// Waits for the language, so someone using English never sees a flash of Spanish.
void applyLocale(locale.value)
  .catch((error) => console.error(error))
  .finally(() => createApp(App).use(createPinia()).use(router).use(i18n).mount('#app'))
