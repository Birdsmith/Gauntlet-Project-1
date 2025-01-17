interface DIDTalkResponse {
  id: string;
  status: 'created' | 'started' | 'done' | 'error';
  result_url?: string;
  error?: {
    code: string;
    message: string;
  };
}

export class DIDService {
  private readonly apiKey: string;
  private readonly apiUrl: string = 'https://api.d-id.com';

  constructor() {
    const apiKey = process.env.D_ID_API_KEY;
    if (!apiKey) {
      throw new Error('D-ID API key is not configured');
    }
    this.apiKey = apiKey;
    console.log('D-ID Service initialized with API key:', this.apiKey);
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    console.log('Making D-ID API request to:', `${this.apiUrl}${endpoint}`);
    console.log('With headers:', {
      'Authorization': `Basic ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    });

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Basic ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error('D-ID API error response:', error);
      throw new Error(`D-ID API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('D-ID API response:', data);
    return data;
  }

  async createTalkVideo(imageUrl: string, text: string): Promise<string> {
    try {
      console.log('Creating talk video with:', { imageUrl, text });
      // Create talk request
      const createResponse = await this.fetchWithAuth('/talks', {
        method: 'POST',
        body: JSON.stringify({
          script: {
            type: 'text',
            input: text,
          },
          source_url: imageUrl,
          config: {
            stitch: true,
          },
        }),
      }) as DIDTalkResponse;

      // Poll for completion
      const maxAttempts = 30; // 30 seconds timeout
      let attempts = 0;
      let talkResponse = createResponse;

      while (attempts < maxAttempts) {
        if (talkResponse.status === 'done' && talkResponse.result_url) {
          console.log('Video generation completed:', talkResponse);
          return talkResponse.result_url;
        }

        if (talkResponse.status === 'error') {
          console.error('Video generation error:', talkResponse.error);
          throw new Error(`D-ID error: ${talkResponse.error?.message}`);
        }

        // Wait 1 second before next poll
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get talk status
        console.log('Polling talk status:', createResponse.id);
        talkResponse = await this.fetchWithAuth(`/talks/${createResponse.id}`) as DIDTalkResponse;
        attempts++;
      }

      throw new Error('Timeout waiting for video generation');
    } catch (error) {
      console.error('Error generating talk video:', error);
      throw error;
    }
  }
} 