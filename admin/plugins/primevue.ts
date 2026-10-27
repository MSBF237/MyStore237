import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import ToastService from 'primevue/toastservice'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(PrimeVue, {
    theme: { preset: Aura, options: { darkModeSelector: '.dark-mode' } },
    ripple: true,
  })
  nuxtApp.vueApp.use(ToastService)
})
