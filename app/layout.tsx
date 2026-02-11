import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import DarkModeProvider from '@/components/DarkModeProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'YCode - Visual Website Builder',
  description: 'Self-hosted visual website builder',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Dark mode is handled client-side by DarkModeProvider
  // This avoids using headers() which would force all pages to be dynamic
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased text-xs`}>
        <AuthProvider>
          <DarkModeProvider>
            {children}
          </DarkModeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
