import { defineStore } from 'pinia'
import type { AdminUser, UserRole } from '~/types/domain'
import { authService } from '~/services/auth'

export const useAuthStore = defineStore('auth', {
  state: () => ({ user: null as AdminUser | null, loading: false }),
  actions: {
    async signIn(role: UserRole) {
      this.loading = true
      try {
        this.user = await authService.signIn(role)
      } finally {
        this.loading = false
      }
    },
    async restore(role: UserRole | null) {
      this.user = await authService.getUser(role)
    },
    async signOut() {
      await authService.signOut()
      this.user = null
    },
  },
})
