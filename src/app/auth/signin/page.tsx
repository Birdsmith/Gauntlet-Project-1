'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams?.get('registered') === 'true') {
      setSuccess('Registration successful! Please sign in with your new account.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
        setIsLoading(false)
        return
      }

      if (result?.ok) {
        router.push('/')
        router.refresh()
      }
    } catch (error) {
      setError('An error occurred during sign in')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-indigo-900 to-blue-700 relative overflow-hidden">
      {/* Floating elements in background */}
      <div className="absolute inset-0">
        <div className="absolute w-72 h-72 -top-20 -left-20 bg-purple-500/20 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute w-72 h-72 -bottom-20 -right-20 bg-blue-500/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute w-72 h-72 top-1/4 left-1/3 bg-indigo-500/20 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Stars background */}
      <div className="absolute inset-0 bg-[url('/stars.svg')] opacity-30"></div>

      {/* Login card */}
      <div className="relative w-full max-w-md p-8 bg-gray-900/80 backdrop-blur-sm rounded-lg shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome back!</h1>
          <p className="text-gray-300">We&apos;re so excited to see you again!</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {success && (
            <div className="text-green-400 text-sm bg-green-400/10 p-3 rounded-md border border-green-400/20">
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 uppercase tracking-wide">
              EMAIL <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-800/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your email"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 uppercase tracking-wide">
              PASSWORD <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-800/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
          </div>

          <Link
            href="/auth/forgot-password"
            className="block text-sm text-blue-400 hover:underline"
          >
            Forgot your password?
          </Link>

          {error && (
            <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-md border border-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="text-sm text-gray-400">
            Need an account?{' '}
            <Link href="/auth/register" className="text-blue-400 hover:underline">
              Register
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
