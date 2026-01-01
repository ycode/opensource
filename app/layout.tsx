import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'YCode - Visual Website Builder',
  description: 'Self-hosted visual website builder',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get the current pathname to determine if we're in the editor
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  const isPreviewRoute = pathname.startsWith('/ycode/preview');

  // Apply dark mode for editor and welcome routes (/ycode, /welcome)
  const isDarkMode = !isPreviewRoute && (pathname.startsWith('/ycode') || pathname.startsWith('/welcome'));

  return (
    <html lang="en" className={isDarkMode ? 'dark' : ''}>
      <body className={`${inter.variable} font-sans antialiased text-xs`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
