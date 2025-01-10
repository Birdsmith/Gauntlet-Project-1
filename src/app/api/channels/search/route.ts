import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
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

    // Get all channels the user has access to
    const userChannels = await prisma.channel.findMany({
      where: {
        OR: [
          { isPrivate: false },
          { createdById: session.user.id }
        ]
      },
      select: {
        id: true
      }
    })

    const channelIds = userChannels.map(channel => channel.id)

    // Get messages that match the search query from all accessible channels
    const messages = await prisma.message.findMany({
      where: {
        channelId: {
          in: channelIds
        },
        content: {
          contains: query,
          mode: 'insensitive', // Case-insensitive search
        },
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
          },
        },
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
    console.error('Error searching all channel messages:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 