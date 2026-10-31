import { z } from 'zod'

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  hierarchy: z.string(),
  parentId: z.string().nullable(),
  level: z.number().int(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  productCount: z.number().int().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type CategoryDTO = z.infer<typeof CategorySchema>

export type CategoryTreeDTO = CategoryDTO & { children: CategoryTreeDTO[] }
