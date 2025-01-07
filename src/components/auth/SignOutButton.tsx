'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

interface SignOutButtonProps {
  className?: string
}

export function SignOutButton({ className }: SignOutButtonProps) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/auth/signin' })}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 ${className}`}
    >
      <LogOut className="h-4 w-4" />
      Sign Out
    </button>
  )
} 