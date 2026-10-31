export type ErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'UNAVAILABLE'
  | 'UNKNOWN'

export interface DomainError {
  code: ErrorCode
  message: string
  details?: Record<string, unknown>
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: DomainError }

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err(code: ErrorCode, message: string, details?: Record<string, unknown>): Result<never> {
  return { ok: false, error: details ? { code, message, details } : { code, message } }
}
