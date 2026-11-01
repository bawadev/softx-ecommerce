'use server'

import { isAdmin } from '@/lib/auth'
import { internal } from '@softx/engine'
import type { ActionResponse } from '@softx/engine'

// Role assignment stays app-side this phase (account-domain policy); the
// user reads/writes go through the engine's internal escape hatch.
const { updateUser, findUserByEmail } = internal.repositories.userRepository

/**
 * Make a user an admin (dev helper)
 */
export async function makeUserAdmin(
  email: string
): Promise<ActionResponse<{ email: string }>> {
  try {
    const user = await findUserByEmail(email)
    if (!user) {
      return {
        success: false,
        message: 'User not found',
      }
    }

    await updateUser(user.id, { role: 'ADMIN' })

    return {
      success: true,
      message: 'User updated to admin',
      data: { email: user.email },
    }
  } catch (error) {
    console.error('Make admin error:', error)
    return {
      success: false,
      message: 'Failed to update user role',
    }
  }
}

/**
 * Check if current user is admin
 */
export async function checkAdminAccess(): Promise<ActionResponse<{ isAdmin: boolean }>> {
  const adminAccess = await isAdmin()

  return {
    success: true,
    data: { isAdmin: adminAccess },
  }
}
