import { notFound } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import MakeAdminForm from './MakeAdminForm'

/**
 * LKD-16: this dev utility used to render its form to ANY visitor — only the
 * makeUserAdmin action behind it rejected non-admins. The page itself is now
 * admin-gated: anonymous users and customers get a 404 (notFound hides the
 * utility's existence rather than advertising it).
 */
export default async function MakeAdminPage() {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    notFound()
  }

  return <MakeAdminForm />
}
