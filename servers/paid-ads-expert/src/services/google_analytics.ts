import axios from 'axios';

export async function getGA4TrafficReport(
  propertyId: string
): Promise<{ success: boolean; traffic?: any[]; error?: string }> {
  if (process.env.USE_MOCKS === 'true') {
    return {
      success: true,
      traffic: [
        { source: 'google', medium: 'organic', activeUsers: 450, sessions: 620, conversions: 22 },
        { source: 'google', medium: 'cpc', activeUsers: 240, sessions: 390, conversions: 18 },
        { source: 'meta', medium: 'cpc', activeUsers: 190, sessions: 280, conversions: 14 },
        { source: 'direct', medium: '(none)', activeUsers: 120, sessions: 180, conversions: 8 },
        { source: 'instagram', medium: 'referral', activeUsers: 85, sessions: 110, conversions: 3 }
      ]
    };
  }

  // Real implementation of GA4 Reporting API (v1beta)
  const devToken = process.env.COMPANY_GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.COMPANY_GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.COMPANY_GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.COMPANY_GOOGLE_ADS_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return { success: false, error: 'Missing Google Analytics OAuth credentials in environment.' };
  }

  try {
    // 1. Refresh Access Token
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });
    const accessToken = tokenRes.data.access_token;

    // 2. Fetch Report
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
    const res = await axios.post(
      url,
      {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'conversions' }]
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const traffic = (res.data.rows || []).map((row: any) => ({
      source: row.dimensionValues[0]?.value,
      medium: row.dimensionValues[1]?.value,
      activeUsers: parseInt(row.metricValues[0]?.value || '0'),
      sessions: parseInt(row.metricValues[1]?.value || '0'),
      conversions: parseInt(row.metricValues[2]?.value || '0')
    }));

    return { success: true, traffic };
  } catch (err: any) {
    console.error('GA4 Reporting API error:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}
