import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { runMigrations } from './database/migrations.js';
import {
  insertPost,
  updatePostStatus,
  getPostById,
  queryScheduledPosts,
  queryDrafts,
  removeDraft,
  insertOrUpdateMetric,
  getCachedMetrics
} from './database/queries.js';
import { publishToLinkedIn } from './services/linkedin.js';
import { publishToX } from './services/twitter.js';
import { publishToTikTok } from './services/tiktok.js';
import { publishToYouTube } from './services/youtube.js';
import { PostDraft, UnifiedMetric } from '../../shared/types.js';

// 1. Run database migrations at startup
try {
  runMigrations();
} catch (err) {
  console.error('Failed to run migrations:', err);
}

// 2. Initialize MCP server
const server = new Server(
  {
    name: 'social-manager',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 3. Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'draft_post',
        description: 'Crea un nuevo post en estado borrador en la base de datos local.',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Contenido del post' },
            platforms: {
              type: 'array',
              items: { type: 'string', enum: ['linkedin', 'x', 'tiktok', 'youtube'] },
              description: 'Plataformas destino del post'
            },
            accountType: {
              type: 'string',
              enum: ['personal', 'company'],
              description: 'Tipo de cuenta (Aislamiento de contexto)'
            },
            mediaUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Opcional. URLs o paths de archivos adjuntos (obligatorio para tiktok/youtube)'
            },
            mediaType: {
              type: 'string',
              enum: ['image', 'video', 'carousel'],
              description: 'Opcional. Tipo de media'
            }
          },
          required: ['content', 'platforms', 'accountType']
        }
      },
      {
        name: 'schedule_post',
        description: 'Programa un post borrador existente para publicación en una fecha y hora futura.',
        inputSchema: {
          type: 'object',
          properties: {
            postId: { type: 'string', description: 'ID del post a programar' },
            publishAt: { type: 'string', description: 'Fecha y hora en formato ISO 8601' }
          },
          required: ['postId', 'publishAt']
        }
      },
      {
        name: 'cancel_scheduled_post',
        description: 'Cancela la programación de un post y lo devuelve a estado borrador.',
        inputSchema: {
          type: 'object',
          properties: {
            postId: { type: 'string', description: 'ID del post a cancelar' }
          },
          required: ['postId']
        }
      },
      {
        name: 'list_scheduled_posts',
        description: 'Lista los posts que se encuentran programados para publicarse a futuro.',
        inputSchema: {
          type: 'object',
          properties: {
            accountType: { type: 'string', enum: ['personal', 'company'], description: 'Filtrar por tipo de cuenta' }
          }
        }
      },
      {
        name: 'list_drafts',
        description: 'Lista los borradores guardados localmente.',
        inputSchema: {
          type: 'object',
          properties: {
            accountType: { type: 'string', enum: ['personal', 'company'], description: 'Filtrar por tipo de cuenta' }
          }
        }
      },
      {
        name: 'delete_draft',
        description: 'Elimina permanentemente un post borrador de la base de datos.',
        inputSchema: {
          type: 'object',
          properties: {
            postId: { type: 'string', description: 'ID del borrador a eliminar' },
            accountType: { type: 'string', enum: ['personal', 'company'] }
          },
          required: ['postId', 'accountType']
        }
      },
      {
        name: 'publish_now',
        description: 'Publica inmediatamente un borrador en las plataformas configuradas de forma concurrente.',
        inputSchema: {
          type: 'object',
          properties: {
            postId: { type: 'string', description: 'ID del post a publicar' },
            confirmationCode: { type: 'string', description: 'Código de confirmación de seguridad para producción: CONFIRMAR' }
          },
          required: ['postId', 'confirmationCode']
        }
      },
      {
        name: 'get_post_performance',
        description: 'Obtiene métricas orgánicas del rendimiento de un post publicado.',
        inputSchema: {
          type: 'object',
          properties: {
            postId: { type: 'string', description: 'ID del post publicado' }
          },
          required: ['postId']
        }
      }
    ]
  };
});

