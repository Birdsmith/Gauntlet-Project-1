import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadToS3, getS3Url } from '@/lib/s3-operations'

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
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
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

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

      // Return the file details
      return NextResponse.json({
        name: file.name,
        size: file.size,
        type: file.type,
        url,
      })
    } catch (error) {
      console.error('Error handling file upload:', error)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in upload route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
