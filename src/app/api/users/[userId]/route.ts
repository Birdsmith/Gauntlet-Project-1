import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { uploadToS3, getS3Url } from '@/lib/s3-operations'

export async function GET(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        isOnline: true,
        avatarEnabled: true,
        videoEnabled: true,
        avatarSystemPrompt: true,
        avatarImage: true,
      }
    })

    if (!user) {
      return new NextResponse("User not found", { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('[USER_GET]', error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const contentType = req.headers.get('content-type') || '';
    let body;

    // Handle form-data requests
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const name = formData.get('name');
      const image = formData.get('image');
      const avatarEnabled = formData.get('avatarEnabled');
      const videoEnabled = formData.get('videoEnabled');
      const avatarSystemPrompt = formData.get('avatarSystemPrompt');

      body = {
        name: name?.toString(),
        image,
        avatarEnabled: avatarEnabled === 'true',
        videoEnabled: videoEnabled === 'true',
        avatarSystemPrompt: avatarSystemPrompt?.toString(),
      };
    } 
    // Handle JSON requests
    else if (contentType.includes('application/json')) {
      const text = await req.text();
      try {
        body = JSON.parse(text);
      } catch (error) {
        console.error('[USER_PATCH] Error parsing JSON body:', error);
        return new NextResponse("Invalid JSON body", { status: 400 });
      }
    } else {
      return new NextResponse("Unsupported content type", { status: 400 });
    }

    const { name, image, avatarEnabled, videoEnabled, avatarSystemPrompt } = body;

    const updateData: any = {};
    if (name) {
      updateData.name = name;
    }
    if (typeof avatarEnabled === 'boolean') {
      updateData.avatarEnabled = avatarEnabled;
      // If turning off avatar, also turn off video
      if (!avatarEnabled) {
        updateData.videoEnabled = false;
      }
    }
    if (typeof videoEnabled === 'boolean') {
      updateData.videoEnabled = videoEnabled;
    }
    if (typeof avatarSystemPrompt === 'string') {
      updateData.avatarSystemPrompt = avatarSystemPrompt;
    }

    // Handle image upload if present
    if (image && typeof image !== 'string') {
      const bytes = await image.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Create a unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${image.name}`;
      const key = `profile-pictures/${session.user.id}/${filename}`;
      
      // Upload to S3 with public-read ACL
      await uploadToS3(buffer, key, true);

      // Get the S3 URL
      const imageUrl = getS3Url(key);
      updateData.image = imageUrl;
    }

    // Only proceed with update if we have data to update
    if (Object.keys(updateData).length === 0) {
      return new NextResponse("No valid fields to update", { status: 400 });
    }

    const user = await db.user.update({
      where: { id: params.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        isOnline: true,
        avatarEnabled: true,
        videoEnabled: true,
        avatarSystemPrompt: true,
        avatarImage: true,
      }
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('[USER_PATCH]', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