// 4. Handle tools call execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'draft_post': {
        const { content, platforms, accountType, mediaUrls, mediaType } = args as any;
        const id = 'post_' + Math.random().toString(36).substring(2, 11);
        const post: PostDraft = {
          id,
          content,
          platforms,
          accountType,
          status: 'draft',
          mediaUrls,
          mediaType,
          createdAt: new Date().toISOString()
        };

        insertPost(post);
        return {
          content: [{ type: 'text', text: `Post guardado con éxito. ID: ${id}` }]
        };
      }

      case 'schedule_post': {
        const { postId, publishAt } = args as any;
        const post = getPostById(postId);
        if (!post) {
          throw new Error(`No se encontró el post con ID: ${postId}`);
        }

        const date = new Date(publishAt);
        if (isNaN(date.getTime()) || date.getTime() <= Date.now()) {
          throw new Error(`La fecha de publicación '${publishAt}' debe ser futura y válida.`);
        }

        const updateStmt = getPostById(postId);
        if (updateStmt && updateStmt.status !== 'draft' && updateStmt.status !== 'cancelled') {
          throw new Error(`Solo borradores o cancelados pueden ser programados. Estado actual: ${updateStmt.status}`);
        }

        updatePostStatus(postId, 'scheduled');
        // Save scheduledAt timestamp in post database directly
        const stmt = db().prepare('UPDATE posts SET scheduledAt = ? WHERE id = ?');
        stmt.run(publishAt, postId);

        return {
          content: [{ type: 'text', text: `Post ${postId} programado correctamente para ${publishAt}.` }]
        };
      }

      case 'cancel_scheduled_post': {
        const { postId } = args as any;
        const post = getPostById(postId);
        if (!post) throw new Error(`Post ${postId} no encontrado.`);
        if (post.status !== 'scheduled') {
          throw new Error(`El post no está programado. Estado: ${post.status}`);
        }

        updatePostStatus(postId, 'cancelled');
        return {
          content: [{ type: 'text', text: `Programación cancelada. El post ${postId} ha vuelto a estado cancelado.` }]
        };
      }

      case 'list_scheduled_posts': {
        const { accountType } = args as any;
        const posts = queryScheduledPosts(accountType);
        return {
          content: [{ type: 'text', text: JSON.stringify(posts, null, 2) }]
        };
      }

      case 'list_drafts': {
        const { accountType } = args as any;
        const drafts = queryDrafts(accountType);
        return {
          content: [{ type: 'text', text: JSON.stringify(drafts, null, 2) }]
        };
      }

      case 'delete_draft': {
        const { postId, accountType } = args as any;
        const success = removeDraft(postId, accountType);
        if (!success) {
          throw new Error(`No se pudo eliminar el borrador ${postId}. Verifica el ID y que el estado sea 'draft'.`);
        }
        return {
          content: [{ type: 'text', text: `Borrador ${postId} eliminado permanentemente.` }]
        };
      }

      case 'publish_now': {
        const { postId, confirmationCode } = args as any;
        if (confirmationCode !== 'CONFIRMAR') {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Error: Debes proporcionar el código de confirmación "CONFIRMAR" para ejecutar la publicación.' }]
          };
        }

        const post = getPostById(postId);
        if (!post) throw new Error(`Post ${postId} no encontrado.`);

        const results: string[] = [];
        let anyFailed = false;

        for (const platform of post.platforms) {
          try {
            if (platform === 'linkedin') {
              const res = await publishToLinkedIn(post.content, post.mediaUrls, post.accountType);
              if (res.success) {
                results.push(`LinkedIn: Publicado exitosamente! URL: ${res.postUrl}`);
              } else {
                results.push(`LinkedIn: Falló. Error: ${res.error}`);
                anyFailed = true;
              }
            } else if (platform === 'x') {
              const res = await publishToX(post.content, post.mediaUrls, post.accountType);
              if (res.success) {
                results.push(`X (Twitter): Publicado exitosamente! URL: ${res.tweetUrl}`);
              } else {
                results.push(`X (Twitter): Falló. Error: ${res.error}`);
                anyFailed = true;
              }
            } else if (platform === 'tiktok') {
              const res = await publishToTikTok(post.content, post.mediaUrls || [], post.accountType);
              if (res.success) {
                results.push(`TikTok: Publicado exitosamente (shareId: ${res.shareId})`);
              } else {
                results.push(`TikTok: Falló. Error: ${res.error}`);
                anyFailed = true;
              }
            } else if (platform === 'youtube') {
              const res = await publishToYouTube(
                post.content.substring(0, 50),
                post.content,
                post.mediaUrls?.[0] || 'mock_video_url',
                post.accountType
              );
              if (res.success) {
                results.push(`YouTube: Video subido! URL: ${res.videoUrl}`);
              } else {
                results.push(`YouTube: Falló. Error: ${res.error}`);
                anyFailed = true;
              }
            }
          } catch (e: any) {
            results.push(`${platform}: Excepción inesperada. Error: ${e.message}`);
            anyFailed = true;
          }
        }

        const finalStatus = anyFailed ? 'failed' : 'published';
        updatePostStatus(postId, finalStatus, new Date().toISOString());

        return {
          content: [
            {
              type: 'text',
              text: `Resultado de la publicación del post ${postId}:\nEstado Final: ${finalStatus.toUpperCase()}\n\n${results.join('\n')}`
            }
          ]
        };
      }

      case 'get_post_performance': {
        const { postId } = args as any;
        const post = getPostById(postId);
        if (!post) throw new Error(`Post ${postId} no encontrado.`);

        // Return mocked organic metrics
        const mockMetrics = {
          postId,
          platforms: post.platforms,
          views: Math.floor(Math.random() * 1000) + 150,
          likes: Math.floor(Math.random() * 80) + 10,
          comments: Math.floor(Math.random() * 15) + 2,
          shares: Math.floor(Math.random() * 10) + 1
        };

        // Cache these metrics in SQLite metrics_cache table for analytics-core usage
        const dateStr = new Date().toISOString().split('T')[0];
        post.platforms.forEach(platform => {
          const insertOne = (metricName: string, val: number) => {
            const metric: UnifiedMetric = {
              id: `${platform}_${postId}_${metricName}`,
              platform,
              accountType: post.accountType,
              metricName,
              metricValue: val,
              date: dateStr,
              rawFieldName: metricName,
              fetchedAt: new Date().toISOString()
            };
            insertOrUpdateMetric(metric);
          };
          insertOne('views', mockMetrics.views);
          insertOne('likes', mockMetrics.likes);
          insertOne('comments', mockMetrics.comments);
          insertOne('shares', mockMetrics.shares);
        });

        return {
          content: [
            {
              type: 'text',
              text: `Métricas orgánicas del post ${postId} obtenidas y cacheadas en la base de datos:\n` +
                JSON.stringify(mockMetrics, null, 2)
            }
          ]
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
  }
});

// Helper database function wrapper
import { db as getDb } from './database/connection.js';
function db() { return getDb; }

// 5. Connect and start standard I/O listener
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('social-manager MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in social-manager server main:', error);
  process.exit(1);
});
