import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Unbounded } from 'next/font/google'
import './globals.css'

const mono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-mono',
  display: 'swap',
})

const display = Unbounded({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  weight: ['500', '700', '900'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  ),
  title: 'Теңге Симулятор 🇰🇿',
  description:
    'Угадай курс доллара на реальной истории USD/KZT. 1 000 000 ₸ на старте — сколько доживёт до десятого раунда?',
}

export const viewport: Viewport = {
  themeColor: '#060a0d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${mono.variable} ${display.variable} font-mono antialiased`}>{children}</body>
    </html>
  )
}
