import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name}: farm to market`,
    short_name: BRAND.name,
    description: 'Connecting Farmers. Feeding the World. Graded produce direct from farmers, machine rental, seeds and crop groups.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f5ee',
    theme_color: '#214927',
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
      { name: 'Rent a harvester', url: '/rentals' },
    ],
  };
}
