import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import type { DirectMessage } from '@/types/chat';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('Missing Pinecone API key');
}

if (!process.env.PINECONE_ENVIRONMENT) {
  throw new Error('Missing Pinecone environment');
}

if (!process.env.PINECONE_INDEX || !process.env.PINECONE_CHUNK_INDEX) {
  throw new Error('Missing Pinecone index names');
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Initialize both indexes
const conversationIndex = pinecone.index(process.env.PINECONE_INDEX!);
const chunkIndex = pinecone.index(process.env.PINECONE_CHUNK_INDEX!);

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: process.env.EMBEDDING_MODEL,
});

interface MessageMetadata {
  messageId: string;
  conversationId: string;
  userId: string;
  timestamp: string;
  isReply?: boolean;
  replyToId?: string;
  threadId?: string;
}

// Convert database message to Pinecone metadata format
function convertMessageForPinecone(message: any): Record<string, any> {
  return {
    id: message.id,
    content: message.content,
    createdAt: new Date(message.createdAt).getTime(),
    updatedAt: new Date(message.updatedAt).getTime(),
    conversationId: message.conversationId,
    userId: message.userId,
    isEdited: message.isEdited,
    replyToId: message.replyToId || '',
    userName: message.user?.name || '',
    userImage: message.user?.image || '',
    isAvatarMessage: message.isAvatarMessage || false,
    recipientId: message.recipientId // Store recipientId for all messages
  };
}

// Message queue for batching
let messageQueue: any[] = [];
const BATCH_SIZE = 10;
const BATCH_INTERVAL = 1000 * 60; // 1 minute

// Store a new message - now with batching
export const storeMessage = async (message: any) => {
  const pineconeMessage = convertMessageForPinecone(message);
  
  // Add to queue
  messageQueue.push({
    id: pineconeMessage.id,
    values: await embeddings.embedQuery(pineconeMessage.content),
    metadata: pineconeMessage
  });

  // Process queue if it reaches batch size
  if (messageQueue.length >= BATCH_SIZE) {
    await processBatch();
  }
};

// Process the queued messages
const processBatch = async () => {
  if (messageQueue.length === 0) return;

  try {
    console.log(`[PINECONE] Processing batch of ${messageQueue.length} messages`);
    
    // Upsert batch to conversation index
    await conversationIndex.upsert(messageQueue);
    
    // Clear the queue
    messageQueue = [];
    
    console.log('[PINECONE] Batch processing complete');
  } catch (error) {
    console.error('[PINECONE] Error processing batch:', error);
    // Keep messages in queue if upsert fails
  }
};

// Set up interval to process any remaining messages
setInterval(async () => {
  if (messageQueue.length > 0) {
    await processBatch();
  }
}, BATCH_INTERVAL);

// Ensure remaining messages are processed on shutdown
process.on('SIGTERM', async () => {
  await processBatch();
});

// Retrieve conversation context
export const getConversationContext = async (
  conversationId: string,
  currentMessage: string,
  limit: number = 20,
  timeframe: string = '7d'
) => {
  console.log('[CONTEXT] Starting context retrieval for:', { conversationId, currentMessage });
  
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: conversationIndex,
  });

  const timeframeTimestamp = new Date(getTimeframeDate(timeframe)).getTime();
  console.log('[CONTEXT] Using timeframe timestamp:', new Date(timeframeTimestamp).toISOString());

  const filter = {
    conversationId,
    createdAt: {
      $gte: timeframeTimestamp
    },
  };

  // Enhanced semantic search query that emphasizes finding relevant context
  const searchQuery = `Find messages that provide context for answering: ${currentMessage}
  Specifically look for:
  1. Previous questions about similar topics
  2. Related information shared earlier
  3. Important details from the conversation history
  4. Any previous interactions that might be relevant`;

  console.log('[CONTEXT] Using enhanced search query:', searchQuery);

  // Use hybrid search to combine semantic and keyword matching
  const results = await vectorStore.similaritySearch(searchQuery, limit, filter);
  
  // Sort results by timestamp to maintain conversation flow
  const sortedResults = results.sort((a, b) => 
    (a.metadata.createdAt as number) - (b.metadata.createdAt as number)
  );

  // Log retrieved context for debugging
  console.log('[CONTEXT] Retrieved context messages:', 
    sortedResults.map(msg => ({
      content: msg.pageContent,
      metadata: {
        createdAt: new Date(msg.metadata.createdAt).toISOString(),
        role: msg.metadata.isAvatarMessage ? 'assistant' : 'user',
        userName: msg.metadata.userName
      }
    }))
  );

  return sortedResults;
};

// Search across all messages
export const searchMessages = async (
  query: string,
  filters?: {
    conversationId?: string;
    userId?: string;
    timeframe?: string;
  },
  limit: number = 5
) => {
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: conversationIndex, // Use main index instead of chunk index
  });

  const filter = buildSearchFilter(filters);
  return await vectorStore.similaritySearch(query, limit, filter);
};

// Helper functions
const chunkText = (text: string, maxChunkLength: number = 100): string[] => {
  const words = text.split(' ');
  const chunks: string[] = [];
  let currentChunk: string[] = [];

  words.forEach(word => {
    if (currentChunk.join(' ').length + word.length > maxChunkLength) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [word];
    } else {
      currentChunk.push(word);
    }
  });

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
};

const getTimeframeDate = (timeframe: string): string => {
  const now = new Date();
  const match = timeframe.match(/^(\d+)([hd])$/);
  if (!match) throw new Error('Invalid timeframe format');

  const [_, amount, unit] = match;
  const value = parseInt(amount);

  if (unit === 'h') {
    now.setHours(now.getHours() - value);
  } else if (unit === 'd') {
    now.setDate(now.getDate() - value);
  }

  return now.toISOString();
};

const buildSearchFilter = (filters?: {
  conversationId?: string;
  userId?: string;
  timeframe?: string;
}) => {
  if (!filters) return undefined;

  const filter: Record<string, any> = {};

  if (filters.conversationId) {
    filter.conversationId = filters.conversationId;
  }
  if (filters.userId) {
    filter.userId = filters.userId;
  }
  if (filters.timeframe) {
    filter.timestamp = {
      $gte: getTimeframeDate(filters.timeframe),
    };
  }

  return filter;
}; 