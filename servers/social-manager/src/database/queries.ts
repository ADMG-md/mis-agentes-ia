import { db } from './connection.js';
import { PostDraft, UnifiedMetric } from '../../../shared/types.js';

export function insertPost(post: PostDraft): void {
  const stmt = db.prepare(`
    INSERT INTO posts (id, content, platforms, accountType, status, mediaUrls, mediaType, createdAt, scheduledAt, publishedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    post.id,
    post.content,
    JSON.stringify(post.platforms),
    post.accountType,
    post.status,
    post.mediaUrls ? JSON.stringify(post.mediaUrls) : null,
    post.mediaType || null,
    post.createdAt,
    post.scheduledAt || null,
    post.publishedAt || null
  );
}

export function updatePostStatus(id: string, status: string, publishedAt?: string): boolean {
  const stmt = db.prepare(`
    UPDATE posts
    SET status = ?, publishedAt = ?
    WHERE id = ?
  `);
  const result = stmt.run(status, publishedAt || null, id);
  return result.changes > 0;
}

export function getPostById(id: string): PostDraft | null {
  const stmt = db.prepare(`SELECT * FROM posts WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    content: row.content,
    platforms: JSON.parse(row.platforms),
    accountType: row.accountType,
    status: row.status,
    mediaUrls: row.mediaUrls ? JSON.parse(row.mediaUrls) : undefined,
    mediaType: row.mediaType || undefined,
    createdAt: row.createdAt,
    scheduledAt: row.scheduledAt || undefined,
    publishedAt: row.publishedAt || undefined
  };
}

export function queryScheduledPosts(accountType?: 'personal' | 'company'): PostDraft[] {
  let query = `SELECT * FROM posts WHERE status = 'scheduled'`;
  const params: any[] = [];
  if (accountType) {
    query += ` AND accountType = ?`;
    params.push(accountType);
  }
  query += ` ORDER BY scheduledAt ASC`;
  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as any[];
  return rows.map(row => ({
    id: row.id,
    content: row.content,
    platforms: JSON.parse(row.platforms),
    accountType: row.accountType,
    status: row.status,
    mediaUrls: row.mediaUrls ? JSON.parse(row.mediaUrls) : undefined,
    mediaType: row.mediaType || undefined,
    createdAt: row.createdAt,
    scheduledAt: row.scheduledAt || undefined,
    publishedAt: row.publishedAt || undefined
  }));
}

export function queryDrafts(accountType?: 'personal' | 'company'): PostDraft[] {
  let query = `SELECT * FROM posts WHERE status = 'draft'`;
  const params: any[] = [];
  if (accountType) {
    query += ` AND accountType = ?`;
    params.push(accountType);
  }
  query += ` ORDER BY createdAt DESC`;
  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as any[];
  return rows.map(row => ({
    id: row.id,
    content: row.content,
    platforms: JSON.parse(row.platforms),
    accountType: row.accountType,
    status: row.status,
    mediaUrls: row.mediaUrls ? JSON.parse(row.mediaUrls) : undefined,
    mediaType: row.mediaType || undefined,
    createdAt: row.createdAt,
    scheduledAt: row.scheduledAt || undefined,
    publishedAt: row.publishedAt || undefined
  }));
}

export function removeDraft(id: string, accountType: 'personal' | 'company'): boolean {
  const stmt = db.prepare(`
    DELETE FROM posts
    WHERE id = ? AND accountType = ? AND status = 'draft'
  `);
  const result = stmt.run(id, accountType);
  return result.changes > 0;
}

export function insertOrUpdateMetric(metric: UnifiedMetric): void {
  const stmt = db.prepare(`
    INSERT INTO metrics_cache (id, platform, accountType, metricName, metricValue, date, rawFieldName, fetchedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      metricValue = excluded.metricValue,
      fetchedAt = excluded.fetchedAt
  `);
  stmt.run(
    metric.id,
    metric.platform,
    metric.accountType,
    metric.metricName,
    metric.metricValue,
    metric.date,
    metric.rawFieldName,
    metric.fetchedAt
  );
}

export function getCachedMetrics(
  platform: string,
  accountType: string,
  startDate: string,
  endDate: string
): UnifiedMetric[] {
  const stmt = db.prepare(`
    SELECT * FROM metrics_cache
    WHERE platform = ? AND accountType = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `);
  const rows = stmt.all(platform, accountType, startDate, endDate) as any[];
  return rows.map(row => ({
    id: row.id,
    platform: row.platform,
    accountType: row.accountType,
    metricName: row.metricName,
    metricValue: row.metricValue,
    date: row.date,
    rawFieldName: row.rawFieldName,
    fetchedAt: row.fetchedAt
  }));
}
