export interface AuditEntry {
  userId: string
  action: string
  target: string
  occurredAt: string
}

const entries: AuditEntry[] = []

export const auditService = {
  async record(entry: Omit<AuditEntry, 'occurredAt'>): Promise<void> {
    entries.push({ ...entry, occurredAt: new Date().toISOString() })
  },
  async list(): Promise<AuditEntry[]> {
    return entries.map((entry) => ({ ...entry }))
  },
}
