'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Socket, io as socketIO } from 'socket.io-client'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  connect: () => void
  sendMessage: (event: string, data: any) => Promise<void>
}

// Create context with a default value matching our interface
const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  connect: () => {},
  sendMessage: async () => {},
})

// Global socket instance that persists across re-renders
let globalSocket: Socket | null = null
let globalUserId: string | null = null
let messageQueue: { event: string; data: any }[] = []
let isConnecting = false

/**
 * SocketContext provides real-time socket communication for the chat application.
 *
 * Key Implementation Notes:
 * 1. Session Management:
 *    - Socket connection requires both status === 'authenticated' AND session?.user?.id
 *    - We use useRef to maintain socket instance across renders
 *    - Session state must be valid before attempting socket setup
 *
 * 2. Socket Lifecycle:
 *    - Socket is created in a disconnected state (autoConnect: false)
 *    - Connection is initiated only when explicitly called
 *    - Cleanup happens on component unmount
 *
 * 3. Connection State:
 *    - isConnecting flag prevents multiple simultaneous connection attempts
 *    - isConnected state tracks actual socket connection status
 *    - Reconnection is handled with exponential backoff
 *
 * 4. Message Handling:
 *    - Messages are queued when socket is unavailable
 *    - Queue is processed when connection is established
 *    - Failed messages are re-queued for retry
 */

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 10 // Increased from 3
  const connectionTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const socketRef = useRef<Socket | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const lastPongRef = useRef<number>(Date.now())

  // Ensure we have the latest session state
  useEffect(() => {
    console.log('Session state changed:', {
      status,
      userId: session?.user?.id,
      isAuthenticated: status === 'authenticated',
    })
  }, [session, status])

  const processMessageQueue = useCallback(() => {
    if (!socketRef.current?.connected) {
      console.log('Socket not connected, cannot process message queue')
      return
    }

    while (messageQueue.length > 0) {
      const message = messageQueue.shift()
      if (message) {
        console.log('Processing queued message:', message.event)
        try {
          socketRef.current.emit(message.event, message.data)
        } catch (error) {
          console.error('Error processing queued message:', error)
          messageQueue.unshift(message)
          break
        }
      }
    }
  }, [])

  // Heartbeat mechanism
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (!socketRef.current?.connected) return

      const now = Date.now()
      const timeSinceLastPong = now - lastPongRef.current

      // If no pong received in 45 seconds, consider connection dead
      if (timeSinceLastPong > 45000) {
        console.log('No pong received, reconnecting socket')
        socketRef.current.disconnect()
        socketRef.current.connect()
        return
      }

      // Send ping every 30 seconds
      socketRef.current.emit('ping')
    }, 30000)
  }, [])

  /**
   * Sets up a new socket instance with proper configuration and event handlers.
   * Important: Only creates socket if session is valid and no socket exists.
   * Returns: Existing socket, new socket, or null if setup fails.
   */
  const setupSocket = useCallback(() => {
    if (socketRef.current) {
      console.log('Socket already exists')
      return socketRef.current
    }

    if (!session?.user?.id || status !== 'authenticated') {
      console.log('Cannot setup socket: invalid session state', {
        userId: session?.user?.id,
        status,
      })
      return null
    }

    if (isConnecting) {
      console.log('Already setting up socket')
      return null
    }

    console.log('Setting up new socket connection', {
      userId: session.user.id,
      status,
    })

    isConnecting = true

    const socket = socketIO(process.env.NEXT_PUBLIC_SOCKET_HOST || 'ws://localhost:3001', {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000, // Increased max delay
      timeout: 20000,
      transports: ['websocket'],
      auth: {
        userId: session.user.id,
      },
    })

    socket.on('connect', () => {
      console.log('Socket connected successfully:', socket.id)
      setIsConnected(true)
      isConnecting = false
      reconnectAttempts.current = 0
      lastPongRef.current = Date.now()
      startHeartbeat()
      processMessageQueue()
    })

    socket.on('disconnect', reason => {
      console.log('Socket disconnected:', reason)
      setIsConnected(false)
      isConnecting = false
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
    })

    socket.on('connect_error', error => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
      isConnecting = false

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }

      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
        console.log(`Reconnection attempt ${reconnectAttempts.current}/${maxReconnectAttempts} in ${delay}ms`)

        connectionTimeoutRef.current = setTimeout(() => {
          if (socket && session?.user?.id) {
            socket.auth = { userId: session.user.id }
            socket.connect()
          }
        }, delay)
      } else {
        console.error('Max reconnection attempts reached')
      }
    })

    socket.on('pong', () => {
      lastPongRef.current = Date.now()
    })

    socket.on('error', (error) => {
      console.error('Socket error:', error)
      // Don't disconnect on every error, let the heartbeat mechanism handle dead connections
    })

    socketRef.current = socket
    return socket
  }, [session?.user?.id, status, processMessageQueue, startHeartbeat])

  /**
   * Initiates socket connection if conditions are met:
   * 1. Valid session exists
   * 2. Not already connecting
   * 3. Socket instance available or can be created
   */
  const connect = useCallback(() => {
    console.log('Connect called, current state:', {
      hasSocket: !!socketRef.current,
      isConnected: socketRef.current?.connected,
      userId: session?.user?.id,
      status,
      isConnecting,
    })

    if (status !== 'authenticated' || !session?.user?.id) {
      console.log('Cannot connect: invalid session state')
      return
    }

    if (isConnecting) {
      console.log('Already attempting to connect')
      return
    }

    const socket = socketRef.current || setupSocket()

    if (socket) {
      if (!socket.connected) {
        console.log('Attempting to connect socket')
        socket.connect()
      } else {
        console.log('Socket already connected')
      }
    } else {
      console.log('Failed to setup/get socket')
    }
  }, [setupSocket, session?.user?.id, status])

  /**
   * Handles message sending with queuing mechanism for reliability:
   * - Queues messages when socket is unavailable
   * - Attempts immediate send when socket is connected
   * - Provides consistent promise resolution regardless of send/queue
   */
  const sendMessage = useCallback(async (event: string, data: any) => {
    return new Promise<void>((resolve, reject) => {
      if (!socketRef.current) {
        console.error('No socket instance available')
        messageQueue.push({ event, data })
        console.log('Message queued due to no socket:', event)
        resolve()
        return
      }

      if (!socketRef.current.connected) {
        console.log('Socket not connected, queueing message:', event)
        messageQueue.push({ event, data })
        resolve()
        return
      }

      try {
        console.log('Emitting message:', event)
        socketRef.current.emit(event, data)
        resolve()
      } catch (error) {
        console.error('Error sending message:', error)
        messageQueue.push({ event, data })
        resolve()
      }
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
      if (socketRef.current) {
        console.log('Cleaning up socket connection')
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  return (
    <SocketContext.Provider
      value={{ socket: socketRef.current, isConnected, connect, sendMessage }}
    >
      {children}
    </SocketContext.Provider>
  )
}

// Custom hook to use the socket context
export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
