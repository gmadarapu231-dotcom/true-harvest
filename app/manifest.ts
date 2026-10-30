import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name}: farm to market`,
    short_name: BRAND.name,
    description: 'Fresh produce direct from farmers in Telangana and Andhra Pradesh.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbf8f1',
    theme_color: '#1d5c3a',
    lang: 'en-IN',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    shortcuts: [
      { name: 'Shop', url: '/shop' },
      { name: 'My farm', url: '/farmer' },
    ],
  };
}
