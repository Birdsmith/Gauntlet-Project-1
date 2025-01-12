import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import path from 'path'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'

export async function GET(
  request: Request,
  { params }: { params: { conversationId: string; messageId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId, messageId } = params

    // Check if user is a participant in the conversation
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        userId_conversationId: {
          userId: session.user.id,
          conversationId,
        },
      },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch replies for direct message
    const replies = await prisma.directMessage.findMany({
      where: {
        replyToId: messageId,
        conversationId,
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

    return NextResponse.json(replies)
  } catch (error) {
    console.error('[DIRECT_MESSAGES_REPLIES_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch replies' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { conversationId: string; messageId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId, messageId } = params
    let content = ''
    let file = null

    // Handle both FormData and JSON requests
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      content = (formData.get('content') as string) || ''
      file = formData.get('file') as File
    } else {
      const json = await request.json()
      content = json.content
    }

    if (!content?.trim() && !file) {
      return NextResponse.json({ error: 'Content or file is required' }, { status: 400 })
    }

    // Check if user is a participant in the conversation
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        userId_conversationId: {
          userId: session.user.id,
          conversationId,
        },
      },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Create the reply first
    const reply = await prisma.directMessage.create({
      data: {
        content: content.trim(),
        conversationId,
        userId: session.user.id,
        replyToId: messageId,
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
          await mkdir(uploadDir)
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
            directMessageId: reply.id,
          },
        })

        // Fetch updated reply with file
        const updatedReply = await prisma.directMessage.findUnique({
          where: { id: reply.id },
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

        return NextResponse.json(updatedReply)
      } catch (error) {
        console.error('File upload error:', error)
        // Still return the reply even if file upload fails
        return NextResponse.json(reply)
      }
    }

    return NextResponse.json(reply)
  } catch (error) {
    console.error('[DIRECT_MESSAGES_REPLIES_POST]', error)
    return NextResponse.json({ error: 'Failed to create reply' }, { status: 500 })
  }
}
