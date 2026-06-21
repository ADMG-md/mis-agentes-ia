import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getMetaCampaigns, updateMetaCampaignBudget, setMetaCampaignStatus, getMetaAdCreatives } from './services/meta_graph.js';
import { getGoogleCampaigns, getGoogleKeywordsPerformance, getGoogleGeoPerformance, updateGoogleCampaignBudget } from './services/google_ads.js';
import { getGA4TrafficReport } from './services/google_analytics.js';
import { getBudgetGuardConfig, validateBudgetChange, logBudgetChange } from './services/budget_guard.js';
import { CampaignSummary } from '../../shared/types.js';

const server = new Server(
  {
    name: 'paid-ads-expert',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_campaigns_summary',
        description: 'Recupera un resumen consolidado de las campañas publicitarias activas en Meta Ads y Google Ads.',
        inputSchema: {
          type: 'object',
          properties: {
            adPlatform: {
              type: 'string',
              enum: ['meta', 'google'],
              description: 'Opcional. Plataforma de pauta específica. Si se omite, se devuelven ambas.'
            },
            metaAccountId: { type: 'string', description: 'Requerido para Meta Ads. Formato: act_XXXXXXX' },
            googleCustomerId: { type: 'string', description: 'Requerido para Google Ads. Formato: XXX-XXX-XXXX' }
          }
        }
      },
      {
        name: 'update_campaign_budget',
        description: 'Modifica el presupuesto de una campaña publicitaria sujeta a las reglas del Budget Guard.',
        inputSchema: {
          type: 'object',
          properties: {
            platform: { type: 'string', enum: ['meta_ads', 'google_ads'], description: 'Plataforma objetivo' },
            campaignId: { type: 'string', description: 'ID de la campaña publicitaria' },
            oldBudget: { type: 'number', description: 'Presupuesto anterior en USD' },
            newBudget: { type: 'number', description: 'Nuevo presupuesto propuesto en USD' },
            confirmationCode: { type: 'string', description: 'Código de confirmación de seguridad si se requiere: CONFIRMAR' },
            metaAccountId: { type: 'string', description: 'Requerido para Meta. Formato: act_XXXXXXX' },
            googleCustomerId: { type: 'string', description: 'Requerido para Google. Formato: XXX-XXX-XXXX' }
          },
          required: ['platform', 'campaignId', 'oldBudget', 'newBudget', 'confirmationCode']
        }
      },
      {
        name: 'pause_campaign',
        description: 'Pausa inmediatamente una campaña publicitaria activa.',
        inputSchema: {
          type: 'object',
          properties: {
            platform: { type: 'string', enum: ['meta_ads', 'google_ads'] },
            campaignId: { type: 'string' },
            confirmationCode: { type: 'string', description: 'Confirmación: CONFIRMAR' }
          },
          required: ['platform', 'campaignId', 'confirmationCode']
        }
      },
      {
        name: 'resume_campaign',
        description: 'Reactiva una campaña publicitaria pausada.',
        inputSchema: {
          type: 'object',
          properties: {
            platform: { type: 'string', enum: ['meta_ads', 'google_ads'] },
            campaignId: { type: 'string' },
            confirmationCode: { type: 'string', description: 'Confirmación: CONFIRMAR' }
          },
          required: ['platform', 'campaignId', 'confirmationCode']
        }
      },
      {
        name: 'get_ad_creatives',
        description: 'Obtiene las creatividades y copies de anuncios asociados a una campaña publicitaria para auditorías de marca.',
        inputSchema: {
          type: 'object',
          properties: {
            platform: { type: 'string', enum: ['meta_ads', 'google_ads'] },
            campaignId: { type: 'string' }
          },
          required: ['platform', 'campaignId']
        }
      },
      {
        name: 'get_spend_alert',
        description: 'Evalúa si el gasto diario total actual se acerca a los límites del budget_guard.json.',
        inputSchema: {
          type: 'object',
          properties: {
            currentDailySpend: { type: 'number', description: 'Inversión realizada hoy en USD en total' }
          },
          required: ['currentDailySpend']
        }
      },
      {
        name: 'get_google_keywords',
        description: 'Obtiene el reporte de rendimiento por palabras clave para Google Ads (impresiones, clics, costo, conversiones).',
        inputSchema: {
          type: 'object',
          properties: {
            googleCustomerId: { type: 'string', description: 'ID de cliente de Google Ads: XXX-XXX-XXXX' }
          },
          required: ['googleCustomerId']
        }
      },
      {
        name: 'get_geo_performance',
        description: 'Obtiene métricas de pauta geolocalizada para optimización de presencia local (Google Ads).',
        inputSchema: {
          type: 'object',
          properties: {
            googleCustomerId: { type: 'string', description: 'ID de cliente de Google Ads: XXX-XXX-XXXX' }
          },
          required: ['googleCustomerId']
        }
      },
      {
        name: 'get_ga4_traffic_report',
        description: 'Obtiene reportes de tráfico web y conversiones de Google Analytics GA4 segmentados por origen/medio.',
        inputSchema: {
          type: 'object',
          properties: {
            ga4PropertyId: { type: 'string', description: 'Property ID de GA4' }
          },
          required: ['ga4PropertyId']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_campaigns_summary': {
        const { adPlatform, metaAccountId, googleCustomerId } = args as any;
        const results: CampaignSummary[] = [];

        if (!adPlatform || adPlatform === 'meta') {
          if (metaAccountId) {
            const metaRes = await getMetaCampaigns(metaAccountId);
            if (metaRes.success && metaRes.campaigns) {
              results.push(...metaRes.campaigns);
            }
          }
        }

        if (!adPlatform || adPlatform === 'google') {
          if (googleCustomerId) {
            const googleRes = await getGoogleCampaigns(googleCustomerId);
            if (googleRes.success && googleRes.campaigns) {
              results.push(...googleRes.campaigns);
            }
          }
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }]
        };
      }

      case 'update_campaign_budget': {
        const { platform, campaignId, oldBudget, newBudget, confirmationCode, metaAccountId, googleCustomerId } = args as any;

        if (confirmationCode !== 'CONFIRMAR') {
          throw new Error('Código de confirmación de seguridad incorrecto. Debes escribir "CONFIRMAR".');
        }

        // Validate via Budget Guard
        const validation = validateBudgetChange(campaignId, oldBudget, newBudget, 0);
        if (!validation.allowed) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Operación bloqueada por Budget Guard: ${validation.reason}` }]
          };
        }

        // Apply change
        if (platform === 'meta_ads') {
          const res = await updateMetaCampaignBudget(campaignId, newBudget);
          if (!res.success) throw new Error(res.error);
        } else if (platform === 'google_ads') {
          if (!googleCustomerId) throw new Error('Falta googleCustomerId para Google Ads.');
          const res = await updateGoogleCampaignBudget(googleCustomerId, campaignId, newBudget);
          if (!res.success) throw new Error(res.error);
        } else {
          throw new Error(`Plataforma no soportada: ${platform}`);
        }

        // Log to database budget_log
        logBudgetChange(campaignId, platform, oldBudget, newBudget);

        return {
          content: [
            {
              type: 'text',
              text: `Presupuesto modificado con éxito en ${platform}.\nCampaña: ${campaignId}\nDe: $${oldBudget} USD → A: $${newBudget} USD.\nOperación registrada en el log de auditoría.`
            }
          ]
        };
      }

      case 'pause_campaign': {
        const { platform, campaignId, confirmationCode } = args as any;
        if (confirmationCode !== 'CONFIRMAR') throw new Error('Se requiere código CONFIRMAR.');

        if (platform === 'meta_ads') {
          const res = await setMetaCampaignStatus(campaignId, 'PAUSED');
          if (!res.success) throw new Error(res.error);
        } else {
          throw new Error(`Pausa de campañas en ${platform} no implementada o requiere credenciales.`);
        }

        return {
          content: [{ type: 'text', text: `Campaña ${campaignId} en ${platform} pausada correctamente.` }]
        };
      }

      case 'resume_campaign': {
        const { platform, campaignId, confirmationCode } = args as any;
        if (confirmationCode !== 'CONFIRMAR') throw new Error('Se requiere código CONFIRMAR.');

        if (platform === 'meta_ads') {
          const res = await setMetaCampaignStatus(campaignId, 'ACTIVE');
          if (!res.success) throw new Error(res.error);
        } else {
          throw new Error(`Reactivación de campañas en ${platform} no implementada o requiere credenciales.`);
        }

        return {
          content: [{ type: 'text', text: `Campaña ${campaignId} en ${platform} reactivada correctamente.` }]
        };
      }

      case 'get_ad_creatives': {
        const { platform, campaignId } = args as any;
        if (platform === 'meta_ads') {
          const res = await getMetaAdCreatives(campaignId);
          if (!res.success) throw new Error(res.error);
          return { content: [{ type: 'text', text: JSON.stringify(res.creatives, null, 2) }] };
        } else {
          return { content: [{ type: 'text', text: 'Visualización de creatividades para Google Ads se encuentra simulada como vacía.' }] };
        }
      }

      case 'get_spend_alert': {
        const { currentDailySpend } = args as any;
        const config = getBudgetGuardConfig();
        const ratio = (currentDailySpend / config.maxDailySpend) * 100;
        let alert = false;
        let msg = `Consumo diario: $${currentDailySpend} / $${config.maxDailySpend} USD (${ratio.toFixed(1)}%).`;

        if (ratio >= config.alertThresholdPercent) {
          alert = true;
          msg = `⚠️ ALERTA CRÍTICA: Se ha superado el ${config.alertThresholdPercent}% del límite diario configurado. Gasto actual: $${currentDailySpend} USD. Límite: $${config.maxDailySpend} USD. Se recomienda auditar o pausar campañas.`;
        }

        return {
          content: [{ type: 'text', text: JSON.stringify({ isAlertActive: alert, message: msg, ratioPercent: ratio }, null, 2) }]
        };
      }

      case 'get_google_keywords': {
        const { googleCustomerId } = args as any;
        const res = await getGoogleKeywordsPerformance(googleCustomerId);
        if (!res.success) throw new Error(res.error);
        return { content: [{ type: 'text', text: JSON.stringify(res.keywords, null, 2) }] };
      }

      case 'get_geo_performance': {
        const { googleCustomerId } = args as any;
        const res = await getGoogleGeoPerformance(googleCustomerId);
        if (!res.success) throw new Error(res.error);
        return { content: [{ type: 'text', text: JSON.stringify(res.geoData, null, 2) }] };
      }

      case 'get_ga4_traffic_report': {
        const { ga4PropertyId } = args as any;
        const res = await getGA4TrafficReport(ga4PropertyId);
        if (!res.success) throw new Error(res.error);
        return { content: [{ type: 'text', text: JSON.stringify(res.traffic, null, 2) }] };
      }

      default:
        throw new Error(`Herramienta no encontrada: ${name}`);
    }
  } catch (err: any) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error: ${err.message}` }]
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('paid-ads-expert MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in paid-ads-expert server main:', error);
  process.exit(1);
});
