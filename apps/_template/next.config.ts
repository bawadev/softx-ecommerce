import type { NextConfig } from 'next'

/**
 * Minimal storefront config. Deliberately nothing else: no i18n plugin, no
 * image optimizer domains (this template renders plain <img> tags — swap in
 * next/image per client if desired), no server-action body limits. Each
 * instantiated client app owns its own config from this starting point.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
