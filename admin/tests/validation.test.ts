import { describe, expect, it } from 'vitest'
import { productSchema, roleSchema } from '../utils/validation'

describe('form schemas', () => {
  it('accepts supported demo roles and rejects unknown roles', () => {
    expect(roleSchema.safeParse({ role: 'partner' }).success).toBe(true)
    expect(roleSchema.safeParse({ role: 'owner' }).success).toBe(false)
  })

  it('validates and normalizes a product before submission', () => {
    expect(productSchema.parse({ name: '  Wave Speaker ', sku: 'TW-01', price: 125, stock: 3 })).toEqual({
      name: 'Wave Speaker',
      sku: 'TW-01',
      price: 125,
      stock: 3,
    })
    expect(productSchema.safeParse({ name: '', sku: 'x', price: -1, stock: 1.2 }).success).toBe(false)
  })
})
