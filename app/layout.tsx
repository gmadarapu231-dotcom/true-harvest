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
import Icon from '@/components/Icon';
import TabBar from '@/components/TabBar';

export const metadata: Metadata = {
  title: { default: `${BRAND.name}: ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: 'A transparent farm-to-market platform: buy graded produce directly from farmers in Telangana and Andhra Pradesh, with accurate weighment and direct pay to farmers.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-icon.png' },
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#214927', width: 'device-width', initialScale: 1 };

type NavItem = { href: string; label: string; icon: string };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const lang = await getLang(user?.lang);
  const t = translator(lang);
  const path = (await headers()).get('x-pathname') ?? '/';
  const cartCount = (await readCart()).length;
  const unread = user ? (await one<{ n: number }>('SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL', [user.id]))?.n ?? 0 : 0;

  // Bottom tab bar on phones (mirrors the app: Home, Marketplace, Orders, Wallet).
  const tabs: NavItem[] = !user || user.role === 'consumer'
    ? [{ href: '/', label: 'Home', icon: 'home' }, { href: '/shop', label: t('nav.shop'), icon: 'store' }, { href: user ? '/subscriptions' : '/subscribe', label: t('nav.subscribe'), icon: 'sprout' }, { href: '/cart', label: t('nav.cart'), icon: 'cart' }, { href: user ? '/orders' : '/login', label: user ? t('nav.orders') : t('nav.login'), icon: user ? 'orders' : 'user' }]
    : user.role === 'farmer'
      ? [{ href: '/farmer', label: t('nav.farmer'), icon: 'home' }, { href: '/farmer/listings', label: t('nav.listings'), icon: 'wheat' }, { href: '/farmer/orders', label: t('nav.orders'), icon: 'orders' }, { href: '/farmer/enquiries', label: t('nav.enquiries'), icon: 'handshake' }, { href: '/farmer/payments', label: t('nav.payments'), icon: 'wallet' }]
      : user.role === 'business'
        ? [{ href: '/business', label: 'Home', icon: 'home' }, { href: '/shop', label: 'Marketplace', icon: 'store' }, { href: '/business/enquiries/new', label: 'Requirement', icon: 'file' }, { href: '/orders', label: 'Orders', icon: 'orders' }]
        : user.role === 'partner'
          ? [{ href: '/partner', label: 'Today’s tasks', icon: 'truck' }]
          : [{ href: '/admin', label: 'Overview', icon: 'chart' }, { href: '/admin/orders', label: 'Orders', icon: 'orders' }, { href: '/admin/farmers', label: 'Farmers', icon: 'farmer' }, { href: '/admin/settlements', label: 'Settlements', icon: 'rupee' }];
  // Desktop header links. Farmers and ops staff get a sidebar instead.
  const links: NavItem[] = !user || user.role === 'consumer'
    ? [{ href: '/shop', label: t('nav.shop'), icon: '' }, { href: user ? '/subscriptions' : '/subscribe', label: t('nav.subscribe'), icon: '' }, { href: '/nutrition', label: t('nav.nutrition'), icon: '' }, { href: '/crops', label: t('nav.crops'), icon: '' }, { href: '/rentals', label: t('nav.rentals'), icon: '' }, { href: '/inputs', label: t('nav.inputs'), icon: '' }, { href: '/groups', label: t('nav.groups'), icon: '' }, ...(user ? [{ href: '/orders', label: t('nav.orders'), icon: '' }] : [{ href: '/#about', label: 'About Us', icon: '' }])]
    : user.role === 'business'
      ? [{ href: '/business', label: 'Dashboard', icon: '' }, { href: '/shop', label: 'Marketplace', icon: '' }, { href: '/business/enquiries/new', label: 'Post requirement', icon: '' }, { href: '/orders', label: 'Orders', icon: '' }]
      : user.role === 'partner' ? [{ href: '/partner', label: 'Today’s tasks', icon: '' }]
        : user.role === 'farmer' ? [{ href: '/rentals', label: t('nav.rentals'), icon: '' }, { href: '/inputs', label: t('nav.inputs'), icon: '' }, { href: '/groups', label: t('nav.groups'), icon: '' }, { href: '/crops', label: t('nav.crops'), icon: '' }] : [];
  const home = user ? (user.role === 'farmer' ? '/farmer' : user.role === 'admin' ? '/admin' : user.role === 'partner' ? '/partner' : user.role === 'business' ? '/business' : '/') : '/';

  return (
    <html lang={lang === 'te' ? 'te' : 'en-IN'}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kaushan+Script&family=Poppins:wght@500;600;700&family=Noto+Sans+Telugu:wght@400;600;700&display=swap" />
      </head>
      <body>
        <header className="top">
          <div className="wrap">
            <Link href={home} className="brand" aria-label={`${BRAND.name} home`}><Logo tagline /></Link>
            <nav aria-label="Main">
              {links.map((n) => <Link key={n.href} href={n.href} className={n.href === '/#about' || n.href === '/groups' ? 'nav-wide' : undefined}>{n.label}</Link>)}
            </nav>
            <div className="right">
              <form action={setLang} className="lang-toggle" aria-label="Language">
                <input type="hidden" name="back" value={path} />
                <button name="lang" value="te" aria-pressed={lang === 'te'}>తెలుగు</button>
                <button name="lang" value="en" aria-pressed={lang === 'en'}>EN</button>
              </form>
              {(!user || user.role === 'consumer' || user.role === 'business') && (
                <Link href="/cart" className="icon-link" aria-label={`Cart, ${cartCount} items`}><Icon name="cart" />{cartCount ? <span className="badge-dot">{cartCount}</span> : null}</Link>
              )}
              {user ? (
                <>
                  <Link href="/notifications" className="icon-link" aria-label={`Notifications, ${unread} unread`}><Icon name="bell" />{unread ? <span className="badge-dot">{unread}</span> : null}</Link>
                  <Link href={user.role === 'farmer' ? '/farmer/profile' : user.role === 'business' ? '/business/profile' : '/profile'} className="avatar-link" aria-label="Profile">{user.name?.trim()?.[0]?.toUpperCase() || <Icon name="user" />}</Link>
                  <form action={logout} className="inline logout"><button className="btn btn-ghost btn-sm">{t('nav.logout')}</button></form>
                </>
              ) : (
                <Link href="/login" className="btn btn-sm login-btn">Register / Login</Link>
              )}
            </div>
          </div>
        </header>
        {children}
        <RegisterSW />
        <TabBar tabs={tabs} />
      </body>
    </html>
  );
}
