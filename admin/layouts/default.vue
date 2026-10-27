<script setup lang="ts">
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { useLanguage } from '~/utils/i18n'

const auth = useAuthStore()
const cookie = useCookie<'admin' | 'partner' | 'viewer' | null>('tech-wave-role', { sameSite: 'lax', secure: !import.meta.dev })
const { locale, t } = useLanguage()
const toast = useToast()

async function signOut() {
  await auth.signOut()
  cookie.value = null
  toast.add({ severity: 'info', summary: 'Signed out', life: 2500 })
  await navigateTo('/login')
}
</script>

<template>
  <div class="shell">
    <Toast position="top-right" />
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <header class="topbar">
      <NuxtLink class="brand" to="/" aria-label="TECH WAVE CM dashboard">TECH WAVE CM</NuxtLink>
      <div style="display:flex;align-items:center;gap:1rem">
        <span class="muted">{{ auth.user?.name }} · {{ auth.user?.role }}</span>
        <label class="muted" for="language">{{ t('language') }}</label>
        <select id="language" v-model="locale" class="form-control" style="width:auto;padding:.4rem">
          <option value="en">English</option>
          <option value="fr">Français</option>
        </select>
        <Button :label="t('signOut')" severity="secondary" outlined size="small" @click="signOut" />
      </div>
    </header>
    <div class="shell-body">
      <nav class="sidebar" aria-label="Main navigation">
        <NuxtLink class="nav-link" to="/"><i class="pi pi-chart-bar" aria-hidden="true" />{{ t('dashboard') }}</NuxtLink>
        <NuxtLink class="nav-link" to="/orders"><i class="pi pi-shopping-bag" aria-hidden="true" />{{ t('orders') }}</NuxtLink>
        <NuxtLink class="nav-link" to="/products"><i class="pi pi-box" aria-hidden="true" />{{ t('products') }}</NuxtLink>
        <NuxtLink class="nav-link" to="/transactions"><i class="pi pi-wallet" aria-hidden="true" />{{ t('transactions') }}</NuxtLink>
      </nav>
      <main id="main-content" class="page-wrap">
        <slot />
      </main>
    </div>
  </div>
</template>
