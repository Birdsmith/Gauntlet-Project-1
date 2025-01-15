import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AvatarBotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function generateAvatarResponse(
  messages: AvatarBotMessage[],
  userSystemPrompt?: string
): Promise<string> {
  try {
    // Add default system prompt if none provided
    if (!messages.some(msg => msg.role === 'system')) {
      const defaultSystemPrompt = userSystemPrompt || 
        "You are an AI avatar representing a user who is currently offline. " +
        "Respond naturally and conversationally, while making it clear you are an AI assistant. " +
        "Keep responses concise and helpful. If you cannot help with something, " +
        "mention that the user will respond when they're back online.";
      
      messages.unshift({
        role: 'system',
        content: defaultSystemPrompt
      });
    }

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: messages,
      temperature: 0.7, // Slightly creative but still focused
      max_tokens: 150,  // Keep responses concise
    });

    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response at the moment.";
  } catch (error) {
    console.error('Error generating avatar response:', error);
    return "I apologize, but I'm having trouble responding right now. Please try again later or wait for the user to come back online.";
  }
} 