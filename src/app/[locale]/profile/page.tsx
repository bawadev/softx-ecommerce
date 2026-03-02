import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserPreferencesAction, getUserMeasurementsAction } from '@/app/actions/user-profile'
import { findUserById } from '@/lib/repositories/user.repository'
import ProfileClient from './ProfileClient'

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  const currentUser = await getCurrentUser()

  if (!currentUser) {
    redirect(`/${locale}/login?returnTo=/${locale}/profile`)
  }

  // Fetch full user data
  const user = await findUserById(currentUser.userId)

  if (!user) {
    redirect(`/${locale}/login?returnTo=/${locale}/profile`)
  }

  const [preferencesResult, measurementsResult] = await Promise.all([
    getUserPreferencesAction(),
    getUserMeasurementsAction(),
  ])

  return (
    <ProfileClient
      user={user}
      initialPreferences={preferencesResult.data?.preferences || null}
      initialMeasurements={measurementsResult.data?.measurements || null}
    />
  )
}
