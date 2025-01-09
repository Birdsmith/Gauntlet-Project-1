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
      orderBy: {
        createdAt: 'asc',
      },
    })

    return NextResponse.json(messages)
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
    let file = null

    // Handle both FormData and JSON requests
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      content = formData.get('content') as string || ''
      file = formData.get('file') as File
    } else {
      const json = await req.json()
      content = json.content
    }

    if (!content && !file) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    // Create the message first
    const message = await prisma.directMessage.create({
      data: {
        content,
        conversationId: params.conversationId,
        userId: session.user.id,
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

    // Handle file upload if present
    if (file) {
      try {
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
        
        // Create file record in database
        await prisma.file.create({
          data: {
            name: file.name,
            url: `/uploads/${uniqueFilename}`,
            size: buffer.length,
            type: file.type,
            directMessageId: message.id,
          },
        })

        // Fetch updated message with file
        const updatedMessage = await prisma.directMessage.findUnique({
          where: { id: message.id },
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

        return NextResponse.json(updatedMessage)
      } catch (error) {
        console.error('File upload error:', error)
        // Still return the message even if file upload fails
        return NextResponse.json(message)
      }
    }

    return NextResponse.json(message)
  } catch (error) {
    console.error('Message creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    )
  }
} 