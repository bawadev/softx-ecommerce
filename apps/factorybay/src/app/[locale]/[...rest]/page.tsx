import { notFound } from 'next/navigation'

// LKD-47: unknown paths under a locale (e.g. /en/bogus-route) previously
// matched no route at all, so Next resolved the 404 at the root boundary and
// rendered the unbranded default page — outside the locale layout, with no
// header and no way back. This catch-all makes every unknown /<locale>/*
// path match INSIDE [locale], bubble to the branded [locale]/not-found.tsx,
// and keep the site chrome around it.
export default function CatchAllNotFound() {
  notFound()
}
