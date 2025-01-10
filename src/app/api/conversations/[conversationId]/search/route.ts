import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')

    if (!query) {
      return new NextResponse('Query parameter is required', { status: 400 })
    }

    // Verify user has access to this conversation
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: params.conversationId,
        userId: session.user.id
      }
    })

    if (!participant) {
      return new NextResponse('Conversation not found', { status: 404 })
    }

    // Get messages that match the search query
    const messages = await prisma.directMessage.findMany({
      where: {
        conversationId: params.conversationId,
        content: {
          contains: query,
          mode: 'insensitive', // Case-insensitive search
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
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
        files: true,
      },
      orderBy: {
        createdAt: 'desc', // Most recent first
      },
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('Error searching direct messages:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 