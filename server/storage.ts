import { demoRequests } from '@shared/schema';
import type { DemoRequest, InsertDemoRequest } from '@shared/schema';
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

// Bootstrap the demo_requests table on first run
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS demo_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT NOT NULL,
    job_title TEXT,
    message TEXT,
    created_at TEXT NOT NULL
  )
`);

export const db = drizzle(sqlite);

export interface IStorage {
  createDemoRequest(req: InsertDemoRequest): Promise<DemoRequest>;
  listDemoRequests(): Promise<DemoRequest[]>;
}

export class DatabaseStorage implements IStorage {
  async createDemoRequest(req: InsertDemoRequest): Promise<DemoRequest> {
    return db
      .insert(demoRequests)
      .values({ ...req, createdAt: new Date().toISOString() })
      .returning()
      .get();
  }

  async listDemoRequests(): Promise<DemoRequest[]> {
    return db.select().from(demoRequests).all();
  }
}

export const storage = new DatabaseStorage();
