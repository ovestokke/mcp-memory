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