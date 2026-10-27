import type { Order, Product, Transaction } from '~/types/domain'

export const mockOrders: Order[] = [
  { id: 'ORD-2408', customer: 'Ama Mensah', date: '2026-10-23', total: 1250, status: 'Paid' },
  { id: 'ORD-2407', customer: 'Kojo Boateng', date: '2026-10-22', total: 420, status: 'Pending' },
  { id: 'ORD-2406', customer: 'Nana Owusu', date: '2026-10-21', total: 860, status: 'Paid' },
  { id: 'ORD-2405', customer: 'Esi Addo', date: '2026-10-20', total: 240, status: 'Refunded' },
]

export const mockProducts: Product[] = [
  { id: 'PRD-101', name: 'Wave X Headphones', sku: 'TW-HDP-01', stock: 42, price: 240 },
  { id: 'PRD-102', name: 'Pulse Smart Watch', sku: 'TW-WAT-02', stock: 18, price: 390 },
  { id: 'PRD-103', name: 'Echo Bluetooth Speaker', sku: 'TW-SPK-03', stock: 67, price: 175 },
]

export const mockTransactions: Transaction[] = [
  { id: 'TX-9008', orderId: 'ORD-2408', date: '2026-10-23', amount: 1250, method: 'Mobile money', status: 'Completed' },
  { id: 'TX-9007', orderId: 'ORD-2407', date: '2026-10-22', amount: 420, method: 'Card', status: 'Pending' },
  { id: 'TX-9006', orderId: 'ORD-2406', date: '2026-10-21', amount: 860, method: 'Mobile money', status: 'Completed' },
]
