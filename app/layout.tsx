import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import type React from 'react'
import { AuthProvider } from '@/src/providers/AuthProvider'
import { QueryProvider } from '@/src/providers/QueryProvider'
import { MetricModeProvider } from '@/src/providers/MetricModeProvider'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Лёха Эйай',
  description: 'AI-powered educational content analysis with Lyoha',
  generator: 'Next.js',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <MetricModeProvider>
              <QueryProvider>{children}</QueryProvider>
            </MetricModeProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
