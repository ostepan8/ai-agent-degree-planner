import type { Metadata } from 'next'
import { Manrope, Chivo_Mono } from 'next/font/google'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

const chivoMono = Chivo_Mono({
  subsets: ['latin'],
  variable: '--font-chivo-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AI Degree Planner | Subconscious Demo',
  description: 'Build your 4-year degree plan with AI agents that search official university catalogs in real-time.',
  icons: {
    icon: '/Subconscious_Logo_Graphic.png',
    apple: '/Subconscious_Logo_Graphic.png',
  },
  openGraph: {
    title: 'AI Degree Planner',
    description: 'Build your 4-year degree plan with AI agents that search official university catalogs in real-time.',
    images: ['/Subconscious_Logo_Graphic.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${chivoMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
