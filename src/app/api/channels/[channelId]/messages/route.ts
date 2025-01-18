import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Message, User, Reaction, File } from '@prisma/client'

type MessageWithRelations = Message & {
  user: Pick<User, 'id' | 'name' | 'image'>;
  reactions: (Reaction & {
    user: Pick<User, 'id' | 'name' | 'image'>;
  })[];
  files: File[];
  replies: { id: string }[];
}

export async function GET(req: Request, { params }: { params: { channelId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const messages = await prisma.message.findMany({
      where: {
        channelId: params.channelId,
        replyToId: null, // Only fetch top-level messages
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        files: true,
        replies: {
          select: {
            id: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Transform messages to include reply count
    const transformedMessages = messages.map((message: MessageWithRelations) => ({
      ...message,
      replyCount: message.replies.length,
      replies: undefined, // Remove the replies array from the response
    }))

    return NextResponse.json(transformedMessages)
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { channelId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { content, file } = await req.json()

    // Validate input
    if (!content && !file) {
      return NextResponse.json({ error: 'Message content or file is required' }, { status: 400 })
    }

    // Check if channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: params.channelId },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Create message with optional file
    const message = await prisma.message.create({
      data: {
        content: content || '',
        userId: session.user.id,
        channelId: params.channelId,
        ...(file && {
          files: {
            create: {
              name: file.name,
              url: file.url,
              size: file.size,
              type: file.type,
            },
          },
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        files: true,
        reactions: true,
      },
    })

    return NextResponse.json(message)
  } catch (error) {
    console.error('Error creating message:', error)
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
  }
}
