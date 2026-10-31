import { z } from 'zod'

export const PromotionalCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  displayOrder: z.number().int(),
  isActive: z.boolean(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type PromotionalCategoryDTO = z.infer<typeof PromotionalCategorySchema>
