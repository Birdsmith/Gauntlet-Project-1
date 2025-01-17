require('dotenv').config({ path: '.env.local' });
const { Pinecone } = require('@pinecone-database/pinecone');

if (!process.env.PINECONE_API_KEY) {
  throw new Error('Missing Pinecone API key');
}

if (!process.env.PINECONE_INDEX) {
  throw new Error('Missing Pinecone index name');
}

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

async function initIndexes() {
  try {
    // Check if conversation index exists
    try {
      await pc.describeIndex(process.env.PINECONE_INDEX!);
      console.log('Conversation index already exists');
    } catch (error) {
      console.log(`Creating conversation index: ${process.env.PINECONE_INDEX}`);
      await pc.createIndex({
        name: process.env.PINECONE_INDEX!,
        dimension: 1536, // OpenAI text-embedding-3-small dimension
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });
      console.log('Conversation index created');
    }
  } catch (error) {
    console.error('Error during index initialization:', error);
    throw error;
  }
}

initIndexes()
  .then(() => {
    console.log('Initialization complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Initialization failed:', error);
    process.exit(1);
  }); 