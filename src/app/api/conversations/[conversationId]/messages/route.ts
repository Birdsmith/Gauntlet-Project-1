import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

export async function GET(
  req: Request,
  { params }: { params: { conversationId: string } }
) {
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
        replyToId: null
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
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: params.conversationId,
      },
      include: {
        participants: true,
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.userId === session.user.id
    )

    if (!isParticipant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let content = ''
    let fileData = null

    // Handle both FormData and JSON requests
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      content = formData.get('content') as string || ''
      const file = formData.get('file') as File
      if (file) {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Ensure uploads directory exists
        const uploadDir = path.join(process.cwd(), 'public', 'uploads')
        if (!existsSync(uploadDir)) {
          await mkdir(uploadDir, { recursive: true })
        }
        
        // Generate unique filename
        const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}${path.extname(file.name)}`
        const filePath = path.join(uploadDir, uniqueFilename)
        
        // Save file
        await writeFile(filePath, buffer)
        
        fileData = {
          name: file.name,
          url: `/uploads/${uniqueFilename}`,
          size: buffer.length,
          type: file.type,
        }
      }
    } else {
      const json = await req.json()
      content = json.content || ''
      fileData = json.file
    }

    if (!content && !fileData) {
      return NextResponse.json({ error: 'Message content or file is required' }, { status: 400 })
    }

    // Create the message with optional file
    const message = await prisma.directMessage.create({
      data: {
        content,
        conversationId: params.conversationId,
        userId: session.user.id,
        ...(fileData && {
          files: {
            create: {
              name: fileData.name,
              url: fileData.url,
              size: fileData.size,
              type: fileData.type,
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
      },
    })

    return NextResponse.json(message)
  } catch (error) {
    console.error('Message creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    )
  }
} 