const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { PrismaClient } = require('@prisma/client')
const { getToken } = require('next-auth/jwt')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()
const prisma = new PrismaClient()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:3000', process.env.NEXTAUTH_URL].filter(Boolean),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  })

  // Store the Socket.IO instance globally for access from API routes
  global.socketIo = io

  // Debug middleware for all socket events
  io.engine.on("connection_error", (err) => {
    console.error('Socket.IO connection error:', {
      code: err.code,
      message: err.message,
      context: err.context,
    })
  })

  io.use(async (socket, next) => {
    try {
      console.log('Socket middleware - connection attempt:', socket.id)
      
      // Get the token from the auth cookie
      const token = socket.handshake.headers.cookie
        ?.split(';')
        .find((c) => c.trim().startsWith('next-auth.session-token='))
        ?.split('=')[1]

      if (!token) {
        console.log('No token found, rejecting socket:', socket.id)
        return next(new Error('Authentication required'))
      }

      // Verify the token and get the user
      const decoded = await getToken({
        req: { cookies: { 'next-auth.session-token': token } },
        secret: process.env.NEXTAUTH_SECRET,
      })

      if (!decoded?.sub) {
        console.log('Invalid token, rejecting socket:', socket.id)
        return next(new Error('Invalid authentication'))
      }

      // Store user ID in socket data
      socket.data.userId = decoded.sub
      next()
    } catch (error) {
      console.error('Socket middleware error:', error)
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', async (socket) => {
    console.log('New socket connection:', socket.id, 'User:', socket.data.userId)
    
    try {
      // Update user status to online
      await prisma.user.update({
        where: { id: socket.data.userId },
        data: { isOnline: true },
      })
      io.emit('userStatus', { userId: socket.data.userId, isOnline: true })

      // Handle joining channels
      socket.on('join-channel', (channelId) => {
        const room = `channel:${channelId}`
        // Leave all other channel rooms first
        Array.from(socket.rooms)
          .filter(r => r !== socket.id && r.startsWith('channel:'))
          .forEach(r => socket.leave(r))
        
        socket.join(room)
        console.log(`User ${socket.data.userId} joined channel ${channelId}`)
      })

      // Handle joining conversations (direct messages)
      socket.on('join-conversation', (conversationId) => {
        const room = `conversation:${conversationId}`
        // Leave all other conversation rooms first
        Array.from(socket.rooms)
          .filter(r => r !== socket.id && r.startsWith('conversation:'))
          .forEach(r => socket.leave(r))
        
        socket.join(room)
        console.log(`User ${socket.data.userId} joined conversation ${conversationId}`)
      })

      // Handle leaving channels
      socket.on('leave-channel', (channelId) => {
        const room = `channel:${channelId}`
        socket.leave(room)
        console.log(`User ${socket.data.userId} left channel ${channelId}`)
      })

      // Handle leaving conversations
      socket.on('leave-conversation', (conversationId) => {
        const room = `conversation:${conversationId}`
        socket.leave(room)
        console.log(`User ${socket.data.userId} left conversation ${conversationId}`)
      })

      // Handle new messages
      socket.on('send-message', async (message) => {
        const room = `channel:${message.channelId}`
        console.log(`Broadcasting message to ${room}`, message)
        
        try {
          // Broadcast to all clients in the channel (including sender for consistency)
          io.to(room).emit('new-message', message)
          console.log('Message broadcasted successfully to room:', room)
        } catch (error) {
          console.error('Error broadcasting message:', error)
          socket.emit('message-error', { error: 'Failed to broadcast message' })
        }
      })

      // Handle new direct messages
      socket.on('direct-message', async (message) => {
        const room = `conversation:${message.conversationId}`
        console.log(`Broadcasting direct message to ${room}`, message)
        
        try {
          // Broadcast to all clients in the conversation
          io.to(room).emit('direct-message', message)
          console.log('Direct message broadcasted successfully to room:', room)
        } catch (error) {
          console.error('Error broadcasting direct message:', error)
          socket.emit('message-error', { error: 'Failed to broadcast direct message' })
        }
      })

      // Handle channel creation
      socket.on('channel-created', (channel) => {
        console.log(`Channel ${channel.id} was created, broadcasting to all users`)
        io.emit('channel-created', channel)
      })

      // Handle channel deletion
      socket.on('channel-deleted', (channelId) => {
        console.log(`Channel ${channelId} was deleted, broadcasting to all users`)
        io.emit('channel-deleted', channelId)
      })

      // Handle new conversation
      socket.on('conversation-created', (conversation) => {
        console.log(`Conversation ${conversation.id} was created, notifying participants`)
        // Notify both participants
        const room1 = `user:${conversation.user1Id}`
        const room2 = `user:${conversation.user2Id}`
        io.to(room1).to(room2).emit('conversation-created', conversation)
      })

      // Handle disconnect
      socket.on('disconnect', async (reason) => {
        console.log(`User ${socket.data.userId} disconnected:`, reason)
        try {
          await prisma.user.update({
            where: { id: socket.data.userId },
            data: { isOnline: false },
          })
          io.emit('userStatus', { userId: socket.data.userId, isOnline: false })
        } catch (error) {
          console.error('Failed to update user status on disconnect:', error)
        }
      })

      socket.on('profile-update', (updatedUser) => {
        // Broadcast the profile update to all connected clients
        io.emit('profile-update', updatedUser)
      })
    } catch (error) {
      console.error('Socket connection error:', error)
      socket.disconnect(true)
    }
  })

  server.listen(3001, (err) => {
    if (err) throw err
    console.log('> Ready on http://localhost:3001')
    console.log('> Socket.IO server initialized')
  })
}) 