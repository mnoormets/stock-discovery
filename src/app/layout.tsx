import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Stock Discovery',
  description: 'Kontrollitavatel andmetel põhinev investeerimisjälgimise tööriist.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="et">
      <body>
        <header className="siteHeader">
          <nav className="nav wrap">
            <Link className="brand" href="/">Stock Discovery</Link>
            <div className="navLinks">
              <Link href="/scanner">Skänner</Link>
              <Link href="/watchlist">Watchlist</Link>
              <Link href="/portfolio">Portfell</Link>
              <Link href="/daily">Daily Changes</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
