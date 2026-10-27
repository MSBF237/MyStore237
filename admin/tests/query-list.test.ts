import { describe, expect, it } from 'vitest'
import { infiniteWindow, queryList } from '../services/queries'

const orders = [
  { id: 'ORD-2', customer: 'Ama', status: 'Paid' },
  { id: 'ORD-1', customer: 'Kojo', status: 'Pending' },
]

describe('data query helpers', () => {
  it('filters, sorts, and paginates list data', () => {
    expect(queryList(orders, { page: 1, pageSize: 1, search: 'ama', sortBy: 'id' })).toEqual({
      items: [orders[0]],
      total: 1,
    })
  })

  it('provides cursor windows for sections that choose infinite scrolling', () => {
    expect(infiniteWindow(orders, 0, 1)).toEqual({ items: [orders[0]], nextCursor: 1 })
    expect(infiniteWindow(orders, 1, 1)).toEqual({ items: [orders[1]], nextCursor: null })
  })
})
