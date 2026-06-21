import axios from 'axios';

export async function publishToTikTok(
  content: string,
  mediaUrls: string[],
  accountType: 'personal' | 'company' = 'personal'
): Promise<{ success: boolean; shareId?: string; message?: string; error?: string }> {
  if (process.env.USE_MOCKS === 'true') {
    console.log(`[MOCK TikTok - ${accountType}] Publishing video to TikTok. Content: "${content.substring(0, 40)}" | Video: ${mediaUrls.join(', ')}`);
    return {
      success: true,
      shareId: `mock_tiktok_${Math.random().toString(36).substring(7)}`,
      message: 'Video encolado/borrador creado en TikTok correctamente.'
    };
  }

  // Real implementation
  const tokenEnv = accountType === 'personal' ? 'PERSONAL_TIKTOK_ACCESS_TOKEN' : 'COMPANY_TIKTOK_ACCESS_TOKEN';
  const accessToken = process.env[tokenEnv];
  if (!accessToken) {
    return { success: false, error: `Missing token ${tokenEnv} in environment.` };
  }

  if (!mediaUrls || mediaUrls.length === 0) {
    return { success: false, error: 'TikTok posting requires at least one video URL.' };
  }

  try {
    // TikTok Content Posting API Init
    const res = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        post_info: {
          title: content,
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
          video_cover_timestamp_ms: 1000
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: mediaUrls[0] // Primary video URL
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      shareId: res.data.data?.publish_id,
      message: 'Publish initialized successfully (TikTok PULL_FROM_URL).'
    };
  } catch (err: any) {
    console.error('TikTok API Error:', err.response?.data || err.message);
    return {
      success: false,
      error: err.response?.data?.error?.message || err.message
    };
  }
}
