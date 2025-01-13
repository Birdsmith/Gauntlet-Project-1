const { createServer } = require('http')
const { Server } = require('socket.io')
const { PrismaClient } = require('@prisma/client')
const path = require('path')
const fs = require('fs')

// Load environment variables based on NODE_ENV
const NODE_ENV = process.env.NODE_ENV || 'development'
const envFile = NODE_ENV === 'production' ? '.env.production' : '.env.development'
const envPath = path.resolve(process.cwd(), envFile)

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath })
} else {
  console.error(`Environment file ${envFile} not found!`)
  process.exit(1)
}

const port = process.env.SOCKET_PORT || 3001
const clientUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const prisma = new PrismaClient()

const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
  'http://clash.rileybird.com',
  'https://clash.rileybird.com',
  'http://35.155.123.176'
].filter(Boolean)

// Create a basic HTTP server
const httpServer = createServer((req, res) => {
  const origin = req.headers.origin
  // Basic CORS headers for HTTP endpoints if needed
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // Default response for any HTTP requests
  res.writeHead(200)
  res.end('Socket.IO server')
})

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
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
io.on('connection', async socket => {
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
  socket.on('join_channel', channelId => {
    console.log(`User ${socket.data.userId} joining channel:`, channelId)
    socket.join(`channel:${channelId}`)
  })

  // Handle joining threads
  socket.on('join-thread', threadId => {
    console.log(`User ${socket.data.userId} joining thread:`, threadId)
    socket.join(`thread:${threadId}`)
  })

  socket.on('leave-thread', threadId => {
    console.log(`User ${socket.data.userId} leaving thread:`, threadId)
    socket.leave(`thread:${threadId}`)
  })

  // Handle thread replies
  socket.on('thread-reply', async data => {
    try {
      // First emit the reply to all clients immediately
      if (data.channelId) {
        io.to(`channel:${data.channelId}`).emit('thread-reply', data)
        io.to(`thread:${data.replyToId}`).emit('thread-reply', data)
      } else if (data.conversationId) {
        io.to(`conversation:${data.conversationId}`).emit('thread-reply', data)
        io.to(`thread:${data.replyToId}`).emit('thread-reply', data)
      }

      // Then try to update reply counts
      try {
        let replyCount = 0;
        if (data.channelId) {
          replyCount = await prisma.message.count({
            where: { replyToId: data.replyToId }
          });
        } else if (data.conversationId) {
          replyCount = await prisma.directMessage.count({
            where: { replyToId: data.replyToId }
          });
        }

        // Emit reply count update
        const updateData = {
          messageId: data.replyToId,
          replyCount,
          ...(data.channelId ? { channelId: data.channelId } : { conversationId: data.conversationId })
        };

        if (data.channelId) {
          io.to(`channel:${data.channelId}`).emit('thread-reply-count-update', updateData);
        } else if (data.conversationId) {
          io.to(`conversation:${data.conversationId}`).emit('thread-reply-count-update', updateData);
        }
        io.to(`thread:${data.replyToId}`).emit('thread-reply-count-update', updateData);
      } catch (error) {
        console.error('Error updating reply count:', error);
        // Send a fallback reply count update based on the data we have
        const fallbackUpdate = {
          messageId: data.replyToId,
          replyCount: 1, // Increment by 1 since we know we just added a reply
          ...(data.channelId ? { channelId: data.channelId } : { conversationId: data.conversationId })
        };
        
        if (data.channelId) {
          io.to(`channel:${data.channelId}`).emit('thread-reply-count-update', fallbackUpdate);
        } else if (data.conversationId) {
          io.to(`conversation:${data.conversationId}`).emit('thread-reply-count-update', fallbackUpdate);
        }
        io.to(`thread:${data.replyToId}`).emit('thread-reply-count-update', fallbackUpdate);
      }
    } catch (error) {
      console.error('Error handling thread reply:', error);
    }
  });

  // Handle channel creation
  socket.on('channel-created', channel => {
    console.log('Channel created:', channel)
    io.emit('channel-created', channel)
  })

  // Handle new messages
  socket.on('new_message', async message => {
    console.log('Received new message:', message)
    io.to(`channel:${message.channelId}`).emit('message_received', message)
  })

  // Handle direct messages
  socket.on('new_direct_message', async message => {
    console.log('Received new direct message:', message)
    socket.to(`conversation:${message.conversationId}`).emit('direct_message_received', message)
  })

  // Handle joining conversations
  socket.on('join_conversation', conversationId => {
    console.log(`User ${socket.data.userId} joining conversation:`, conversationId)
    socket.join(`conversation:${conversationId}`)
  })

  // Handle new reactions
  socket.on('new_reaction', async data => {
    console.log('Received new reaction:', data)
    if (data.channelId) {
      socket.to(`channel:${data.channelId}`).emit('reaction_received', data)
    } else if (data.conversationId) {
      socket.to(`conversation:${data.conversationId}`).emit('reaction_received', data)
    }
  })

  // Handle reaction removals
  socket.on('reaction_removed', async data => {
    console.log('Received reaction removal:', data)
    if (data.channelId) {
      socket.to(`channel:${data.channelId}`).emit('reaction_removed', data)
    } else if (data.conversationId) {
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

// Start the server
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Socket.IO server running on port ${port}`)
  console.log(`Accepting connections from: ${clientUrl}`)
})
