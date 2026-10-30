import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { BRAND } from '@/lib/config';
import { currentUser } from '@/lib/auth';
import { getLang, translator } from '@/lib/i18n';
import { readCart } from '@/lib/cart';
import { one } from '@/lib/db';
import { Logo } from '@/components/ui';
import { setLang, logout } from '@/lib/actions/auth';
import { headers } from 'next/headers';
import RegisterSW from '@/components/RegisterSW';

export const metadata: Metadata = {
  title: { default: `${BRAND.name}: fresh from the farm`, template: `%s · ${BRAND.name}` },
  description: 'Buy fresh produce directly from farmers in Telangana and Andhra Pradesh. Households, restaurants and retailers welcome.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#1d5c3a', width: 'device-width', initialScale: 1 };

type NavItem = { href: string; label: string; icon: string };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const lang = await getLang(user?.lang);
  const t = translator(lang);
  const path = (await headers()).get('x-pathname') ?? '/';
  const cartCount = (await readCart()).length;
  const unread = user ? (await one<{ n: number }>('SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL', [user.id]))?.n ?? 0 : 0;

  const nav: NavItem[] = !user || user.role === 'consumer'
    ? [{ href: '/', label: 'Home', icon: '🏡' }, { href: '/shop', label: t('nav.shop'), icon: '🧺' }, { href: '/cart', label: t('nav.cart'), icon: '🛒' }, { href: user ? '/orders' : '/login', label: user ? t('nav.orders') : t('nav.login'), icon: '📦' }]
    : user.role === 'farmer'
      ? [{ href: '/farmer', label: t('nav.farmer'), icon: '🏡' }, { href: '/farmer/listings', label: t('nav.listings'), icon: '🌾' }, { href: '/farmer/orders', label: t('nav.orders'), icon: '📦' }, { href: '/farmer/enquiries', label: t('nav.enquiries'), icon: '🤝' }, { href: '/farmer/payments', label: t('nav.payments'), icon: '💰' }]
      : user.role === 'business'
        ? [{ href: '/business', label: 'Dashboard', icon: '🏢' }, { href: '/shop', label: 'Catalogue', icon: '🧺' }, { href: '/business/enquiries/new', label: 'Post requirement', icon: '📝' }, { href: '/orders', label: 'Orders', icon: '📦' }]
        : user.role === 'partner'
          ? [{ href: '/partner', label: 'Today’s tasks', icon: '🛵' }]
          : [{ href: '/admin', label: 'Overview', icon: '📊' }, { href: '/admin/orders', label: 'Orders', icon: '📦' }, { href: '/admin/farmers', label: 'Farmers', icon: '👩‍🌾' }, { href: '/admin/settlements', label: 'Settlements', icon: '💰' }];

  return (
    <html lang={lang === 'te' ? 'te' : 'en-IN'}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600;700&display=swap" />
      </head>
      <body>
        <header className="top">
          <div className="wrap">
            <Link href="/" className="brand" aria-label={BRAND.name}><Logo /> <span className="brand-name">{BRAND.name}</span></Link>
            <nav aria-label="Main">
              {nav.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
            </nav>
            <div className="right">
              <form action={setLang} className="lang-toggle" aria-label="Language">
                <input type="hidden" name="back" value={path} />
                <button name="lang" value="te" aria-pressed={lang === 'te'}>తెలుగు</button>
                <button name="lang" value="en" aria-pressed={lang === 'en'}>EN</button>
              </form>
              {(!user || user.role === 'consumer' || user.role === 'business') && (
                <Link href="/cart" className="icon-link" aria-label={`Cart, ${cartCount} items`}>🛒{cartCount ? <span className="badge-dot">{cartCount}</span> : null}</Link>
              )}
              {user ? (
                <>
                  <Link href="/notifications" className="icon-link" aria-label={`Notifications, ${unread} unread`}>🔔{unread ? <span className="badge-dot">{unread}</span> : null}</Link>
                  <Link href={user.role === 'farmer' ? '/farmer/profile' : user.role === 'business' ? '/business/profile' : '/profile'} className="icon-link" aria-label="Profile">👤</Link>
                  <form action={logout} className="inline logout"><button className="btn btn-ghost btn-sm">{t('nav.logout')}</button></form>
                </>
              ) : (
                <Link href="/login" className="btn btn-sm">{t('nav.login')}</Link>
              )}
            </div>
          </div>
        </header>
        {children}
        <RegisterSW />
        <nav className="tabbar" aria-label="App">
          {nav.slice(0, 5).map((n) => <Link key={n.href} href={n.href}><span aria-hidden="true">{n.icon}</span>{n.label}</Link>)}
        </nav>
      </body>
    </html>
  );
}
