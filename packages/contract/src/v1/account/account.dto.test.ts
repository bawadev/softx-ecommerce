import { describe, it, expect } from 'vitest'
import {
  AccountSchema,
  SignUpCommandSchema,
  CredentialsSchema,
  UserRoleSchema,
} from './account.dto'

const validAccount = {
  id: 'u1',
  email: 'user@example.com',
  role: 'CUSTOMER',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: '+94770000000',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const validSignUp = {
  email: 'user@example.com',
  password: 'Password123',
  firstName: 'Ada',
  lastName: 'Lovelace',
}

describe('account DTOs', () => {
  it('strips unknown keys — passwordHash never survives an AccountDTO parse', () => {
    const parsed = AccountSchema.safeParse({ ...validAccount, passwordHash: '$2a$12$secret' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect('passwordHash' in parsed.data).toBe(false)
      expect(JSON.stringify(parsed.data)).not.toContain('secret')
    }
  })
  it('rejects an empty password in SignUpCommand', () => {
    const bad = SignUpCommandSchema.safeParse({ ...validSignUp, password: '' })
    expect(bad.success).toBe(false)
  })
  it('requires both email and password on Credentials', () => {
    expect(CredentialsSchema.safeParse({ email: 'user@example.com' }).success).toBe(false)
    expect(CredentialsSchema.safeParse({ password: 'Password123' }).success).toBe(false)
    expect(
      CredentialsSchema.safeParse({ email: 'user@example.com', password: 'Password123' }).success
    ).toBe(true)
  })
  it("rejects a role outside the UserRole enum ('SUPERUSER')", () => {
    expect(UserRoleSchema.safeParse('SUPERUSER').success).toBe(false)
    expect(AccountSchema.safeParse({ ...validAccount, role: 'SUPERUSER' }).success).toBe(false)
  })
})
