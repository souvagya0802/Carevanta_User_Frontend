import type { MetadataRoute } from 'next';

/** Installable on Android, iPhone (Add to Home Screen) and desktop: full screen, own icon, push notifications. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Carevanta',
    short_name: 'Carevanta',
    description: 'Verified doctors, lab tests, medicines and ambulances near you.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#eef4ff',
    theme_color: '#1E6CFF',
    lang: 'en-IN',
    categories: ['medical', 'health', 'lifestyle'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Emergency', url: '/emergency', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Find a Doctor', url: '/search?type=doctors', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'My Care', url: '/care', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
