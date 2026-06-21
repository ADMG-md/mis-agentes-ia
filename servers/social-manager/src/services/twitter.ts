import { TwitterApi } from 'twitter-api-v2';

export async function publishToX(
  content: string,
  mediaUrls?: string[],
  accountType: 'personal' | 'company' = 'personal'
): Promise<{ success: boolean; tweetId?: string; tweetUrl?: string; error?: string }> {
  if (process.env.USE_MOCKS === 'true') {
    console.log(`[MOCK X (Twitter) - ${accountType}] Tweeting: "${content.substring(0, 50)}..."`);
    const mockId = Math.floor(Math.random() * 1e15).toString();
    return {
      success: true,
      tweetId: mockId,
      tweetUrl: `https://x.com/user/status/${mockId}`
    };
  }

  // Real implementation
  const prefix = accountType === 'personal' ? 'PERSONAL_X_' : 'COMPANY_X_';
  const apiKey = process.env[`${prefix}API_KEY`];
  const apiSecret = process.env[`${prefix}API_SECRET`];
  const accessToken = process.env[`${prefix}ACCESS_TOKEN`];
  const accessSecret = process.env[`${prefix}ACCESS_TOKEN_SECRET`];

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    return { success: false, error: `Missing credentials with prefix ${prefix} in environment.` };
  }

  try {
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken: accessToken,
      accessSecret: accessSecret
    });

    const tweet = await client.v2.tweet(content);
    return {
      success: true,
      tweetId: tweet.data.id,
      tweetUrl: `https://x.com/user/status/${tweet.data.id}`
    };
  } catch (err: any) {
    console.error('X API Error:', err);
    return {
      success: false,
      error: err.message || 'Unknown X API Error'
    };
  }
}
