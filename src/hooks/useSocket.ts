'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Socket, io as socketIO } from 'socket.io-client'

interface UseSocketReturn {
  socket: Socket | null
  isConnected: boolean
  sendMessage: (event: string, data: any) => Promise<void>
}

// Create a singleton socket instance that persists across component remounts
let globalSocket: Socket | null = null
let globalUserId: string | null = null
let messageQueue: { event: string; data: any }[] = []
let isConnecting = false

export const useSocket = (): UseSocketReturn => {
  const { data: session } = useSession()
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 3

  const processMessageQueue = useCallback(() => {
    if (!globalSocket?.connected) return

    while (messageQueue.length > 0) {
      const message = messageQueue.shift()
      if (message) {
        console.log('Processing queued message:', message.event)
        globalSocket.emit(message.event, message.data)
      }
    }
  }, [])

  const sendMessage = useCallback(async (event: string, data: any) => {
    return new Promise<void>((resolve, reject) => {
      if (!globalSocket) {
        console.error('No socket instance available')
        reject(new Error('No socket instance available'))
        return
      }

      if (!globalSocket.connected) {
        console.log('Socket not connected, queueing message:', event)
        messageQueue.push({ event, data })
        resolve()
        return
      }

      try {
        globalSocket.emit(event, data)
        resolve()
      } catch (error) {
        console.error('Error sending message:', error)
        reject(error)
      }
    })
  }, [])

  useEffect(() => {
    if (!session?.user || typeof window === 'undefined' || isConnecting) {
      return
    }

    if (globalSocket?.connected && globalUserId === session.user.id) {
      setIsConnected(true)
      processMessageQueue()
      return
    }

    if (globalSocket && globalUserId !== session.user.id) {
      console.log('User changed, cleaning up existing socket')
      globalSocket.disconnect()
      globalSocket = null
      globalUserId = null
      messageQueue = []
    }

    if (!globalSocket) {
      isConnecting = true
      console.log('Creating new socket connection for user:', session.user.id)
      
      const socket = socketIO('http://localhost:3001', {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['websocket'],
        forceNew: false,
        auth: {
          userId: session.user.id
        }
      })

      socket.on('connect', () => {
        console.log('Socket connected:', socket.id)
        globalUserId = session.user.id
        setIsConnected(true)
        reconnectAttempts.current = 0
        isConnecting = false
        processMessageQueue()
      })

      socket.on('disconnect', (reason: string) => {
        console.log('Socket disconnected:', reason)
        setIsConnected(false)
        isConnecting = false

        if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.log('Max reconnection attempts reached')
          return
        }

        if (reason === 'io server disconnect' || reason === 'transport close') {
          reconnectAttempts.current++
          console.log(`Reconnection attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`)
          socket.connect()
        }
      })

      socket.on('connect_error', (error: Error) => {
        console.error('Socket connection error:', error)
        setIsConnected(false)
        isConnecting = false
      })

      socket.on('error', (error: Error) => {
        console.error('Socket error:', error)
        setIsConnected(false)
        isConnecting = false
      })

      globalSocket = socket
      socket.connect()
    }

    return () => {
      if (globalSocket && session.user.id !== globalUserId) {
        console.log('Cleaning up socket connection due to user change')
        globalSocket.disconnect()
        globalSocket = null
        globalUserId = null
        messageQueue = []
        setIsConnected(false)
        reconnectAttempts.current = 0
        isConnecting = false
      }
    }
  }, [session, processMessageQueue])

  return {
    socket: globalSocket,
    isConnected,
    sendMessage
  }
} 