import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import path from 'path'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'

export async function GET(
  request: Request,
  { params }: { params: { messageId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { messageId } = params

    // Handle channel message replies
    const channelMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        channel: true
      }
    })

    if (!channelMessage) {
      return new NextResponse('Message not found', { status: 404 })
    }

    // Check access permissions for channel messages
    const isMember = await prisma.channel.findFirst({
      where: {
        id: channelMessage.channelId,
        OR: [
          { isPrivate: false },
          {
            createdById: session.user.id
          }
        ]
      }
    })

    if (!isMember) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Fetch replies for channel message
    const replies = await prisma.message.findMany({
      where: {
        replyToId: messageId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        files: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json(replies)
  } catch (error) {
    console.error('[MESSAGES_REPLIES_GET]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { messageId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { messageId } = params
    let content = ''
    let file = null

    // Handle both FormData and JSON requests
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      content = formData.get('content') as string || ''
      file = formData.get('file') as File
    } else {
      const json = await request.json()
      content = json.content
    }

    if (!content?.trim() && !file) {
      return new NextResponse('Content or file is required', { status: 400 })
    }

    // Find the parent message to get the channel ID
    const parentMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        channel: true
      }
    })

    if (!parentMessage) {
      return new NextResponse('Parent message not found', { status: 404 })
    }

    // Check access permissions for channel messages
    const isMember = await prisma.channel.findFirst({
      where: {
        id: parentMessage.channelId,
        OR: [
          { isPrivate: false },
          {
            createdById: session.user.id
          }
        ]
      }
    })

    if (!isMember) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Create the reply first
    const reply = await prisma.message.create({
      data: {
        content: content.trim(),
        channelId: parentMessage.channelId,
        userId: session.user.id,
        replyToId: messageId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        files: true
      }
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
            messageId: reply.id
          }
        })

        // Fetch updated reply with file
        const updatedReply = await prisma.message.findUnique({
          where: { id: reply.id },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true
              }
            },
            files: true
          }
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
    console.error('[MESSAGES_REPLIES_POST]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
} 