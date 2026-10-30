import Link from 'next/link';

const LINKS = [
  ['/admin', 'Overview'], ['/admin/orders', 'Orders'], ['/admin/farmers', 'Farmers'], ['/admin/listings', 'Listings & stock'],
  ['/admin/enquiries', 'Enquiry board'], ['/admin/complaints', 'Complaints'], ['/admin/settlements', 'Settlements'], ['/admin/finance', 'Finance'],
  ['/admin/mandi', 'Mandi prices'], ['/admin/accounts', 'Accounts & staff'], ['/admin/settings', 'Rules & flags'], ['/admin/audit', 'Audit log'],
];

export default function AdminNav({ current }: { current: string }) {
  return (
    <nav className="admin-nav" aria-label="Admin">
      {LINKS.map(([href, label]) => <Link key={href} href={href} aria-current={href === current ? 'page' : undefined}>{label}</Link>)}
    </nav>
  );
}
