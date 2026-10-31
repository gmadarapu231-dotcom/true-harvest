import SideNav, { type SideItem } from '@/components/SideNav';

const ITEMS: SideItem[] = [
  { href: '/admin', label: 'Overview', icon: 'chart' }, { href: '/admin/orders', label: 'Orders', icon: 'orders' },
  { href: '/admin/farmers', label: 'Farmers', icon: 'farmer' }, { href: '/admin/listings', label: 'Listings & stock', icon: 'wheat' },
  { href: '/admin/enquiries', label: 'Enquiry board', icon: 'handshake' }, { href: '/admin/complaints', label: 'Complaints', icon: 'complaint' },
  { href: '/admin/settlements', label: 'Bank settlements', icon: 'rupee' }, { href: '/admin/finance', label: 'Finance', icon: 'wallet' },
  { href: '/admin/services', label: 'Farmer services', icon: 'truck' },
  { href: '/admin/mandi', label: 'Mandi prices', icon: 'scale' }, { href: '/admin/accounts', label: 'Accounts & staff', icon: 'user' },
  { href: '/admin/settings', label: 'Rules & flags', icon: 'settings' }, { href: '/admin/audit', label: 'Audit log', icon: 'shield' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash">
      <SideNav title="Operations" items={ITEMS} mobile="scroll" />
      <div className="dash-main">{children}</div>
    </div>
  );
}
