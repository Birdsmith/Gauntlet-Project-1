'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useToast } from '@/components/ui/use-toast'

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { toast } = useToast()
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const initSocket = useCallback(async () => {
    try {
      // Clear any existing reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      if (!socketRef.current) {
        const socketUrl = 'http://localhost:3001'
        console.log('Initializing socket connection to:', socketUrl)

        socketRef.current = io(socketUrl, {
          transports: ['websocket', 'polling'],
          withCredentials: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 10000,
          autoConnect: true,
        })

        socketRef.current.on('connect', () => {
          console.log('Socket connected successfully:', socketRef.current?.id)
          setIsConnected(true)
        })

        socketRef.current.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason)
          setIsConnected(false)
          
          // Only show toast for unexpected disconnections
          if (reason !== 'io client disconnect') {
            toast({
              title: 'Connection lost',
              description: 'Attempting to reconnect...',
              variant: 'destructive',
            })
          }
        })

        socketRef.current.on('connect_error', (error: Error) => {
          console.error('Socket connection error:', error.message)
          setIsConnected(false)
          
          // Schedule a reconnection attempt after 2 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect socket...')
            // Clean up the old socket
            if (socketRef.current) {
              socketRef.current.disconnect()
              socketRef.current = null
            }
            // Try to initialize again
            initSocket()
          }, 2000)
        })

        socketRef.current.on('reconnect', (attemptNumber: number) => {
          console.log('Socket reconnected after', attemptNumber, 'attempts')
          setIsConnected(true)
          toast({
            title: 'Reconnected',
            description: 'Chat connection restored',
          })
        })

        socketRef.current.on('reconnect_attempt', (attemptNumber: number) => {
          console.log('Reconnection attempt:', attemptNumber)
        })

        socketRef.current.on('reconnect_error', (error: Error) => {
          console.error('Socket reconnection error:', error.message)
        })

        socketRef.current.on('reconnect_failed', () => {
          console.error('Socket reconnection failed')
          toast({
            title: 'Connection failed',
            description: 'Unable to restore chat connection. Please refresh the page.',
            variant: 'destructive',
          })
        })
      }
    } catch (error) {
      console.error('Socket initialization error:', error)
      setIsConnected(false)
      
      // Schedule a retry after 2 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        initSocket()
      }, 2000)
    }
  }, [setIsConnected, toast])

  useEffect(() => {
    initSocket()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [initSocket])

  return { socket: socketRef.current, isConnected }
} 