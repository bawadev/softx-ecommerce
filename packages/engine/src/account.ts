import bcrypt from 'bcryptjs'
import { v1 } from '@softx/contract'
import type { EngineConfig, TenantRef } from './engine'
import type { User } from './types'
import * as userRepo from './repositories/user.repository'

const { ok, err } = v1

/**
 * Account service v1 (Phase 4 Task 3): signup with server-side hashing and
 * duplicate-check, credential verification, profile reads.
 *
 * Password hashes are ENGINE-OWNED and never leave this module: `authenticate`
 * verifies via bcrypt.compare inside the engine and returns only the
 * AccountDTO projection (see `toAccountDTO`); `AccountDTO` has no
 * password/hash field by contract.
 *
 * Validation parity: `isValidEmail` + `validatePassword` below are PORTED
 * VERBATIM from `apps/factorybay/src/lib/auth.ts` (Phase 4 Task 3 write-time
 * content) — same regex, same messages, same rule ORDER (length → uppercase →
 * number), so `VALIDATION` messages match today's app strings exactly. The
 * invalid-email message comes from the app's signupAction/loginAction
 * ('Please provide a valid email address'; the app's isValidEmail helper is
 * regex-only and carries no message). Order of signUp checks mirrors
 * signupAction: email format → password strength → duplicate → hash → create.
 */

/** Parity with apps/factorybay/src/lib/auth.ts SALT_ROUNDS (hashPassword). */
const SALT_ROUNDS = 12

const INVALID_EMAIL_MESSAGE = 'Please provide a valid email address'

/**
 * Validate email format.
 * Parity port of apps/factorybay/src/lib/auth.ts isValidEmail (exact regex).
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength and return error message.
 * Parity port of apps/factorybay/src/lib/auth.ts validatePassword (exact
 * rules, messages and order — length first for determinism).
 */
export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number'
  }
  return null
}

/**
 * Project the engine `User` onto `v1.AccountDTO`. Field-explicit by design —
 * `findUserByEmail` returns the raw record including `passwordHash`, and this
 * projection is the single choke point that keeps hashes inside the engine.
 * `phone` may be absent (Neo4j drops null properties) — emit it only when set.
 */
export function toAccountDTO(user: User): v1.AccountDTO {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    ...(user.phone !== undefined && user.phone !== null ? { phone: user.phone } : {}),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export function createAccountService(
  config: EngineConfig,
  _tenant: TenantRef
): v1.AccountService {
  const db = config.neo4j.database

  return {
    async signUp(command) {
      // Mirrors signupAction's check order: email format → password strength
      // → duplicate → hash → create.
      if (!isValidEmail(command.email)) {
        return err('VALIDATION', INVALID_EMAIL_MESSAGE)
      }
      const passwordError = validatePassword(command.password)
      if (passwordError) {
        return err('VALIDATION', passwordError)
      }
      try {
        if (await userRepo.emailExists(command.email, db)) {
          // Parity: the app renders 'An account with this email already exists'
          return err('CONFLICT', 'An account with this email already exists')
        }
        const passwordHash = await bcrypt.hash(command.password, SALT_ROUNDS)
        const user = await userRepo.createUser(
          {
            email: command.email,
            password: command.password,
            firstName: command.firstName,
            lastName: command.lastName,
            ...(command.phone !== undefined ? { phone: command.phone } : {}),
            role: command.role ?? 'CUSTOMER',
            passwordHash,
          },
          db
        )
        return ok(toAccountDTO(user))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to sign up', { cause: String(e) })
      }
    },

    async authenticate(credentials) {
      // loginAction validates the email shape first and renders the same
      // invalid-email message on this branch; unknown email and wrong
      // password are both UNAUTHORIZED with the parity message below.
      if (!isValidEmail(credentials.email)) {
        return err('VALIDATION', INVALID_EMAIL_MESSAGE)
      }
      try {
        const user = await userRepo.findUserByEmail(credentials.email, db)
        if (!user) {
          return err('UNAUTHORIZED', 'Invalid email or password')
        }
        // lib/auth.ts verifyPassword pattern: bcrypt.compare(password, hash-from-DB)
        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) {
          return err('UNAUTHORIZED', 'Invalid email or password')
        }
        return ok(toAccountDTO(user))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to authenticate', { cause: String(e) })
      }
    },

    async getProfile(userId) {
      try {
        const user = await userRepo.findUserById(userId, db)
        return user ? ok(toAccountDTO(user)) : err('NOT_FOUND', `User ${userId} not found`)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to get profile', { cause: String(e) })
      }
    },
  }
}
