import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { BudgetGuard } from '../../../shared/types.js';

const configPath = join(__dirname, '../../../../config/budget_guard.json');
const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../../../rrssagente.db');

export function getBudgetGuardConfig(): BudgetGuard {
  try {
    const raw = readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading budget_guard.json, using defaults:', err);
    return {
      maxDailySpend: 100.0,
      maxSingleBudgetChange: 25.0,
      alertThresholdPercent: 80.0,
      requireConfirmation: true,
      cooldownMinutes: 60
    };
  }
}

export function validateBudgetChange(
  campaignId: string,
  oldBudget: number,
  newBudget: number,
  currentDailySpend: number
): { allowed: boolean; reason?: string } {
  const config = getBudgetGuardConfig();
  const diff = Math.abs(newBudget - oldBudget);

  // 1. Check max single budget change
  if (diff > config.maxSingleBudgetChange) {
    return {
      allowed: false,
      reason: `El cambio de presupuesto ($${diff}) supera el límite máximo permitido por operación ($${config.maxSingleBudgetChange}).`
    };
  }

  // 2. Check total spend cap limit
  if (newBudget > config.maxDailySpend) {
    return {
      allowed: false,
      reason: `El nuevo presupuesto ($${newBudget}) supera el límite de gasto diario general ($${config.maxDailySpend}).`
    };
  }

  // 3. Check cooldown check
  const db = new Database(dbPath);
  try {
    const row = db.prepare(`
      SELECT timestamp FROM budget_log
      WHERE campaign_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(campaignId) as { timestamp: string } | undefined;

    if (row) {
      const lastChange = new Date(row.timestamp).getTime();
      const diffMs = Date.now() - lastChange;
      const cooldownMs = config.cooldownMinutes * 60 * 1000;
      if (diffMs < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - diffMs) / (60 * 1000));
        return {
          allowed: false,
          reason: `Operación bloqueada por periodo de enfriamiento (cooldown). Faltan ${remainingMinutes} minutos para poder modificar esta campaña nuevamente.`
        };
      }
    }
  } catch (err) {
    console.error('Database log query error:', err);
  } finally {
    db.close();
  }

  return { allowed: true };
}

export function logBudgetChange(
  campaignId: string,
  platform: 'meta_ads' | 'google_ads',
  oldBudget: number,
  newBudget: number
): void {
  const db = new Database(dbPath);
  try {
    const stmt = db.prepare(`
      INSERT INTO budget_log (id, campaign_id, platform, old_budget, new_budget, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const id = 'log_' + Math.random().toString(36).substring(2, 11);
    stmt.run(id, campaignId, platform, oldBudget, newBudget, new Date().toISOString());
  } catch (err) {
    console.error('Failed to log budget change to database:', err);
  } finally {
    db.close();
  }
}
