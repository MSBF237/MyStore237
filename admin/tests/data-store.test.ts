import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDataStore } from '../stores/data'
import { dataService } from '../services/data'

vi.mock('../services/data', () => ({
  dataService: {
    getOrders: vi.fn().mockResolvedValue([{ id: 'ORD-1' }]),
    getProducts: vi.fn().mockResolvedValue([{ id: 'PRD-1' }]),
    getTransactions: vi.fn().mockResolvedValue([{ id: 'TX-1' }]),
  },
}))

describe('data store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('loads mock resources through the replaceable service boundary', async () => {
    const store = useDataStore()
    await store.loadAll()
    expect(dataService.getOrders).toHaveBeenCalledOnce()
    expect(store.orders).toEqual([{ id: 'ORD-1' }])
    expect(store.products).toEqual([{ id: 'PRD-1' }])
    expect(store.transactions).toEqual([{ id: 'TX-1' }])
    expect(store.loading).toBe(false)
  })

  it('preserves the error and rejects when a service fails', async () => {
    vi.mocked(dataService.getOrders).mockRejectedValueOnce(new Error('service unavailable'))
    const store = useDataStore()
    await expect(store.loadAll()).rejects.toThrow('service unavailable')
    expect(store.error).toBe('service unavailable')
    expect(store.loading).toBe(false)
  })
})
