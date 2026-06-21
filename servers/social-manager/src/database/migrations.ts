import { db } from './connection.js';

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      platforms TEXT NOT NULL, -- JSON array string
      accountType TEXT NOT NULL CHECK(accountType IN ('personal', 'company')),
      status TEXT NOT NULL CHECK(status IN ('draft', 'scheduled', 'published', 'failed', 'cancelled')),
      mediaUrls TEXT, -- JSON array string
      mediaType TEXT, -- 'image' | 'video' | 'carousel'
      createdAt TEXT NOT NULL,
      scheduledAt TEXT,
      publishedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS metrics_cache (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL CHECK(platform IN ('linkedin', 'x', 'tiktok', 'youtube', 'meta_ads', 'google_ads', 'ga4')),
      accountType TEXT NOT NULL CHECK(accountType IN ('personal', 'company')),
      metricName TEXT NOT NULL,
      metricValue REAL NOT NULL,
      date TEXT NOT NULL, -- YYYY-MM-DD
      rawFieldName TEXT NOT NULL,
      fetchedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budget_log (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('meta_ads', 'google_ads')),
      old_budget REAL NOT NULL,
      new_budget REAL NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_posts_account_type ON posts(accountType);
    CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
    CREATE INDEX IF NOT EXISTS idx_metrics_cache_lookup ON metrics_cache(platform, accountType, date);
  `);
  console.log('Migrations completed successfully.');
}
