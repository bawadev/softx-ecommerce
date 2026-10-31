import { getSession } from '../db'
import type { User, CreateUserInput } from '../types'
import { v4 as uuidv4 } from 'uuid'

/**
 * Create a new user in the database
 */
export async function createUser(
  input: CreateUserInput & { passwordHash: string }
): Promise<User> {
  const session = getSession()
  try {
    const userId = uuidv4()
    const now = new Date().toISOString()

    const result = await session.run(
      `
      CREATE (u:User {
        id: $id,
        email: $email,
        passwordHash: $passwordHash,
        role: $role,
        firstName: $firstName,
        lastName: $lastName,
        phone: $phone,
        createdAt: $createdAt,
        updatedAt: $updatedAt
      })
      RETURN u {
        .id,
        .email,
        .role,
        .firstName,
        .lastName,
        .phone,
        .createdAt,
        .updatedAt
      } as user
      `,
      {
        id: userId,
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        role: input.role || 'CUSTOMER',
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
        createdAt: now,
        updatedAt: now,
      }
    )

    const user = result.records[0]?.get('user')
    if (!user) {
      throw new Error('Failed to create user')
    }

    return user as User
  } finally {
    await session.close()
  }
}

/**
 * Find a user by email
 */
export async function findUserByEmail(
  email: string
): Promise<(User & { passwordHash: string }) | null> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (u:User {email: $email})
      RETURN u {
        .*
      } as user
      `,
      { email: email.toLowerCase() }
    )

    const user = result.records[0]?.get('user')
    return user || null
  } finally {
    await session.close()
  }
}

/**
 * Find a user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $id})
      RETURN u {
        .id,
        .email,
        .role,
        .firstName,
        .lastName,
        .phone,
        .createdAt,
        .updatedAt
      } as user
      `,
      { id }
    )

    const user = result.records[0]?.get('user')
    return user || null
  } finally {
    await session.close()
  }
}

/**
 * Check if email already exists
 */
export async function emailExists(email: string): Promise<boolean> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (u:User {email: $email})
      RETURN count(u) > 0 as exists
      `,
      { email: email.toLowerCase() }
    )

    return result.records[0]?.get('exists') || false
  } finally {
    await session.close()
  }
}

/**
 * Update user information
 */
export async function updateUser(
  id: string,
  updates: Partial<Omit<User, 'id' | 'email' | 'createdAt'>>
): Promise<User | null> {
  const session = getSession()
  try {
    const now = new Date().toISOString()
    const result = await session.run(
      `
      MATCH (u:User {id: $id})
      SET u += $updates, u.updatedAt = $updatedAt
      RETURN u {
        .id,
        .email,
        .role,
        .firstName,
        .lastName,
        .phone,
        .createdAt,
        .updatedAt
      } as user
      `,
      {
        id,
        updates,
        updatedAt: now,
      }
    )

    const user = result.records[0]?.get('user')
    return user || null
  } finally {
    await session.close()
  }
}
