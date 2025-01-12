"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDisconnect = exports.authMiddleware = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const authMiddleware = async (socket, next) => {
    try {
        console.log('Socket middleware - connection attempt:', socket.id);
        const userId = socket.handshake.auth.userId;
        if (!userId) {
            console.log('No userId found in auth');
            const error = {
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
            };
            return next(new Error(JSON.stringify(error)));
        }
        // Fetch user from database
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                image: true
            }
        });
        if (!user) {
            console.log('User not found:', userId);
            const error = {
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            };
            return next(new Error(JSON.stringify(error)));
        }
        // Attach user to socket.data
        socket.data.user = {
            ...user,
            isOnline: true
        };
        // Update user's online status
        await prisma.user.update({
            where: { id: userId },
            data: { isOnline: true }
        });
        console.log('Socket authenticated for user:', user.name);
        next();
    }
    catch (error) {
        console.error('Socket middleware error:', error);
        const socketError = {
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        };
        next(new Error(JSON.stringify(socketError)));
    }
};
exports.authMiddleware = authMiddleware;
// Cleanup function for when socket disconnects
const handleDisconnect = async (socket) => {
    try {
        const userId = socket.data.user?.id;
        if (userId) {
            await prisma.user.update({
                where: { id: userId },
                data: { isOnline: false }
            });
            console.log('User offline:', socket.data.user.name);
        }
    }
    catch (error) {
        console.error('Error handling disconnect:', error);
    }
};
exports.handleDisconnect = handleDisconnect;
