"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("./middleware/auth");
// Load environment variables
dotenv_1.default.config();
// Configuration
const port = process.env.SOCKET_PORT || 3001;
const clientUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const prisma = new client_1.PrismaClient();
// Create HTTP server with CORS support
const httpServer = (0, http_1.createServer)((req, res) => {
    // Basic CORS headers for HTTP endpoints if needed
    res.setHeader('Access-Control-Allow-Origin', clientUrl);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    // Default response for any HTTP requests
    res.writeHead(200);
    res.end('Socket.IO server');
});
// Initialize Socket.IO with proper configuration
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: clientUrl,
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['cookie', 'Cookie', 'authorization', 'Authorization', 'content-type'],
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
});
// Apply authentication middleware
io.use(auth_1.authMiddleware);
// Handle socket connections
io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id, 'User:', socket.data.user.name);
    try {
        // User is already set to online in auth middleware
        io.emit('user-status', { userId: socket.data.user.id, isOnline: true });
    }
    catch (error) {
        console.error('Error handling connection:', error);
    }
    // Handle joining channels
    socket.on('join_channel', (payload) => {
        console.log(`User ${socket.data.user.name} joining channel:`, payload.channelId);
        socket.join(`channel:${payload.channelId}`);
    });
    // Handle channel messages
    socket.on('channel_message', (message) => {
        console.log('Received new channel message:', message);
        io.to(`channel:${message.channelId}`).emit('message_received', {
            ...message,
            user: socket.data.user
        });
    });
    // Handle joining conversations
    socket.on('join_conversation', (payload) => {
        console.log(`User ${socket.data.user.name} joining conversation:`, payload.conversationId);
        socket.join(`conversation:${payload.conversationId}`);
    });
    // Handle direct messages
    socket.on('direct_message', (message) => {
        console.log('Received new direct message:', message);
        socket.to(`conversation:${message.conversationId}`).emit('direct_message_received', {
            ...message,
            user: socket.data.user
        });
    });
    // Handle thread interactions
    socket.on('join_thread', (payload) => {
        console.log(`User ${socket.data.user.name} joining thread:`, payload.threadId);
        socket.join(`thread:${payload.threadId}`);
    });
    socket.on('leave_thread', (payload) => {
        console.log(`User ${socket.data.user.name} leaving thread:`, payload.threadId);
        socket.leave(`thread:${payload.threadId}`);
    });
    socket.on('thread_message', (data) => {
        console.log('Received thread message:', data);
        socket.to(`thread:${data.threadId}`).emit('thread-message', {
            ...data,
            user: socket.data.user
        });
        const replyCountUpdate = {
            messageId: data.threadId,
            replyCount: 1,
        };
        if (data.channelId) {
            socket.to(`channel:${data.channelId}`).emit('thread-reply-count-update', {
                ...replyCountUpdate,
                channelId: data.channelId,
            });
        }
        else if (data.conversationId) {
            socket.to(`conversation:${data.conversationId}`).emit('thread-reply-count-update', {
                ...replyCountUpdate,
                conversationId: data.conversationId,
            });
        }
    });
    // Handle reactions
    socket.on('add_reaction', (data) => {
        console.log('Received new reaction:', data);
        if (data.channelId) {
            socket.to(`channel:${data.channelId}`).emit('reaction_received', {
                ...data,
                user: socket.data.user
            });
        }
        else if (data.conversationId) {
            socket.to(`conversation:${data.conversationId}`).emit('reaction_received', {
                ...data,
                user: socket.data.user
            });
        }
    });
    socket.on('remove_reaction', (data) => {
        console.log('Received reaction removal:', data);
        if (data.channelId) {
            socket.to(`channel:${data.channelId}`).emit('reaction_removed', data);
        }
        else if (data.conversationId) {
            socket.to(`conversation:${data.conversationId}`).emit('reaction_removed', data);
        }
    });
    // Handle disconnect
    socket.on('disconnect', () => (0, auth_1.handleDisconnect)(socket));
});
// Start the server
httpServer.listen(port, () => {
    console.log(`Socket.IO server running on port ${port}`);
    console.log(`Accepting connections from: ${clientUrl}`);
});
