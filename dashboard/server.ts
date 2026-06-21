import express from 'express';
import { join } from 'path';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
const port = process.env.DASHBOARD_PORT || 3030;
const dbPath = process.env.DATABASE_PATH || join(__dirname, '../rrssagente.db');
const budgetGuardPath = join(__dirname, '../config/budget_guard.json');

app.use(express.json());

// Serve static assets
app.use(express.static(join(__dirname, '../../dashboard')));

// Endpoint: Fetch scheduled posts and drafts from SQLite
app.get('/api/posts', (req, res) => {
  let db;
  try {
    db = new Database(dbPath, { readonly: true });
    const rows = db.prepare('SELECT * FROM posts ORDER BY createdAt DESC').all() as any[];
    const parsedRows = rows.map(r => ({
      id: r.id,
      content: r.content,
      platforms: JSON.parse(r.platforms),
      accountType: r.accountType,
      status: r.status,
      mediaUrls: r.mediaUrls ? JSON.parse(r.mediaUrls) : undefined,
      mediaType: r.mediaType || undefined,
      createdAt: r.createdAt,
      scheduledAt: r.scheduledAt || undefined,
      publishedAt: r.publishedAt || undefined
    }));
    res.json(parsedRows);
  } catch (err: any) {
    console.error('Dashboard DB fetch posts error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (db) db.close();
  }
});

// Endpoint: Fetch budget modifications logs & spend limit checks
app.get('/api/budget-logs', (req, res) => {
  let db;
  try {
    db = new Database(dbPath, { readonly: true });
    const logs = db.prepare('SELECT * FROM budget_log ORDER BY timestamp DESC').all();

    // Check alert threshold ratio
    let maxDailySpend = 100.0;
    let alertThresholdPercent = 80.0;
    try {
      const configRaw = readFileSync(budgetGuardPath, 'utf8');
      const config = JSON.parse(configRaw);
      maxDailySpend = config.maxDailySpend;
      alertThresholdPercent = config.alertThresholdPercent;
    } catch (e) {
      console.warn('Failed to load budget_guard.json, using defaults.');
    }

    // Mock/simulate actual daily spend for ads
    const currentDailySpend = 65.50; // In production this would query campaign metrics API
    const ratio = (currentDailySpend / maxDailySpend) * 100;
    const isAlertActive = ratio >= alertThresholdPercent;
    const alertMessage = isAlertActive
      ? `Consumo diario en $${currentDailySpend} USD, superando el ${alertThresholdPercent}% del límite diario ($${maxDailySpend} USD).`
      : '';

    res.json({
      logs,
      isAlertActive,
      alertMessage,
      currentDailySpend,
      maxDailySpend
    });
  } catch (err: any) {
    console.error('Dashboard DB fetch logs error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (db) db.close();
  }
});

app.listen(port, () => {
  console.log(`rrssagente local Dashboard server running on http://localhost:${port}`);
});
