import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'

export async function PATCH(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Users can only update their own profile
    if (session.user.id !== params.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const name = formData.get('name') as string
    const imageFile = formData.get('image') as File | null

    // Validate input
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Get current user to check if we need to delete old image
    const currentUser = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { image: true }
    })

    let imagePath: string | null = null

    if (imageFile) {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
      try {
        await writeFile(path.join(uploadsDir, '.keep'), '')
      } catch (error) {
        // Directory already exists, ignore error
      }

      // Generate unique filename
      const ext = imageFile.name.split('.').pop()
      const filename = `${params.userId}-${Date.now()}.${ext}`
      const arrayBuffer = await imageFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      // Save the file
      await writeFile(path.join(uploadsDir, filename), buffer)
      imagePath = `/uploads/${filename}`

      // Delete old image if it exists
      if (currentUser?.image) {
        const oldImagePath = path.join(process.cwd(), 'public', currentUser.image.replace(/^\//, ''))
        try {
          await unlink(oldImagePath)
        } catch (error) {
          console.error('Error deleting old image:', error)
        }
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.userId },
      data: {
        name: name.trim(),
        image: imagePath || currentUser?.image || null,
      },
      select: {
        id: true,
        name: true,
        image: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
} 