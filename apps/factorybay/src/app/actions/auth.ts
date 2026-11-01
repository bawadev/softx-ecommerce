'use server'

import {
  hashPassword,
  verifyPassword,
  generateToken,
  setAuthCookie,
  removeAuthCookie,
  isValidEmail,
  validatePassword,
} from '@/lib/auth'
import {
  createUser,
  findUserByEmail,
  emailExists,
} from '@softx/engine'
import {
  getGuestCart,
  clearGuestCart,
} from '@/lib/guest-cart'
import { getCartService } from '@/lib/engine'
import type { AuthResponse, CreateUserInput, LoginInput } from '@softx/engine'

/**
 * Sign up a new user
 */
export async function signupAction(
  input: CreateUserInput
): Promise<AuthResponse> {
  try {
    // Validate email
    if (!isValidEmail(input.email)) {
      return {
        success: false,
        message: 'Please provide a valid email address',
      }
    }

    // Validate password
    const passwordError = validatePassword(input.password)
    if (passwordError) {
      return {
        success: false,
        message: passwordError,
      }
    }

    // Check if email already exists
    const exists = await emailExists(input.email)
    if (exists) {
      return {
        success: false,
        message: 'An account with this email already exists',
      }
    }

    // Hash password
    const passwordHash = await hashPassword(input.password)

    // Create user
    const user = await createUser({
      ...input,
      passwordHash,
      role: input.role || 'CUSTOMER',
    })

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    // Set auth cookie
    await setAuthCookie(token)

    return {
      success: true,
      message: 'Account created successfully!',
      user,
    }
  } catch (error) {
    console.error('Signup error:', error)
    return {
      success: false,
      message: 'An error occurred during signup. Please try again.',
    }
  }
}

/**
 * Log in an existing user
 */
export async function loginAction(input: LoginInput): Promise<AuthResponse> {
  try {
    // Validate email
    if (!isValidEmail(input.email)) {
      return {
        success: false,
        message: 'Please provide a valid email address',
      }
    }

    // Find user by email
    const userWithPassword = await findUserByEmail(input.email)
    if (!userWithPassword) {
      return {
        success: false,
        message: 'Invalid email or password',
      }
    }

    // Verify password
    const isValid = await verifyPassword(
      input.password,
      userWithPassword.passwordHash
    )
    if (!isValid) {
      return {
        success: false,
        message: 'Invalid email or password',
      }
    }

    // Remove passwordHash from user object
    const { passwordHash, ...user } = userWithPassword

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    // Set auth cookie
    await setAuthCookie(token)

    // Migrate guest cart to user cart (heals vanished variants; one bad line
    // no longer aborts the rest — the service skips what it cannot validate)
    try {
      const guestCart = (await getGuestCart()).filter((l) => l.quantity >= 1)
      if (guestCart.length > 0) {
        const r = await getCartService().mergeCarts({ kind: 'guest', items: guestCart }, user.id)
        if (r.ok) await clearGuestCart().catch(() => {})
      }
    } catch (error) {
      console.error('Cart migration error:', error) // don't fail login if migration fails
    }

    return {
      success: true,
      message: 'Login successful!',
      user,
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      success: false,
      message: 'An error occurred during login. Please try again.',
    }
  }
}

/**
 * Log out the current user
 */
export async function logoutAction(): Promise<void> {
  await removeAuthCookie()
}
