import { z } from 'zod'

export const roleSchema = z.object({ role: z.enum(['admin', 'partner', 'viewer']) })

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters.').max(80, 'Name must be 80 characters or fewer.'),
  sku: z.string().trim().min(3, 'Enter a valid SKU.').max(32, 'SKU must be 32 characters or fewer.'),
  price: z.number().positive('Price must be greater than zero.'),
  stock: z.number().int().min(0, 'Stock cannot be negative.'),
})
