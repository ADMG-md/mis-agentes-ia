import Database from 'better-sqlite3';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '../../../../.env') });

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../../../rrssagente.db');

export const db: Database.Database = new Database(dbPath, { verbose: console.log });
db.pragma('journal_mode = WAL');
