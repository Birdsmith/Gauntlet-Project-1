import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { emoji, messageId, channelId, conversationId } = await req.json()
    if (!emoji || !messageId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if message exists and create reaction accordingly
    if (channelId) {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      })
      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 })
      }

      const reaction = await prisma.reaction.create({
        data: {
          emoji,
          userId: session.user.id,
          messageId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      })
      return NextResponse.json(reaction)
    } else if (conversationId) {
      const message = await prisma.directMessage.findUnique({
        where: { id: messageId },
      })
      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 })
      }

      const reaction = await prisma.reaction.create({
        data: {
          emoji,
          userId: session.user.id,
          directMessageId: messageId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      })
      return NextResponse.json(reaction)
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('Error creating reaction:', error)
    return NextResponse.json(
      { error: 'Failed to create reaction' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const reactionId = searchParams.get('reactionId')
    
    if (!reactionId) {
      return NextResponse.json({ error: 'Reaction ID is required' }, { status: 400 })
    }

    await prisma.reaction.delete({
      where: {
        id: reactionId,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting reaction:', error)
    return NextResponse.json(
      { error: 'Failed to delete reaction' },
      { status: 500 }
    )
  }
} 