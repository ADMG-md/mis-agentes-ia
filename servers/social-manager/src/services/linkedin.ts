import axios from 'axios';

export async function publishToLinkedIn(
  content: string,
  mediaUrls?: string[],
  accountType: 'personal' | 'company' = 'personal'
): Promise<{ success: boolean; postUrl?: string; error?: string }> {
  if (process.env.USE_MOCKS === 'true') {
    console.log(`[MOCK LinkedIn - ${accountType}] Publishing post: "${content.substring(0, 50)}..."`);
    return {
      success: true,
      postUrl: `https://www.linkedin.com/feed/update/urn:li:share:mock_${Math.random().toString(36).substring(7)}`
    };
  }

  // Real implementation
  const tokenEnv = accountType === 'personal' ? 'PERSONAL_LINKEDIN_ACCESS_TOKEN' : 'COMPANY_LINKEDIN_ACCESS_TOKEN';
  const accessToken = process.env[tokenEnv];
  if (!accessToken) {
    return { success: false, error: `Missing token ${tokenEnv} in environment.` };
  }

  try {
    // 1. Get user profile details to get URN
    const profileRes = await axios.get('https://api.linkedin.com/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const authorUrn = `urn:li:person:${profileRes.data.id}`;

    // 2. Post Share
    const postBody = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    const shareRes = await axios.post('https://api.linkedin.com/v2/ugcPosts', postBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    return {
      success: true,
      postUrl: `https://www.linkedin.com/feed/update/${shareRes.data.id}`
    };
  } catch (err: any) {
    console.error('LinkedIn API Error:', err.response?.data || err.message);
    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}
