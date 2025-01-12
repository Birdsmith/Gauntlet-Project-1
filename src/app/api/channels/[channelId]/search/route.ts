import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { channelId: string } }) {
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

    // Verify user has access to this channel
    const channel = await prisma.channel.findFirst({
      where: {
        id: params.channelId,
        OR: [{ isPrivate: false }, { createdById: session.user.id }],
      },
    })

    if (!channel) {
      return new NextResponse('Channel not found', { status: 404 })
    }

    // Get messages that match the search query
    const messages = await prisma.message.findMany({
      where: {
        channelId: params.channelId,
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
    console.error('Error searching channel messages:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
