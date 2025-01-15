import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateAvatarResponse } from '@/lib/avatar-bot/openai';

export async function POST(req: Request) {
  try {
    console.log('[AVATAR_BOT] Starting response generation');
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log('[AVATAR_BOT] Unauthorized - no session');
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { recipientId, message } = body;
    console.log('[AVATAR_BOT] Request body:', { recipientId, message });

    if (!recipientId || !message) {
      console.log('[AVATAR_BOT] Missing required fields');
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Get recipient user and check if avatar is enabled
    const recipient = await db.user.findUnique({
      where: { id: recipientId },
      select: {
        avatarEnabled: true,
        avatarSystemPrompt: true,
        isOnline: true,
        name: true,
      }
    });
    console.log('[AVATAR_BOT] Recipient data:', recipient);

    if (!recipient) {
      console.log('[AVATAR_BOT] Recipient not found');
      return new NextResponse("Recipient not found", { status: 404 });
    }

    // Only respond if avatar is enabled
    if (!recipient.avatarEnabled) {
      console.log('[AVATAR_BOT] Avatar not enabled for recipient');
      return new NextResponse("Avatar response not available", { status: 400 });
    }

    // Format conversation for OpenAI
    const messages = [
      {
        role: 'user' as const,
        content: message
      }
    ];

    console.log('[AVATAR_BOT] Generating OpenAI response');
    // Generate response using OpenAI
    const response = await generateAvatarResponse(
      messages,
      recipient.avatarSystemPrompt || undefined
    );
    console.log('[AVATAR_BOT] Generated response:', response);

    return NextResponse.json({
      response,
      avatarName: `${recipient.name}'s Avatar`
    });

  } catch (error) {
    console.error('[AVATAR_BOT_RESPOND]', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
} 