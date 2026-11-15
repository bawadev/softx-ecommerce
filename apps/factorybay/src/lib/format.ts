// LKD-45: shared date formatting. A fixed display timeZone keeps the SSR
// string and the client hydration string byte-identical — React #418 fired
// on /en/orders when server (UTC) and client (IST) disagreed about the date
// near midnight. The locale comes from next-intl instead of the hardcoded
// 'en-US' the three call sites used before.
const DISPLAY_TZ = 'Asia/Colombo'

interface FormatDateOptions {
  /** 'long' renders "November 15, 2026" (order confirmation); default 'short'. */
  month?: 'short' | 'long'
  /** Append "at 14:05" style time (admin orders list). */
  time?: boolean
}

export function formatDate(
  iso: string | number | Date,
  locale: string,
  opts: FormatDateOptions = {}
): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: opts.month ?? 'short',
    day: 'numeric',
    ...(opts.time ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
    timeZone: DISPLAY_TZ,
  }).format(date)
}
