import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(
  req: Request,
  { params }: { params: { conversationId: string; messageId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { emoji } = await req.json()
    if (!emoji) {
      return NextResponse.json({ error: 'Emoji is required' }, { status: 400 })
    }

    const message = await prisma.directMessage.findUnique({
      where: { id: params.messageId },
      include: { conversation: true },
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    if (message.conversationId !== params.conversationId) {
      return NextResponse.json(
        { error: 'Message does not belong to this conversation' },
        { status: 400 }
      )
    }

    // Create the reaction with directMessageId instead of messageId
    const reaction = await prisma.reaction.create({
      data: {
        emoji,
        userId: session.user.id,
        directMessageId: params.messageId, // Changed from messageId to directMessageId
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
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'You have already reacted with this emoji' },
        { status: 400 }
      )
    }
    console.error('Error adding reaction:', error)
    return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { conversationId: string; messageId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const emoji = searchParams.get('emoji')

    if (!emoji) {
      return NextResponse.json({ error: 'Emoji is required' }, { status: 400 })
    }

    const message = await prisma.directMessage.findUnique({
      where: { id: params.messageId },
      include: { conversation: true },
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    if (message.conversationId !== params.conversationId) {
      return NextResponse.json(
        { error: 'Message does not belong to this conversation' },
        { status: 400 }
      )
    }

    // Delete the reaction using directMessageId instead of messageId
    await prisma.reaction.deleteMany({
      where: {
        directMessageId: params.messageId, // Changed from messageId to directMessageId
        userId: session.user.id,
        emoji: emoji,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing reaction:', error)
    return NextResponse.json({ error: 'Failed to remove reaction' }, { status: 500 })
  }
}
