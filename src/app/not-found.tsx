import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <html>
      <body>
        <div className="flex h-screen flex-col items-center justify-center space-y-4">
          <h2 className="text-2xl font-bold">404 - Page Not Found</h2>
          <p className="text-gray-600">The page you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/">
            <Button className="bg-indigo-600 hover:bg-indigo-700">Return Home</Button>
          </Link>
        </div>
      </body>
    </html>
  )
}
