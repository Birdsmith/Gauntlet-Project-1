import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { notFound } from 'next/navigation'

export default function NotFoundCatchAll() {
  notFound()

  // This won't be rendered, but TypeScript needs a return statement
  return null
}
