export type UserRole = 'admin' | 'partner' | 'viewer'

export interface AdminUser {
  id: string
  name: string
  role: UserRole
}

export interface Order {
  id: string
  customer: string
  date: string
  total: number
  status: 'Paid' | 'Pending' | 'Refunded'
}

export interface Product {
  id: string
  name: string
  sku: string
  stock: number
  price: number
}

export interface Transaction {
  id: string
  orderId: string
  date: string
  amount: number
  method: string
  status: 'Completed' | 'Pending' | 'Failed'
}
