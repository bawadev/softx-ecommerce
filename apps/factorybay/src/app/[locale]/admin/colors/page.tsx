import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import ColorsClient from './ColorsClient'

export default async function AdminColorsPage() {
  const user = await getCurrentUser()

  if (!user || user.role?.toUpperCase() !== 'ADMIN') {
    redirect('/login')
  }

  return <ColorsClient />
}
