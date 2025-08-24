import './globals.css'
import { Inter } from 'next/font/google'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Providers } from '../components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Memory - AI Knowledge Explorer',
  description: 'Explore and discover your AI agent memories with intelligent search and organization',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function getThemePreference() {
                  if (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) {
                    return localStorage.getItem('theme');
                  }
                  return 'system';
                }

                function getSystemTheme() {
                  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }

                const theme = getThemePreference();
                const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
                
                document.documentElement.classList.remove('light', 'dark');
                document.documentElement.classList.add(resolvedTheme);
              })()
            `,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </Providers>
      </body>
    </html>
  )
}