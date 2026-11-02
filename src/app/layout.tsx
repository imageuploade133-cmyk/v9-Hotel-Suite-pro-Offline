
import './globals.css';
import { Providers } from './providers';
import { DynamicStyles } from '@/components/theme/dynamic-styles';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { AppInstallProvider } from '@/contexts/app-install-context';

export const metadata = {
  title: 'Hotel Suite Pro',
  description: 'The complete solution for hotel management.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <DynamicStyles />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,700;0,900;1,400&family=Nunito+Sans:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1A237E" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AppInstallProvider>
            <Providers>
                {children}
            </Providers>
          </AppInstallProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}