import { z } from 'zod'

/**
 * The acting party behind a service call.
 *
 * Storefront (Catalog/Cart/Order/Account) services accept the actor
 * implicitly (anonymous browsing is the default); the Admin services
 * require `kind: 'admin'` and enforce it engine-side, returning
 * UNAUTHORIZED otherwise. The app derives the ActorRef from its session
 * (JWT role/userId) and passes it as the first argument of every admin
 * method.
 */
export const ActorRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('anonymous') }),
  z.object({ kind: z.literal('customer'), userId: z.string().min(1) }),
  z.object({ kind: z.literal('admin'), userId: z.string().min(1) }),
])
export type ActorRef = z.infer<typeof ActorRefSchema>
