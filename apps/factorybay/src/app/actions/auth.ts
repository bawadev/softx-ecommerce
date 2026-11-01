'use server'

import {
  generateToken,
  setAuthCookie,
  removeAuthCookie,
} from '@/lib/auth'
import {
  getGuestCart,
  clearGuestCart,
} from '@/lib/guest-cart'
import { getAccountService, getCartService } from '@/lib/engine'
import type { AuthResponse, CreateUserInput, LoginInput } from '@softx/engine'

/**
 * Sign up a new user.
 *
 * Phase 4 Task 6: account creation (validation, duplicate-check, hashing)
 * lives in the engine's AccountService — password hashes never cross this
 * boundary. This action keeps ONLY the app-owned transport: token minting +
 * cookie. Error-envelope strings are unchanged: VALIDATION messages come from
 * the engine (parity port of the old app-side validators), CONFLICT renders
 * the duplicate-email string, infra failures render the generic catch string.
 */
export async function signupAction(
  input: CreateUserInput
): Promise<AuthResponse> {
  try {
    const r = await getAccountService().signUp({
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      role: input.role,
    })

    if (!r.ok) {
      if (r.error.code === 'CONFLICT') {
        return {
          success: false,
          message: 'An account with this email already exists',
        }
      }
      if (r.error.code === 'UNAVAILABLE') {
        return {
          success: false,
          message: 'An error occurred during signup. Please try again.',
        }
      }
      // VALIDATION — the engine owns the parity strings
      return {
        success: false,
        message: r.error.message,
      }
    }

    const user = r.data

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
 * Log in an existing user.
 *
 * Phase 4 Task 6: credential verification (email lookup + password compare)
 * lives in the engine's AccountService; the returned AccountDTO carries no
 * hash. This action keeps the app-owned transport (token + cookie) and the
 * guest-cart migration exactly as before.
 */
export async function loginAction(input: LoginInput): Promise<AuthResponse> {
  try {
    const r = await getAccountService().authenticate({
      email: input.email,
      password: input.password,
    })

    if (!r.ok) {
      if (r.error.code === 'UNAVAILABLE') {
        return {
          success: false,
          message: 'An error occurred during login. Please try again.',
        }
      }
      // UNAUTHORIZED and VALIDATION — the engine owns the parity strings
      // ('Invalid email or password' / 'Please provide a valid email address')
      return {
        success: false,
        message: r.error.message,
      }
    }

    const user = r.data

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
        const result = await getCartService().mergeCarts({ kind: 'guest', items: guestCart }, user.id)
        if (result.ok) await clearGuestCart().catch(() => {})
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
