'use client'

import React from 'react'
import { toast } from '@/components/ui/use-toast'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class SocketErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to your error reporting service
    console.error('Socket Error:', error, errorInfo)

    // Show a toast notification
    toast({
      title: 'Connection Error',
      description: 'There was a problem with the chat connection. Trying to reconnect...',
      variant: 'destructive',
    })
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        this.props.fallback || (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-lg bg-gray-800 p-6 text-center">
              <h3 className="mb-2 text-lg font-semibold text-white">Connection Error</h3>
              <p className="text-sm text-gray-400">
                There was a problem with the chat connection.
                <br />
                Please refresh the page to try again.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
