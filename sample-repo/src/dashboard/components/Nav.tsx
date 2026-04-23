import Link from 'next/link';

const items = [
  { href: '/dashboard',     label: 'Overview' },
  { href: '/subscriptions', label: 'Subscriptions' },
  { href: '/customers',     label: 'Customers' },
  { href: '/invoices',      label: 'Invoices' },
  { href: '/settings',      label: 'Settings' },
];

export function Nav() {
  return (
    <nav className="flex items-center justify-between border-b border-slate-800 bg-orbital-bg px-6 py-4">
      <Link href="/" className="text-xl font-semibold text-white">
        Orbital
      </Link>
      <ul className="flex gap-6 text-sm text-slate-300">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="hover:text-white">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
