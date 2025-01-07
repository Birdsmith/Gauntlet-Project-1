import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { unlink } from 'fs/promises'
import path from 'path'

export async function GET(
  req: Request,
  { params }: { params: { channelId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channel = await prisma.channel.findUnique({
      where: {
        id: params.channelId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    return NextResponse.json(channel)
  } catch (error) {
    console.error('Error fetching channel:', error)
    return NextResponse.json(
      { error: 'Failed to fetch channel' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { channelId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description } = await req.json()

    // Validate input
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Channel name is required' },
        { status: 400 }
      )
    }

    // Check if channel exists
    const existingChannel = await prisma.channel.findUnique({
      where: { id: params.channelId },
    })

    if (!existingChannel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      )
    }

    // Update channel
    const updatedChannel = await prisma.channel.update({
      where: { id: params.channelId },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(updatedChannel)
  } catch (error) {
    console.error('Error updating channel:', error)
    return NextResponse.json(
      { error: 'Failed to update channel' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { channelId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if channel exists and get all associated files
    const channel = await prisma.channel.findUnique({
      where: { id: params.channelId },
      include: {
        messages: {
          include: {
            files: true
          }
        }
      }
    })

    if (!channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      )
    }

    // Collect all file paths that need to be deleted
    const filePaths = channel.messages
      .flatMap(message => message.files)
      .map(file => {
        const filename = file.url.split('/').pop()
        return path.join(process.cwd(), 'public', 'uploads', filename!)
      })

    // Start a transaction to ensure all database deletions succeed or none do
    await prisma.$transaction(async (tx) => {
      // 1. Delete all reactions in messages of this channel
      await tx.reaction.deleteMany({
        where: {
          message: {
            channelId: params.channelId
          }
        }
      })

      // 2. Delete all files associated with messages in this channel
      await tx.file.deleteMany({
        where: {
          message: {
            channelId: params.channelId
          }
        }
      })

      // 3. Delete all messages in the channel
      await tx.message.deleteMany({
        where: { channelId: params.channelId }
      })

      // 4. Delete the channel itself
      await tx.channel.delete({
        where: { id: params.channelId }
      })
    })

    // After successful database deletion, delete the physical files
    await Promise.allSettled(
      filePaths.map(filePath => 
        unlink(filePath).catch(err => 
          console.error(`Failed to delete file ${filePath}:`, err)
        )
      )
    )

    // Emit channel deletion event through Socket.IO
    const globalSocket = (global as any).socketIo
    if (globalSocket) {
      globalSocket.emit('channel-deleted', params.channelId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting channel:', error)
    return NextResponse.json(
      { error: 'Failed to delete channel' },
      { status: 500 }
    )
  }
} 