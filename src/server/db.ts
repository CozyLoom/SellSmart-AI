import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'sellsmart.db');

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    auth_provider TEXT NOT NULL DEFAULT 'email',
    reset_token_hash TEXT,
    reset_token_expires TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'United States',
    currency TEXT NOT NULL DEFAULT 'USD',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    logo_url TEXT NOT NULL DEFAULT '',
    tax_rate REAL NOT NULL DEFAULT 0,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS business_settings (
    business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    number_format TEXT NOT NULL DEFAULT 'en-US',
    invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
    order_prefix TEXT NOT NULL DEFAULT 'ORD-',
    theme_preference TEXT NOT NULL DEFAULT 'dark',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE(business_id, name)
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    purchase_price REAL NOT NULL DEFAULT 0,
    selling_price REAL NOT NULL DEFAULT 0,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    image_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL,
    quantity_change INTEGER NOT NULL,
    previous_qty INTEGER NOT NULL,
    new_qty INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    reference_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    sale_number TEXT NOT NULL,
    idempotency_key TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    amount_paid REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    payment_status TEXT NOT NULL DEFAULT 'paid',
    total_cogs REAL NOT NULL DEFAULT 0,
    gross_profit REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    sale_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(business_id, idempotency_key)
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    unit_cost REAL NOT NULL,
    line_total REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    expense_date TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_amount REAL NOT NULL DEFAULT 0,
    inventory_deducted INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    order_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    unit_cost REAL NOT NULL,
    line_total REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    invoice_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    amount_paid REAL NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ai_generations (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    generation_type TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT '',
    tone TEXT NOT NULL DEFAULT '',
    style TEXT NOT NULL DEFAULT '',
    prompt_summary TEXT NOT NULL,
    output_text TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
    plan_tier TEXT NOT NULL DEFAULT 'free',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    status TEXT NOT NULL DEFAULT 'active',
    price_usd REAL NOT NULL DEFAULT 0,
    current_period_start TEXT NOT NULL,
    current_period_end TEXT NOT NULL,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    provider TEXT NOT NULL DEFAULT 'free_tier',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payment_history (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    amount_usd REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS usage_records (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    period_month TEXT NOT NULL,
    ai_generations_count INTEGER NOT NULL DEFAULT 0,
    invoices_count INTEGER NOT NULL DEFAULT 0,
    products_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(business_id, period_month)
  );
`);

export function uid(prefix = ''): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function getOrCreateUsageRecord(businessId: string) {
  const periodMonth = monthKey();
  const existing = db
    .prepare('SELECT * FROM usage_records WHERE business_id = ? AND period_month = ?')
    .get(businessId, periodMonth) as
    | { id: string; business_id: string; period_month: string; ai_generations_count: number; invoices_count: number; products_count: number }
    | undefined;

  if (existing) {
    const productCountRow = db
      .prepare('SELECT COUNT(*) AS cnt FROM products WHERE business_id = ?')
      .get(businessId) as { cnt: number };
    db.prepare('UPDATE usage_records SET products_count = ? WHERE id = ?').run(productCountRow.cnt, existing.id);
    return { ...existing, products_count: productCountRow.cnt };
  }

  const id = uid('usg');
  const productCountRow = db
    .prepare('SELECT COUNT(*) AS cnt FROM products WHERE business_id = ?')
    .get(businessId) as { cnt: number };

  db.prepare(
    'INSERT INTO usage_records (id, business_id, period_month, ai_generations_count, invoices_count, products_count) VALUES (?, ?, ?, 0, 0, ?)'
  ).run(id, businessId, periodMonth, productCountRow.cnt);

  return {
    id,
    business_id: businessId,
    period_month: periodMonth,
    ai_generations_count: 0,
    invoices_count: 0,
    products_count: productCountRow.cnt,
  };
}

export const PLAN_LIMITS = {
  free: {
    aiGenerationsPerMonth: 10,
    invoicesPerMonth: 5 as number | null,
    productsMax: 50 as number | null,
    priceMonthlyUsd: 0,
    priceAnnualUsd: 0,
  },
  pro: {
    aiGenerationsPerMonth: 250,
    invoicesPerMonth: null as number | null,
    productsMax: null as number | null,
    priceMonthlyUsd: 4.99,
    priceAnnualUsd: 49.9,
  },
  business: {
    aiGenerationsPerMonth: 1500,
    invoicesPerMonth: null as number | null,
    productsMax: null as number | null,
    priceMonthlyUsd: 9.99,
    priceAnnualUsd: 99.9,
  },
};
