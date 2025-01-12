import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

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

    // Fetch conversation with participants
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                isOnline: true,
              },
            },
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Transform the data to match the expected format
    const transformedConversation = {
      id: conversation.id,
      participants: conversation.participants.map(p => ({
        id: p.user.id,
        name: p.user.name,
        image: p.user.image,
        isOnline: p.user.isOnline,
      })),
    }

    return NextResponse.json(transformedConversation)
  } catch (error) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 })
  }
}
