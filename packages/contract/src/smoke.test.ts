import { describe, it, expect } from 'vitest'
import { packageName } from './index'

describe('@softx/contract scaffold', () => {
  it('is importable', () => {
    expect(packageName).toBe('@softx/contract')
  })
})
