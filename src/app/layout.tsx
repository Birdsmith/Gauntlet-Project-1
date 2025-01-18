import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SessionProvider } from '@/components/SessionProvider'
import { Toaster } from '@/components/ui/toaster'
import { SocketProvider } from '@/contexts/SocketContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ChatGenius',
  description: 'A modern chat application',
  icons: {
    icon: '/next.svg',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionProvider session={session}>
          <SocketProvider>
            <Toaster />
            {children}
          </SocketProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
