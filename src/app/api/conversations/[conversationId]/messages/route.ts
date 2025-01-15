import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

export async function GET(req: Request, { params }: { params: { conversationId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a participant in the conversation
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        userId_conversationId: {
          userId: session.user.id,
          conversationId: params.conversationId,
        },
      },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const messages = await prisma.directMessage.findMany({
      where: {
        conversationId: params.conversationId,
        replyToId: null,
      },
      orderBy: {
        createdAt: 'asc',
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
    })

    // Transform messages to include reply count
    const transformedMessages = messages.map(message => ({
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

export async function POST(
  req: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { content, file, isAvatarMessage, avatarName } = body;

    if (!content && !file) {
      return new NextResponse("Missing content", { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    // For avatar messages, we'll use the recipient's ID
    let messageUserId = user.id;
    if (isAvatarMessage) {
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId: params.conversationId },
        select: { userId: true },
      });
      // Find the other user's ID (not the sender)
      messageUserId = participants.find(p => p.userId !== user.id)?.userId || user.id;
    }

    // Create the message
    const message = await prisma.directMessage.create({
      data: {
        content,
        conversationId: params.conversationId,
        userId: messageUserId,
        files: file ? {
          create: {
            name: file.name,
            url: file.url,
            size: file.size,
            type: file.type,
          }
        } : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          }
        },
        files: true,
      }
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: params.conversationId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ ...message, isAvatarMessage, avatarName });
  } catch (error) {
    console.error('[MESSAGES_POST]', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
