import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { uploadToS3, getS3Url } from '@/lib/s3-operations'

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const content = formData.get('content') as string
    const channelId = formData.get('channelId') as string | null
    const conversationId = formData.get('conversationId') as string | null
    const files = formData.getAll('files') as File[]

    if (!content?.trim() && files.length === 0) {
      return NextResponse.json({ error: 'Message content or file is required' }, { status: 400 })
    }

    if (!channelId && !conversationId) {
      return NextResponse.json(
        { error: 'Either channelId or conversationId is required' },
        { status: 400 }
      )
    }

    let fileDataArray: { name: string; size: number; type: string; url: string }[] = []

    // Handle file uploads
    if (files.length > 0) {
      for (const file of files) {
        // Validate file type
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
          return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 })
        }

        try {
          // Generate unique filename
          const timestamp = Date.now()
          const filename = `${session.user.id}-${timestamp}-${file.name}`
          const key = `uploads/${session.user.id}/${filename}`

          // Convert file to buffer and upload to S3
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          await uploadToS3(buffer, key, true)

          // Get the S3 URL
          const url = getS3Url(key)

          fileDataArray.push({
            name: file.name,
            size: file.size,
            type: file.type,
            url,
          })
        } catch (error) {
          console.error('Error handling file upload:', error)
          return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
        }
      }
    }

    // Create message based on type (channel or direct)
    if (channelId) {
      const message = await prisma.message.create({
        data: {
          content: content?.trim() || '',
          channelId,
          userId: session.user.id,
          files: {
            create: fileDataArray,
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
          files: true,
          reactions: true,
        },
      })
      return NextResponse.json(message)
    } else {
      const message = await prisma.directMessage.create({
        data: {
          content: content?.trim() || '',
          conversationId: conversationId!,
          userId: session.user.id,
          files: {
            create: fileDataArray,
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
          files: true,
          reactions: true,
        },
      })
      return NextResponse.json(message)
    }
  } catch (error) {
    console.error('Error creating message:', error)
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
    }

    const messages = await prisma.message.findMany({
      where: {
        channelId,
        replyToId: null, // Only fetch top-level messages, not replies
      },
      orderBy: { createdAt: 'asc' },
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
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}
