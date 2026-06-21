import axios from 'axios';
import { CampaignSummary } from '../../../shared/types.js';

export async function getMetaCampaigns(
  accountId: string
): Promise<{ success: boolean; campaigns?: CampaignSummary[]; error?: string }> {
  if (process.env.USE_MOCKS === 'true') {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return {
      success: true,
      campaigns: [
        {
          campaignId: 'meta_c1',
          campaignName: 'Clinica Dental - Captacion Leads Ortodoncia Local',
          platform: 'meta_ads',
          status: 'ACTIVE',
          objective: 'LEADS',
          spend: 154.20,
          impressions: 12500,
          clicks: 340,
          conversions: 24,
          roas: 3.5,
          cpc: 0.45,
          cpm: 12.33,
          dateRange: { start: sevenDaysAgo, end: today }
        },
        {
          campaignId: 'meta_c2',
          campaignName: 'Marca Dr. Molina - Video Educativo Resistencia Insulina',
          platform: 'meta_ads',
          status: 'ACTIVE',
          objective: 'OUTCOMES',
          spend: 85.00,
          impressions: 48000,
          clicks: 980,
          conversions: 0,
          roas: 0.0,
          cpc: 0.08,
          cpm: 1.77,
          dateRange: { start: sevenDaysAgo, end: today }
        }
      ]
    };
  }

  // Real implementation
  const accessToken = process.env.COMPANY_META_ACCESS_TOKEN;
  if (!accessToken) {
    return { success: false, error: 'Missing COMPANY_META_ACCESS_TOKEN in environment.' };
  }

  try {
    const cleanId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    const url = `https://graph.facebook.com/v18.0/${cleanId}/campaigns`;
    const res = await axios.get(url, {
      params: {
        fields: 'id,name,status,objective,buying_type,insights{spend,impressions,clicks,actions}',
        access_token: accessToken
      }
    });

    const campaigns: CampaignSummary[] = res.data.data.map((c: any) => {
      const insights = c.insights?.data?.[0] || {};
      const spend = parseFloat(insights.spend || '0');
      const impressions = parseInt(insights.impressions || '0');
      const clicks = parseInt(insights.clicks || '0');

      // Meta places conversions under actions array
      let conversions = 0;
      if (insights.actions) {
        const leadAction = insights.actions.find((a: any) => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead');
        conversions = leadAction ? parseInt(leadAction.value) : 0;
      }

      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const roas = conversions > 0 ? (conversions * 45) / spend : 0; // Simulated patient value $45

      const today = new Date().toISOString().split('T')[0];
      return {
        campaignId: c.id,
        campaignName: c.name,
        platform: 'meta_ads',
        status: c.status,
        objective: c.objective,
        spend,
        impressions,
        clicks,
        conversions,
        roas,
        cpc,
        cpm,
        dateRange: { start: today, end: today } // Graph API default range is 30 days usually
      };
    });

    return { success: true, campaigns };
  } catch (err: any) {
    console.error('Meta Ads API error:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}

export async function updateMetaCampaignBudget(
  campaignId: string,
  newBudget: number
): Promise<{ success: boolean; oldBudget?: number; error?: string }> {
  if (process.env.USE_MOCKS === 'true') {
    console.log(`[MOCK Meta Ads] Updating budget for campaign ${campaignId} to $${newBudget} USD`);
    return { success: true, oldBudget: 45.0 };
  }

  const accessToken = process.env.COMPANY_META_ACCESS_TOKEN;
  if (!accessToken) {
    return { success: false, error: 'Missing COMPANY_META_ACCESS_TOKEN in environment.' };
  }

  try {
    // Get old budget first
    const getUrl = `https://graph.facebook.com/v18.0/${campaignId}`;
    const getRes = await axios.get(getUrl, {
      params: { fields: 'daily_budget,lifetime_budget', access_token: accessToken }
    });
    const oldBudget = parseFloat(getRes.data.daily_budget || getRes.data.lifetime_budget || '0') / 100; // Meta represents in cents

    const url = `https://graph.facebook.com/v18.0/${campaignId}`;
    await axios.post(url, {
      daily_budget: Math.round(newBudget * 100), // convert to cents
      access_token: accessToken
    });

    return { success: true, oldBudget };
  } catch (err: any) {
    console.error('Meta budget update error:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}

export async function setMetaCampaignStatus(
  campaignId: string,
  status: 'ACTIVE' | 'PAUSED'
): Promise<{ success: boolean; error?: string }> {
  if (process.env.USE_MOCKS === 'true') {
    console.log(`[MOCK Meta Ads] Setting campaign ${campaignId} status to ${status}`);
    return { success: true };
  }

  const accessToken = process.env.COMPANY_META_ACCESS_TOKEN;
  if (!accessToken) {
    return { success: false, error: 'Missing COMPANY_META_ACCESS_TOKEN in environment.' };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${campaignId}`;
    await axios.post(url, {
      status,
      access_token: accessToken
    });
    return { success: true };
  } catch (err: any) {
    console.error('Meta status update error:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}

export async function getMetaAdCreatives(
  campaignId: string
): Promise<{ success: boolean; creatives?: any[]; error?: string }> {
  if (process.env.USE_MOCKS === 'true') {
    return {
      success: true,
      creatives: [
        {
          id: 'cr_1',
          name: 'Ad Ortodoncia Video 1',
          body: '¿Sufres de alineación dental? Visítanos en COE Caribe IPS. Agenda tu consulta hoy mismo.',
          image_url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5'
        },
        {
          id: 'cr_2',
          name: 'Ad Banner Imagen Estática 2',
          body: 'Tratamientos de medicina de precisión en el Caribe. Especialistas en salud digestiva y dental.',
          image_url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09'
        }
      ]
    };
  }

  const accessToken = process.env.COMPANY_META_ACCESS_TOKEN;
  if (!accessToken) {
    return { success: false, error: 'Missing COMPANY_META_ACCESS_TOKEN in environment.' };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${campaignId}/ads`;
    const res = await axios.get(url, {
      params: {
        fields: 'id,name,creative{id,name,body,image_url,thumbnail_url}',
        access_token: accessToken
      }
    });

    const creatives = res.data.data.map((ad: any) => ({
      id: ad.creative?.id || ad.id,
      name: ad.creative?.name || ad.name,
      body: ad.creative?.body || 'No ad body text',
      image_url: ad.creative?.image_url || ad.creative?.thumbnail_url || 'No preview URL'
    }));

    return { success: true, creatives };
  } catch (err: any) {
    console.error('Meta creatives fetching error:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}
