import type { UserRole } from '~/types/domain'

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return
  const auth = useAuthStore()
  const roleCookie = useCookie<UserRole | null>('tech-wave-role', { sameSite: 'lax', secure: !import.meta.dev })
  if (!auth.user) await auth.restore(roleCookie.value)
  if (!auth.user) return navigateTo('/login')
  const allowedRoles = to.meta.roles as UserRole[] | undefined
  if (allowedRoles && !allowedRoles.includes(auth.user.role)) return navigateTo('/unauthorized')
})
