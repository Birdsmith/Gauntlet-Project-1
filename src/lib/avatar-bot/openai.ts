import OpenAI from 'openai';
import { getConversationContext } from '@/lib/vectorstore';
import { DIDService } from './d-id';
import prisma from '@/lib/prisma';
import type { UserSelect, UserWithAvatar } from '@/types/prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type MessageRole = 'system' | 'user' | 'assistant';

export interface AvatarBotMessage {
  role: MessageRole;
  content: string;
}

interface ContextDocument {
  pageContent: string;
  metadata: Record<string, any>;
}

export async function generateAvatarResponse(
  messages: AvatarBotMessage[],
  conversationId: string,
  userId: string,
  userSystemPrompt?: string
): Promise<{ content: string; videoUrl?: string }> {
  try {
    const currentMessage = messages[messages.length - 1].content;
    console.log('[AVATAR_BOT] Processing message:', currentMessage);
    
    // Get context using the current message for semantic search
    const contextMessages = await getConversationContext(conversationId, currentMessage);
    console.log('[AVATAR_BOT] Retrieved context messages:', contextMessages.length);

    // Convert context messages into the correct format with proper roles
    const formattedContextMessages = contextMessages.map((msg: ContextDocument) => {
      const role: MessageRole = msg.metadata.isAvatarMessage ? 'assistant' : 'user';
      return {
        role,
        content: msg.metadata.content,
        name: msg.metadata.userName
      };
    });

    // Add default system prompt if none provided
    const defaultSystemPrompt = userSystemPrompt || 
      "You are an AI avatar representing a user who is currently offline. " +
      "Your responses should be natural and conversational while acknowledging your AI nature. " +
      "\n\nConversation Memory Instructions:\n" +
      "1. You have access to the conversation history - use it to maintain context and continuity\n" +
      "2. When asked about previous messages, quote them accurately\n" +
      "3. If referencing past context, mention when it was discussed\n" +
      "4. Maintain consistency with your previous statements\n" +
      "5. If you notice patterns or recurring topics, acknowledge them\n" +
      "6. If you're unsure about something from the past, admit it rather than guessing\n" +
      "\nKeep responses helpful and concise. If you cannot help with something, " +
      "mention that the user will respond when they're back online.";

    // Combine context and current messages, ensuring proper chronological order
    const allMessages = [
      { role: 'system' as MessageRole, content: defaultSystemPrompt },
      ...formattedContextMessages,
      ...messages
    ];

    console.log('[AVATAR_BOT] Final message sequence:', allMessages.map(msg => ({
      role: msg.role,
      contentPreview: msg.content.substring(0, 100) + '...'
    })));

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: allMessages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content || "I'm sorry, I couldn't generate a response at the moment.";

    // Check if user has an avatar image and video enabled
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        avatarImage: true,
        videoEnabled: true,
        avatarEnabled: true
      } as unknown as UserSelect
    });

    let videoUrl: string | undefined;

    // Generate video if user has an avatar image and video enabled
    if (user?.avatarImage && user?.videoEnabled && user?.avatarEnabled) {
      try {
        const didService = new DIDService();
        videoUrl = await didService.createTalkVideo(user.avatarImage, content);
      } catch (error) {
        console.error('[AVATAR_BOT] Error generating video:', error);
        // Continue without video if generation fails
      }
    }

    return { content, videoUrl };
  } catch (error) {
    console.error('[AVATAR_BOT] Error generating avatar response:', error);
    return {
      content: "I apologize, but I'm having trouble responding right now. Please try again later or wait for the user to come back online."
    };
  }
} 