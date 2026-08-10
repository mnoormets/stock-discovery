import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Stock Discovery — vähemtuntud aktsiate radar',
  description: 'Personaalne tööriist tähelepanu alt üles tõusvate aktsiate leidmiseks.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="et">
      <body>{children}</body>
    </html>
  );
}
