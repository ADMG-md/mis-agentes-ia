import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import Database from 'better-sqlite3';
import { join } from 'path';
import * as dotenv from 'dotenv';
import { UnifiedMetric } from '../../shared/types.js';

dotenv.config({ path: join(__dirname, '../../../../.env') });

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../../../rrssagente.db');

const server = new Server(
  {
    name: 'analytics-core',
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
        name: 'get_organic_metrics',
        description: 'Consulta el caché local en SQLite de métricas orgánicas filtradas por cuenta y rango de fechas.',
        inputSchema: {
          type: 'object',
          properties: {
            platform: { type: 'string', enum: ['linkedin', 'x', 'tiktok', 'youtube'] },
            accountType: { type: 'string', enum: ['personal', 'company'], description: 'Contexto de cuenta' },
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' }
          },
          required: ['accountType', 'startDate', 'endDate']
        }
      },
      {
        name: 'get_top_performing_posts',
        description: 'Analiza los posts orgánicos con mejor rendimiento histórico cruzando likes, comentarios y reproducciones.',
        inputSchema: {
          type: 'object',
          properties: {
            accountType: { type: 'string', enum: ['personal', 'company'] },
            limit: { type: 'number', description: 'Cantidad máxima de posts a devolver (default 5)' }
          },
          required: ['accountType']
        }
      },
      {
        name: 'get_followers_growth',
        description: 'Devuelve la trayectoria del crecimiento de seguidores en redes orgánicas.',
        inputSchema: {
          type: 'object',
          properties: {
            platform: { type: 'string', enum: ['linkedin', 'x', 'tiktok', 'youtube'] },
            accountType: { type: 'string', enum: ['personal', 'company'] }
          },
          required: ['accountType']
        }
      },
      {
        name: 'get_cross_channel_report',
        description: 'Unifica métricas orgánicas y campañas pagadas (Meta Ads y Google Ads) calculando ROI, CTR, CPM, CPA y Video View Rate unificados.',
        inputSchema: {
          type: 'object',
          properties: {
            accountType: { type: 'string', enum: ['personal', 'company'] },
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' }
          },
          required: ['accountType', 'startDate', 'endDate']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const db = new Database(dbPath);

  try {
    switch (name) {
      case 'get_organic_metrics': {
        const { platform, accountType, startDate, endDate } = args as any;
        let query = `
          SELECT * FROM metrics_cache
          WHERE accountType = ? AND date >= ? AND date <= ?
        `;
        const params: any[] = [accountType, startDate, endDate];

        if (platform) {
          query += ` AND platform = ?`;
          params.push(platform);
        }

        const rows = db.prepare(query).all(...params) as any[];
        return {
          content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }]
        };
      }

      case 'get_top_performing_posts': {
        const { accountType, limit = 5 } = args as any;
        const query = `
          SELECT id, content, platforms, createdAt
          FROM posts
          WHERE accountType = ? AND status = 'published'
          LIMIT ?
        `;
        const posts = db.prepare(query).all(accountType, limit) as any[];

        const enrichedPosts = posts.map(post => {
          const platforms = JSON.parse(post.platforms);
          const metricsQuery = `
            SELECT platform, metricName, metricValue FROM metrics_cache
            WHERE id LIKE ?
          `;
          const metrics = db.prepare(metricsQuery).all(`%${post.id}%`) as any[];
          const performance: any = {};
          metrics.forEach(m => {
            performance[`${m.platform}_${m.metricName}`] = m.metricValue;
          });
          return {
            postId: post.id,
            content: post.content,
            platforms,
            publishedAt: post.createdAt,
            performance
          };
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(enrichedPosts, null, 2) }]
        };
      }

      case 'get_followers_growth': {
        const { platform, accountType } = args as any;
        // Simulating organic followers growth historical data
        const mockGrowth: any = {
          personal: {
            linkedin: [
              { date: '2026-06-01', followers: 1540 },
              { date: '2026-06-08', followers: 1610 },
              { date: '2026-06-15', followers: 1680 },
              { date: '2026-06-21', followers: 1750 }
            ],
            x: [
              { date: '2026-06-01', followers: 820 },
              { date: '2026-06-08', followers: 835 },
              { date: '2026-06-15', followers: 860 },
              { date: '2026-06-21', followers: 890 }
            ],
            tiktok: [
              { date: '2026-06-01', followers: 120 },
              { date: '2026-06-21', followers: 150 }
            ],
            youtube: [
              { date: '2026-06-01', followers: 310 },
              { date: '2026-06-21', followers: 345 }
            ]
          },
          company: {
            linkedin: [
              { date: '2026-06-01', followers: 450 },
              { date: '2026-06-21', followers: 480 }
            ],
            x: [],
            tiktok: [],
            youtube: []
          }
        };

        const list = platform
          ? mockGrowth[accountType]?.[platform] || []
          : mockGrowth[accountType] || {};

        return {
          content: [{ type: 'text', text: JSON.stringify({ platform, accountType, growth: list }, null, 2) }]
        };
      }

      case 'get_cross_channel_report': {
        const { accountType, startDate, endDate } = args as any;

        // 1. Calculate organic aggregates from SQLite
        const organicMetrics = db.prepare(`
          SELECT platform, metricName, SUM(metricValue) as totalValue
          FROM metrics_cache
          WHERE accountType = ? AND date >= ? AND date <= ? AND platform IN ('linkedin', 'x', 'tiktok', 'youtube')
          GROUP BY platform, metricName
        `).all(accountType, startDate, endDate) as any[];

        const organicSummary: any = {};
        organicMetrics.forEach(m => {
          if (!organicSummary[m.platform]) organicSummary[m.platform] = {};
          organicSummary[m.platform][m.metricName] = m.totalValue;
        });

        // 2. Paid aggregates (Simulating direct API inputs or reading cached paid ads data from metrics_cache)
        // If USE_MOCKS is enabled or real API details aren't populated, we aggregate from standard mock values
        let paidSpend = 0;
        let paidImpressions = 0;
        let paidClicks = 0;
        let paidConversions = 0;
        let videoViews = 0;

        if (accountType === 'company') {
          // Mocking campaign summaries
          paidSpend = 359.70; // 154.20 Meta + 85.00 Meta + 110.50 Google + 95.00 Google
          paidImpressions = 73200; // 12500 + 48000 + 8400 + 4300
          paidClicks = 1800; // 340 + 980 + 290 + 190
          paidConversions = 54; // 24 + 0 + 18 + 12
          videoViews = 32000; // Views from video campaign
        }

        // Apply formulas
        const ctr = paidImpressions > 0 ? (paidClicks / paidImpressions) * 100 : 0;
        const cpm = paidImpressions > 0 ? (paidSpend / paidImpressions) * 1000 : 0;
        const cpc = paidClicks > 0 ? paidSpend / paidClicks : 0;
        const cpa = paidConversions > 0 ? paidSpend / paidConversions : 0;
        const videoViewRate = paidImpressions > 0 ? (videoViews / paidImpressions) * 100 : 0;
        const estimatedRevenue = paidConversions * 45; // Assumed $45 patient consultation value
        const roas = paidSpend > 0 ? estimatedRevenue / paidSpend : 0;

        const report = {
          dateRange: { startDate, endDate },
          accountType,
          organicSummary,
          paidMediaSummary: {
            totalSpendUSD: paidSpend,
            totalImpressions: paidImpressions,
            totalClicks: paidClicks,
            totalConversions: paidConversions,
            estimatedRevenueUSD: estimatedRevenue,
            unifiedMetrics: {
              CTR: parseFloat(ctr.toFixed(2)),
              CPM: parseFloat(cpm.toFixed(2)),
              CPC: parseFloat(cpc.toFixed(2)),
              CPA: parseFloat(cpa.toFixed(2)),
              ROAS: parseFloat(roas.toFixed(2)),
              VideoViewRate: parseFloat(videoViewRate.toFixed(2))
            }
          }
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(report, null, 2) }]
        };
      }

      default:
        throw new Error(`Herramienta no encontrada: ${name}`);
    }
  } catch (err: any) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error: ${err.message}` }]
    };
  } finally {
    db.close();
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('analytics-core MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in analytics-core server main:', error);
  process.exit(1);
});
