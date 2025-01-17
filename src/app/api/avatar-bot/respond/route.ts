import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateAvatarResponse } from '@/lib/avatar-bot/openai';
import { storeMessage } from '@/lib/vectorstore';

export async function POST(req: Request) {
  try {
    console.log('[AVATAR_BOT] Starting response generation');
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log('[AVATAR_BOT] Unauthorized - no session');
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { recipientId, message, conversationId } = body;
    console.log('[AVATAR_BOT] Request body:', { recipientId, message, conversationId });

    if (!recipientId || !message || !conversationId) {
      console.log('[AVATAR_BOT] Missing required fields');
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Get recipient user and check if avatar is enabled
    console.log('[AVATAR_BOT] Fetching recipient data:', recipientId);
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

    // Store user message in database first
    console.log('[AVATAR_BOT] Storing user message in database');
    let userMessage;
    try {
      // Don't save the user message again since it's already saved by the API
      userMessage = await db.directMessage.findFirst({
        where: {
          conversationId,
          userId: session.user.id,
          content: message,
        },
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            }
          },
          files: true,
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                }
              }
            }
          }
        }
      });

      if (!userMessage) {
        console.log('[AVATAR_BOT] User message not found in database');
        return new NextResponse("Message not found", { status: 404 });
      }

      console.log('[AVATAR_BOT] Found user message in database:', userMessage);

      // Store user message in Pinecone
      console.log('[AVATAR_BOT] Storing user message in Pinecone');
      await storeMessage({
        ...userMessage,
        isAvatarMessage: false,
        recipientId // Store recipientId for context
      });
      console.log('[AVATAR_BOT] Successfully stored user message in Pinecone');
    } catch (error) {
      console.error('[AVATAR_BOT] Failed to find user message:', error);
      return new NextResponse("Failed to process message", { status: 500 });
    }

    // Format conversation for OpenAI
    const messages = [
      {
        role: 'user' as const,
        content: message
      }
    ];

    console.log('[AVATAR_BOT] Generating OpenAI response');
    // Generate response using OpenAI with conversation context
    let response: { content: string; videoUrl?: string };
    try {
      response = await generateAvatarResponse(
        messages,
        conversationId,
        recipientId,
        recipient.avatarSystemPrompt || undefined
      );
      console.log('[AVATAR_BOT] Generated response:', response);
    } catch (error) {
      console.error('[AVATAR_BOT] Error generating avatar response:', error);
      response = {
        content: "I apologize, but I'm having trouble responding right now. Please try again later or wait for the user to come back online."
      };
      console.log('[AVATAR_BOT] Using fallback response');
    }

    // Store the avatar's response
    console.log('[AVATAR_BOT] Storing avatar response in database');
    let avatarMessage;
    try {
      avatarMessage = await db.directMessage.create({
        data: {
          content: response.content,
          conversationId,
          userId: recipientId, // Use recipient's ID for avatar messages
          isAvatarMessage: true,
          avatarName: `${recipient.name}'s Avatar`,
          avatarVideoUrl: response.videoUrl, // Store the video URL if available
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            }
          },
          files: true,
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                }
              }
            }
          }
        }
      });
      console.log('[AVATAR_BOT] Stored avatar response in database:', avatarMessage);
    } catch (error) {
      console.error('[AVATAR_BOT] Failed to store avatar response in database:', error);
      return new NextResponse("Failed to store response", { status: 500 });
    }

    // Store avatar response in Pinecone
    try {
      console.log('[AVATAR_BOT] Storing avatar response in Pinecone');
      await storeMessage({
        ...avatarMessage,
        isAvatarMessage: true,
        recipientId, // Add recipientId to identify avatar messages
        avatarName: `${recipient.name}'s Avatar`
      });
      console.log('[AVATAR_BOT] Successfully stored avatar response in Pinecone');
    } catch (error) {
      console.error('[AVATAR_BOT] Failed to store avatar response in Pinecone:', error);
      // Continue execution even if Pinecone storage fails
    }

    const responseData = {
      id: avatarMessage.id,
      response: response.content,
      avatarName: `${recipient.name}'s Avatar`,
      videoUrl: response.videoUrl
    };
    console.log('[AVATAR_BOT] Sending response:', responseData);

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[AVATAR_BOT_RESPOND] Unexpected error:', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
} 