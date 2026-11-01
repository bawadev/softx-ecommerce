import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { v1 } from '@softx/contract'
import {
  isValidEmail,
  validatePassword,
  toAccountDTO,
} from './account'
import { toPreferencesDTO, toMeasurementsDTO } from './profile'
import type { User, UserMeasurements } from './types'

// Parity pins (Phase 4 Task 3): the literals below were copied from
// apps/factorybay/src/lib/auth.ts at write time. The last describe block
// re-reads that app file and fails if it drifts from this engine port, so
// editing one copy without the other breaks `npm test`.

describe('isValidEmail (parity port of lib/auth.ts)', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('first.last@sub.domain.co')).toBe(true)
    expect(isValidEmail('a+tag@example.io')).toBe(true)
  })

  it('rejects malformed addresses (regex /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/)', () => {
    expect(isValidEmail('not-an-email')).toBe(false) // no @
    expect(isValidEmail('user@domain')).toBe(false) // no dot in domain
    expect(isValidEmail('user name@example.com')).toBe(false) // whitespace
    expect(isValidEmail('user@@example.com')).toBe(false) // double @
    expect(isValidEmail('user@exa mple.com')).toBe(false) // whitespace in domain
    expect(isValidEmail('')).toBe(false)
  })
})

describe('validatePassword (parity port of lib/auth.ts)', () => {
  it('pins the three rules with their exact messages', () => {
    expect(validatePassword('Short1!')).toBe('Password must be at least 8 characters long')
    expect(validatePassword('alllowercase1')).toBe('Password must contain at least one uppercase letter')
    expect(validatePassword('NoNumbersHere!')).toBe('Password must contain at least one number')
  })

  it('checks length first — a short password failing all rules reports the length message', () => {
    expect(validatePassword('short')).toBe('Password must be at least 8 characters long')
  })

  it('accepts conforming passwords with null (8-char boundary included)', () => {
    expect(validatePassword('Valid123')).toBeNull()
    expect(validatePassword('Abcdefg1')).toBeNull() // exactly 8 chars
  })
})

describe('toAccountDTO (hash-free projection)', () => {
  it('projects only contract fields — no password-ish key or value even when the record carries a hash', () => {
    // findUserByEmail returns the raw record INCLUDING passwordHash; the
    // conformance suite stringifies the DTO and greps it.
    const raw = {
      id: 'u1',
      email: 'u@example.com',
      passwordHash: '$2a$12$definitelyAHaShValue',
      role: 'CUSTOMER',
      firstName: 'A',
      lastName: 'B',
      phone: null, // Neo4j drops null properties — key may be absent or null
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as unknown as User
    const dto = toAccountDTO(raw)
    expect(() => v1.AccountSchema.parse(dto)).not.toThrow()
    expect('passwordHash' in dto).toBe(false)
    expect('password' in dto).toBe(false)
    expect('phone' in dto).toBe(false) // null phone is omitted, not emitted
    expect(JSON.stringify(dto)).not.toMatch(/[Pp]assword|[Hh]ash/)
  })
})

describe('toPreferencesDTO (read-path priceRange trap)', () => {
  it('materializes the default shape for a user with no preference node', () => {
    const dto = toPreferencesDTO(null)
    expect(() => v1.UserPreferencesSchema.parse(dto)).not.toThrow()
    expect(dto.preferredBrands).toEqual([])
    expect(dto.preferredColors).toEqual([])
    expect(dto.preferredCategories).toEqual([])
    expect(dto.priceRange).toEqual({ min: 0, max: 500 })
  })

  it("parses the read path's JSON-string priceRange and drops id/userId", () => {
    // TRAP: upsertUserPreferences JSON.stringify's priceRange;
    // getUserPreferences returns it still stringified.
    const dto = toPreferencesDTO({
      id: 'p1',
      userId: 'u1',
      preferredBrands: ['Acme'],
      preferredColors: ['Black'],
      preferredCategories: ['SHIRT'],
      priceRange: '{"min":0,"max":50000}' as unknown as { min: number; max: number },
    })
    expect(dto.priceRange).toEqual({ min: 0, max: 50000 }) // object, not string
    expect(dto.preferredBrands).toEqual(['Acme'])
    expect('id' in dto).toBe(false)
    expect('userId' in dto).toBe(false)
    expect(() => v1.UserPreferencesSchema.parse(dto)).not.toThrow()
  })

  it('falls back to the default priceRange when the string does not parse', () => {
    const dto = toPreferencesDTO({
      id: 'p1',
      userId: 'u1',
      preferredBrands: [],
      preferredColors: [],
      preferredCategories: [],
      priceRange: 'not-json{' as unknown as { min: number; max: number },
    })
    expect(dto.priceRange).toEqual({ min: 0, max: 500 })
  })
})

describe('toMeasurementsDTO (missing-not-null trap)', () => {
  it("materializes { unit: 'METRIC' } for a user with no measurements node", () => {
    const dto = toMeasurementsDTO(null)
    expect(dto.unit).toBe('METRIC')
    expect(() => v1.UserMeasurementsSchema.parse(dto)).not.toThrow()
  })

  it('never emits null numerics — absent stays absent; present values pass through', () => {
    // TRAP: upsertUserMeasurements writes `value || null` and Neo4j drops
    // null properties, so absent metrics come back as MISSING keys — but a
    // stale row (or the pre-fix read) can also surface explicit nulls. The
    // DTO fields are zod .optional() (undefined-only): null must be stripped.
    const raw = {
      id: 'm1',
      userId: 'u1',
      chest: null,
      waist: 80,
      preferredSize: null,
      unit: 'METRIC',
    } as unknown as UserMeasurements
    const dto = toMeasurementsDTO(raw)
    expect('chest' in dto).toBe(false)
    expect('preferredSize' in dto).toBe(false)
    expect(dto.waist).toBe(80)
    expect((Object.values(dto) as unknown[]).includes(null)).toBe(false)
    expect(() => v1.UserMeasurementsSchema.parse(dto)).not.toThrow()
  })

  it("defaults a missing unit to 'METRIC'", () => {
    const raw = { id: 'm1', userId: 'u1', chest: 100 } as unknown as UserMeasurements
    expect(toMeasurementsDTO(raw).unit).toBe('METRIC')
  })
})

describe('parity drift tripwire against apps/factorybay/src/lib/auth.ts', () => {
  it('the app file still carries the exact regex, messages and rule order ported into account.ts', () => {
    // Resolved from this file's location (not cwd) so the check works from
    // any vitest invocation directory.
    const appAuthPath = fileURLToPath(
      new URL('../../../apps/factorybay/src/lib/auth.ts', import.meta.url)
    )
    const appAuth = readFileSync(appAuthPath, 'utf8')

    expect(appAuth).toContain('const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/')
    const lengthAt = appAuth.indexOf('Password must be at least 8 characters long')
    const upperAt = appAuth.indexOf('Password must contain at least one uppercase letter')
    const numberAt = appAuth.indexOf('Password must contain at least one number')
    expect(lengthAt).toBeGreaterThan(-1)
    expect(upperAt).toBeGreaterThan(-1)
    expect(numberAt).toBeGreaterThan(-1)
    // order matters for determinism: length → uppercase → number
    expect(lengthAt).toBeLessThan(upperAt)
    expect(upperAt).toBeLessThan(numberAt)
  })
})
