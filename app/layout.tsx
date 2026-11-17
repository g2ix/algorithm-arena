import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Algorithm Arena',
  description: 'Trees & Graphs tournament for CIS 2101',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#070b1a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
