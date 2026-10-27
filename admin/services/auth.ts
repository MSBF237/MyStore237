import type { AdminUser, UserRole } from '~/types/domain'

const users: Record<UserRole, AdminUser> = {
  admin: { id: 'usr-admin', name: 'Alex Admin', role: 'admin' },
  partner: { id: 'usr-partner', name: 'Sam Partner', role: 'partner' },
  viewer: { id: 'usr-viewer', name: 'Taylor Viewer', role: 'viewer' },
}

export const authService = {
  async signIn(role: UserRole): Promise<AdminUser> {
    const user = users[role]
    if (!user) throw new Error('Unsupported demo role.')
    return { ...user }
  },
  async getUser(role: UserRole | null): Promise<AdminUser | null> {
    return role && Object.hasOwn(users, role) ? { ...users[role] } : null
  },
  async signOut(): Promise<void> {},
}
