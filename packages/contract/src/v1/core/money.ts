import { z } from 'zod'

export const MoneySchema = z.object({
  amountMinor: z.number().int(),
  currency: z.string().length(3),
})
export type Money = z.infer<typeof MoneySchema>

export function money(amountMinor: number, currency: string): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`money(): amountMinor must be an integer, got ${amountMinor}`)
  }
  return { amountMinor, currency }
}

export function fromMajorAmount(value: number, currency: string): Money {
  return money(Math.round(value * 100), currency)
}
