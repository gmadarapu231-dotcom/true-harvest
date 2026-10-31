'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';

export type SideItem = { href: string; label: string; icon: string };

// Dashboard sidebar. On phones it either hides (the bottom tab bar takes over) or turns into a scrolling row of pills.
export default function SideNav({ title, items, mobile = 'scroll' }: { title: string; items: SideItem[]; mobile?: 'scroll' | 'hide' }) {
  const path = usePathname();
  // The longest item that matches the path is the current one, so /farmer/listings/new does not also light up /farmer.
  const current = items.map((i) => i.href).filter((h) => path === h || path.startsWith(h + '/')).sort((a, b) => b.length - a.length)[0];
  const active = (href: string) => href === current;
  return (
    <aside className={`side side-${mobile}`}>
      <div className="side-title">{title}</div>
      <nav aria-label={title}>
        {items.map((i) => (
          <Link key={i.href} href={i.href} title={i.label} aria-current={active(i.href) ? 'page' : undefined}>
            <Icon name={i.icon} size={19} /><span>{i.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
