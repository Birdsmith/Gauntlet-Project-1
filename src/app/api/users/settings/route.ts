import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: {
        avatarEnabled: true,
        avatarSystemPrompt: true,
      }
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('[USER_SETTINGS_GET]', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { avatarEnabled, avatarSystemPrompt } = body;

    const user = await db.user.update({
      where: { email: session.user.email },
      data: {
        avatarEnabled,
        avatarSystemPrompt,
      },
      select: {
        avatarEnabled: true,
        avatarSystemPrompt: true,
      }
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('[USER_SETTINGS_PATCH]', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
} 