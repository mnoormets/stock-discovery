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
              <Link href="/today">Today</Link>
              <Link href="/scanner">Discover</Link>
              <Link href="/watchlist">Research</Link>
              <Link href="/portfolio">Portfell</Link>
              <Link href="/performance">Performance</Link>
              <Link href="/guide">Kasutusjuhend</Link>
              <details className="navMore"><summary>Diagnostika</summary><div>
                <Link href="/daily">Daily Changes</Link><Link href="/validation">Validation</Link>
                <Link href="/frequency">Frequency</Link><Link href="/missed-moves">Missed Moves</Link>
                <Link href="/backtest">Backtest</Link><Link href="/research/outcome-attribution">Attribution</Link>
                <Link href="/research/outcome-coverage">Coverage</Link><Link href="/research/outcome-backfill-audit">Backfill Audit</Link>
                <Link href="/research/discovery-quality">Discovery Quality</Link><Link href="/research/metadata-coverage">Metadata Coverage</Link>
                <Link href="/research/metadata-root-cause">Join Root Cause</Link>
              </div></details>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
