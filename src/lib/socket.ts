import { Server as SocketServer } from 'socket.io'
import { Server as HTTPServer } from 'http'

// Get the Socket.IO server instance
let io: SocketServer | null = null

// This function will be called once to initialize the Socket.IO instance
export function initSocketIO(httpServer: HTTPServer) {
  if (!io) {
    io = new SocketServer(httpServer, {
      pingTimeout: 60000,
      cors: {
        origin: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
    })
  }
  return io
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.IO has not been initialized')
  }
  return io
}
