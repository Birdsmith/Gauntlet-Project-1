const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { PrismaClient } = require('@prisma/client')
const { getToken } = require('next-auth/jwt')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3001
const nextApp = next({ dev, hostname, port })
const handle = nextApp.getRequestHandler()
const prisma = new PrismaClient()

nextApp.prepare().then(() => {
  const server = createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie')
    res.setHeader('Access-Control-Allow-Credentials', 'true')

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    return handle(req, res)
  })

  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['cookie', 'Cookie', 'authorization', 'Authorization', 'content-type'],
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  })

  // Socket.IO middleware for authentication
  io.use(async (socket, next) => {
    try {
      console.log('Socket middleware - connection attempt:', socket.id)
      const userId = socket.handshake.auth.userId
      
      if (!userId) {
        console.log('No userId found in auth')
        return next(new Error('Authentication required'))
      }

      // Store user ID in socket data
      socket.data.userId = userId
      console.log('Socket authenticated for user:', userId)
      next()
    } catch (error) {
      console.error('Socket middleware error:', error)
      next(new Error('Authentication failed'))
    }
  })

  // Handle socket events
  io.on('connection', async (socket) => {
    console.log('New socket connection:', socket.id, 'User:', socket.data.userId)

    try {
      // Update user status to online
      await prisma.user.update({
        where: { id: socket.data.userId },
        data: { isOnline: true },
      })
      io.emit('user-status', { userId: socket.data.userId, isOnline: true })
    } catch (error) {
      console.error('Error updating user status:', error)
    }

    // Handle joining channels
    socket.on('join_channel', (channelId) => {
      console.log(`User ${socket.data.userId} joining channel:`, channelId)
      socket.join(`channel:${channelId}`)
    })

    // Handle new messages
    socket.on('new_message', async (message) => {
      console.log('Received new message:', message)
      // Broadcast to all users in the channel
      io.to(`channel:${message.channelId}`).emit('message_received', message)
    })

    // Handle direct messages
    socket.on('new_direct_message', async (message) => {
      console.log('Received new direct message:', message)
      // Broadcast to all users in the conversation
      socket.to(`conversation:${message.conversationId}`).emit('direct_message_received', message)
    })

    // Handle joining conversations
    socket.on('join_conversation', (conversationId) => {
      console.log(`User ${socket.data.userId} joining conversation:`, conversationId)
      socket.join(`conversation:${conversationId}`)
    })

    // Handle new reactions
    socket.on('new_reaction', async (data) => {
      console.log('Received new reaction:', data)
      if (data.channelId) {
        // Broadcast to channel
        socket.to(`channel:${data.channelId}`).emit('reaction_received', data)
      } else if (data.conversationId) {
        // Broadcast to conversation
        socket.to(`conversation:${data.conversationId}`).emit('reaction_received', data)
      }
    })

    // Handle reaction removals
    socket.on('reaction_removed', async (data) => {
      console.log('Received reaction removal:', data)
      if (data.channelId) {
        // Broadcast to channel
        socket.to(`channel:${data.channelId}`).emit('reaction_removed', data)
      } else if (data.conversationId) {
        // Broadcast to conversation
        socket.to(`conversation:${data.conversationId}`).emit('reaction_removed', data)
      }
    })

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log('Socket disconnected:', socket.id)
      try {
        await prisma.user.update({
          where: { id: socket.data.userId },
          data: { isOnline: false },
        })
        io.emit('user-status', { userId: socket.data.userId, isOnline: false })
      } catch (error) {
        console.error('Error updating user status on disconnect:', error)
      }
    })
  })

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
}) 