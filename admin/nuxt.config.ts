export default defineNuxtConfig({
  ssr: true,
  app: {
    head: {
      title: 'TECH WAVE CM Admin',
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'description', content: 'Business administration portal for TECH WAVE CM.' }],
    },
  },
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@nuxt/eslint'],
  css: ['primeicons/primeicons.css', '~/assets/css/tokens.css', '~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      appName: 'TECH WAVE CM',
    },
  },
  nitro: {
    preset: 'node-server',
  },
  typescript: { strict: true },
})
