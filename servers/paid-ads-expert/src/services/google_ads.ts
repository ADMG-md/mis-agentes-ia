import axios from 'axios';
import { CampaignSummary } from '../../../shared/types.js';

export async function getGoogleCampaigns(
  customerId: string
): Promise<{ success: boolean; campaigns?: CampaignSummary[]; error?: string }> {
  if (process.env.USE_MOCKS === 'true') {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return {
      success: true,
      campaigns: [
        {
          campaignId: 'google_c1',
          campaignName: 'Clinica Dental - Google Maps Geo-Localizado',
          platform: 'google_ads',
          status: 'ACTIVE',
          objective: 'SEARCH',
          spend: 110.50,
          impressions: 8400,
          clicks: 290,
          conversions: 18,
          roas: 4.8,
          cpc: 0.38,
          cpm: 13.15,
          dateRange: { start: sevenDaysAgo, end: today }
        },
        {
          campaignId: 'google_c2',
          campaignName: 'Diabetes y Resistencia Insulina - Campaña Search',
          platform: 'google_ads',
          status: 'ACTIVE',
          objective: 'SEARCH',
          spend: 95.00,
          impressions: 4300,
          clicks: 190,
          conversions: 12,
          roas: 3.9,
          cpc: 0.50,
          cpm: 22.09,
          dateRange: { start: sevenDaysAgo, end: today }
        }
      ]
    };
  }

  const devToken = process.env.COMPANY_GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.COMPANY_GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.COMPANY_GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.COMPANY_GOOGLE_ADS_REFRESH_TOKEN;
  const targetCustomerId = customerId.replace(/-/g, '');

  if (!devToken || !clientId || !clientSecret || !refreshToken) {
    return { success: false, error: 'Missing Google Ads credentials in environment.' };
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

    // 2. Query campaigns via GAQL Search Stream
    const query = `
      SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
             metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions
      FROM campaign
      WHERE campaign.status IN ('ENABLED', 'PAUSED')
    `;

    const cleanCustomerId = targetCustomerId.trim();
    const url = `https://googleads.googleapis.com/v18/customers/${cleanCustomerId}/googleAds:searchStream`;
    const res = await axios.post(
      url,
      { query },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': devToken,
          'login-customer-id': process.env.COMPANY_GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract results from searchStream response structure
    const campaigns: CampaignSummary[] = [];
    const today = new Date().toISOString().split('T')[0];

    if (Array.isArray(res.data)) {
      for (const batch of res.data) {
        if (batch.results) {
          for (const row of batch.results) {
            const c = row.campaign;
            const m = row.metrics || {};
            const spend = parseFloat(m.costMicros || '0') / 1000000;
            const impressions = parseInt(m.impressions || '0');
            const clicks = parseInt(m.clicks || '0');
            const conversions = parseFloat(m.conversions || '0');

            const cpc = clicks > 0 ? spend / clicks : 0;
            const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
            const roas = conversions > 0 ? (conversions * 50) / spend : 0; // Simulated lead conversion value ($50)

            campaigns.push({
              campaignId: c.id,
              campaignName: c.name,
              platform: 'google_ads',
              status: c.status === 'ENABLED' ? 'ACTIVE' : 'PAUSED',
              objective: c.advertisingChannelType,
              spend,
              impressions,
              clicks,
              conversions,
              roas,
              cpc,
              cpm,
              dateRange: { start: today, end: today }
            });
          }
        }
      }
    }

    return { success: true, campaigns };
  } catch (err: any) {
    console.error('Google Ads API query error:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.[0]?.error?.message || err.message };
  }
}

export async function updateGoogleCampaignBudget(
  customerId: string,
  campaignId: string,
  newBudgetAmount: number
): Promise<{ success: boolean; oldBudget?: number; error?: string }> {
  if (process.env.USE_MOCKS === 'true') {
    console.log(`[MOCK Google Ads] Updating budget for campaign ${campaignId} to $${newBudgetAmount} USD`);
    return { success: true, oldBudget: 30.0 };
  }

  // Google Ads requires modifying the campaign_budget resource associated with the campaign
  return {
    success: false,
    error: 'Google Ads budget updates require active developer tokens and OAuth configuration.'
  };
}

export async function getGoogleKeywordsPerformance(
  customerId: string
): Promise<{ success: boolean; keywords?: any[]; error?: string }> {
  if (process.env.USE_MOCKS === 'true') {
    return {
      success: true,
      keywords: [
        { keyword: 'dentista cerca de mi', impressions: 450, clicks: 85, conversions: 8, cost: 32.30 },
        { keyword: 'tratamiento resistencia insulina', impressions: 1200, clicks: 140, conversions: 12, cost: 70.00 },
        { keyword: 'coe caribe ips', impressions: 150, clicks: 65, conversions: 9, cost: 12.00 },
        { keyword: 'implantes dentales barranquilla', impressions: 380, clicks: 42, conversions: 2, cost: 41.50 }
      ]
    };
  }

  // GAQL keyword performance query
  return {
    success: false,
    error: 'Google Ads keyword reports require authenticated API keys.'
  };
}

export async function getGoogleGeoPerformance(
  customerId: string
): Promise<{ success: boolean; geoData?: any[]; error?: string }> {
  if (process.env.USE_MOCKS === 'true') {
    return {
      success: true,
      geoData: [
        { region: 'Barranquilla', impressions: 4500, clicks: 230, conversions: 14, cost: 95.00 },
        { region: 'Puerto Colombia', impressions: 1200, clicks: 95, conversions: 7, cost: 32.50 },
        { region: 'Soledad', impressions: 1900, clicks: 55, conversions: 1, cost: 18.00 },
        { region: 'Santa Marta', impressions: 800, clicks: 10, conversions: 0, cost: 5.00 }
      ]
    };
  }

  return {
    success: false,
    error: 'Google Ads geo performance reports require authenticated API keys.'
  };
}
