import { mockOrders, mockProducts, mockTransactions } from '~/utils/mock-data'
import type { Order, Product, Transaction } from '~/types/domain'

const delay = () => new Promise((resolve) => setTimeout(resolve, 120))

export const dataService = {
  async getOrders(): Promise<Order[]> {
    await delay()
    return structuredClone(mockOrders)
  },
  async getProducts(): Promise<Product[]> {
    await delay()
    return structuredClone(mockProducts)
  },
  async getTransactions(): Promise<Transaction[]> {
    await delay()
    return structuredClone(mockTransactions)
  },
}
