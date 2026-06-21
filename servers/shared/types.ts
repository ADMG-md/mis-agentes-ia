export interface UnifiedMetric {
  id: string;
  platform: 'linkedin' | 'x' | 'tiktok' | 'youtube' | 'meta_ads' | 'google_ads' | 'ga4';
  accountType: 'personal' | 'company';
  metricName: string;       // impressions, likes, clicks, conversions, spend, views, CTR, etc.
  metricValue: number;
  date: string;             // ISO 8601 (YYYY-MM-DD)
  rawFieldName: string;     // Nombre original del campo en la API de origen
  fetchedAt: string;        // ISO 8601 timestamp
}

export interface PostDraft {
  id: string;
  content: string;
  platforms: Array<'linkedin' | 'x' | 'tiktok' | 'youtube'>;
  accountType: 'personal' | 'company';
  status: 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';
  mediaUrls?: string[];
  mediaType?: 'image' | 'video' | 'carousel';
  createdAt: string;
  scheduledAt?: string;
  publishedAt?: string;
}

export interface CampaignSummary {
  campaignId: string;
  campaignName: string;
  platform: 'meta_ads' | 'google_ads';
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
  cpc: number;
  cpm: number;
  dateRange: { start: string; end: string };
}

export interface BudgetGuard {
  maxDailySpend: number;          // Límite diario máximo en USD
  maxSingleBudgetChange: number;  // Cambio máximo permitido por operación en USD
  alertThresholdPercent: number;  // Porcentaje del presupuesto que dispara alerta (e.g. 80)
  requireConfirmation: boolean;   // Si true, exige confirmación manual
  cooldownMinutes: number;        // Tiempo mínimo entre cambios de presupuesto
}
