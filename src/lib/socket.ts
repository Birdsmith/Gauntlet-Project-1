import { Server as NetServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { NextApiResponse } from 'next'

export type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: SocketIOServer
    }
  }
}

export interface Message {
  id: string
  content: string
  userId: string
  userName: string
  channelId: string
  createdAt: string
}

export const config = {
  api: {
    bodyParser: false,
  },
} 