import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The storefront (apps/factorybay) renders next-intl catalogues with no
// fallback locale: a key referenced by a component but absent from the
// active catalogue renders as the raw dotted path (e.g. "common.copy").
// This guard fails CI the moment en.json and si.json drift apart.

const messagesDir = fileURLToPath(
  new URL('../../../apps/factorybay/messages', import.meta.url),
)

function loadCatalogue(locale: string): Record<string, string> {
  const raw = readFileSync(`${messagesDir}/${locale}.json`, 'utf8')
  return JSON.parse(raw)
}

/** Flatten nested catalogue objects to dotted key paths. */
function flatten(
  value: unknown,
  prefix = '',
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      Object.assign(out, flatten(entry, path))
    } else {
      out[path] = entry as string
    }
  }
  return out
}

const en = flatten(loadCatalogue('en'))
const si = flatten(loadCatalogue('si'))

describe('factorybay i18n catalogues', () => {
  it('both catalogues parse to non-empty flattened maps', () => {
    expect(Object.keys(en).length).toBeGreaterThan(0)
    expect(Object.keys(si).length).toBeGreaterThan(0)
  })

  it('en and si carry the exact same key set', () => {
    const onlyEn = Object.keys(en)
      .filter((k) => !(k in si))
      .sort()
    const onlySi = Object.keys(si)
      .filter((k) => !(k in en))
      .sort()
    expect(
      { onlyEn, onlySi },
      `catalogue drift — every key must exist in BOTH messages/en.json and messages/si.json (apps/factorybay renders with no fallback locale, so a missing key ships as raw dotted text like "common.copy")`,
    ).toEqual({ onlyEn: [], onlySi: [] })
  })

  it('every value in both catalogues is a non-empty string', () => {
    for (const [locale, catalogue] of [
      ['en', en],
      ['si', si],
    ] as const) {
      const empty = Object.entries(catalogue)
        .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
        .map(([k]) => k)
        .sort()
      expect(empty, `${locale}.json placeholder values`).toEqual([])
    }
  })
})
