// @lifecycle ACTIVE — Root layout

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Floweng — English Learning Platform',
  description: 'Learn English with Floweng',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
