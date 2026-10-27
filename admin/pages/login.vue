<script setup lang="ts">
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import type { UserRole } from '~/types/domain'
import { useToast } from 'primevue/usetoast'
import { roleSchema } from '~/utils/validation'

definePageMeta({ layout: false })
const role = ref<UserRole>('admin')
const errors = reactive<{ role?: string }>({})
const auth = useAuthStore()
const cookie = useCookie<UserRole | null>('tech-wave-role', { sameSite: 'lax', secure: !import.meta.dev })
const toast = useToast()
async function submit() {
  const result = roleSchema.safeParse({ role: role.value })
  errors.role = result.success ? undefined : result.error.issues[0]?.message
  if (!result.success) return
  try {
    await auth.signIn(result.data.role)
    cookie.value = result.data.role
    await navigateTo('/')
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Sign in failed', detail: error instanceof Error ? error.message : 'Please try again.', life: 3000 })
  }
}
</script>

<template>
  <main class="page-wrap" style="max-width:480px;padding-top:10vh">
    <Toast />
    <section class="card" aria-labelledby="login-title">
      <p class="brand">TECH WAVE CM</p>
      <h1 id="login-title">Admin portal</h1>
      <p class="muted">Demo sign-in. Authentication is mocked and must be replaced before production.</p>
      <form @submit.prevent="submit">
        <RoleSelector v-model="role" :error="errors.role" />
        <Button type="submit" label="Continue" :loading="auth.loading" />
      </form>
    </section>
  </main>
</template>
