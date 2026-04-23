import type { Metadata } from 'next';
import { Nav } from '../components/Nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Orbital — Subscription Commerce',
  description: 'Recurring revenue infrastructure for B2B SaaS.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
