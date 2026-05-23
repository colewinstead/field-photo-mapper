import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Field Photo Mapper',
  description: 'Upload geotagged field photos and export Google Earth KMZ files.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
