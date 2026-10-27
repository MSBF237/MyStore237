import { defineStore } from 'pinia'
import type { Order, Product, Transaction } from '~/types/domain'
import { dataService } from '~/services/data'

export const useDataStore = defineStore('data', {
  state: () => ({
    orders: [] as Order[],
    products: [] as Product[],
    transactions: [] as Transaction[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async loadAll() {
      this.loading = true
      this.error = null
      try {
        const [orders, products, transactions] = await Promise.all([
          dataService.getOrders(),
          dataService.getProducts(),
          dataService.getTransactions(),
        ])
        this.orders = orders
        this.products = products
        this.transactions = transactions
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unable to load dashboard data.'
        throw error
      } finally {
        this.loading = false
      }
    },
  },
})
