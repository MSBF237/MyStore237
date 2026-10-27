export type NotificationChannel = 'email' | 'push'

export const notificationService = {
  async notify(channel: NotificationChannel, message: string): Promise<void> {
    console.info(`[mock ${channel} notification] ${message}`)
  },
}
