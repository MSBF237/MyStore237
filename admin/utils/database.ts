export interface DatabaseConfig {
  host: string
  port: number
  name: string
}

export const databaseConfig: DatabaseConfig = {
  host: '',
  port: 5432,
  name: '',
}

export const databaseConnection = {
  configured: false,
  connect: async (): Promise<never> => {
    throw new Error('Database is not configured; connect a backend before enabling persistence.')
  },
}
