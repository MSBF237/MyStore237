import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/auth'

describe('auth store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('signs in with a mock role and clears the session on sign out', async () => {
    const store = useAuthStore()
    await store.signIn('partner')
    expect(store.user).toEqual({ id: 'usr-partner', name: 'Sam Partner', role: 'partner' })
    expect(store.loading).toBe(false)
    await store.signOut()
    expect(store.user).toBeNull()
  })

  it('restores an existing mock role from the session adapter', async () => {
    const store = useAuthStore()
    await store.restore('admin')
    expect(store.user?.role).toBe('admin')
  })
})
