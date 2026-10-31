import SideNav from '@/components/SideNav';
import { getLang, translator } from '@/lib/i18n';
import { currentUser } from '@/lib/auth';

export default async function FarmerLayout({ children }: { children: React.ReactNode }) {
  const t = translator(await getLang((await currentUser())?.lang));
  const items = [
    { href: '/farmer', label: t('nav.farmer'), icon: 'home' }, { href: '/farmer/listings', label: t('nav.listings'), icon: 'wheat' },
    { href: '/farmer/listings/new', label: t('farmer.addCrop'), icon: 'plus' }, { href: '/farmer/orders', label: t('nav.orders'), icon: 'orders' },
    { href: '/farmer/enquiries', label: t('nav.enquiries'), icon: 'handshake' }, { href: '/farmer/payments', label: t('nav.payments'), icon: 'wallet' },
    { href: '/farmer/services', label: t('nav.services'), icon: 'truck' },
    { href: '/farmer/profile', label: t('nav.profile'), icon: 'user' },
  ];
  return (
    <div className="dash">
      <SideNav title={t('farmer.dashboard')} items={items} mobile="hide" />
      <div className="dash-main">{children}</div>
    </div>
  );
}
