import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { uploadToS3, getS3Url } from '@/lib/s3-operations';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new NextResponse('No file uploaded', { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    const key = `profile-pictures/${session.user.id}/${filename}`;
    
    // Upload to S3 with public-read ACL
    await uploadToS3(buffer, key, true);

    // Get the S3 URL
    const imageUrl = getS3Url(key);

    // Update user's avatar image in database using Prisma's safe update
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        avatarImage: imageUrl,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ avatarImage: imageUrl });
  } catch (error) {
    console.error('Error uploading avatar image:', error);
    return new NextResponse('Error uploading file', { status: 500 });
  }
} 