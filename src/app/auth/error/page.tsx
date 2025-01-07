'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const getErrorMessage = (error: string | null) => {
  switch (error) {
    case 'Configuration':
      return 'There is a problem with the server configuration. Please contact support.'
    case 'AccessDenied':
      return 'You do not have access to this application.'
    case 'Verification':
      return 'The verification link may have expired or has already been used.'
    default:
      return 'An unexpected error occurred. Please try again.'
  }
}

export default function AuthError() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const errorMessage = getErrorMessage(error)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-100 to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-lg dark:bg-gray-800">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Authentication Error
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {errorMessage}
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/auth/signin"
            className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
} 