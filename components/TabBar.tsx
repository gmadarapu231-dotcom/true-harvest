'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';

// Bottom tab bar on phones. Client-side so the active tab follows soft navigations (the root layout does not re-render).
export default function TabBar({ tabs }: { tabs: { href: string; label: string; icon: string }[] }) {
  const path = usePathname();
  const current = tabs.map((t) => t.href).filter((h) => (h === '/' ? path === '/' : path === h || path.startsWith(h + '/'))).sort((a, b) => b.length - a.length)[0];
  return (
    <nav className="tabbar" aria-label="App">
      {tabs.slice(0, 5).map((n) => (
        <Link key={n.href} href={n.href} aria-current={n.href === current ? 'page' : undefined}><Icon name={n.icon} size={22} />{n.label}</Link>
      ))}
    </nav>
  );
}
