import crypto from 'node:crypto';
import express from 'express';
import {
  clearSessionCookie,
  hashPassword,
  requireAuth,
  requireBusiness,
  setSessionCookie,
  signSessionToken,
  verifyPassword,
  type AuthedRequest,
} from './auth.ts';
import { db, getOrCreateUsageRecord, nowIso, PLAN_LIMITS, uid } from './db.ts';
import { seedDemoWorkspaceData } from './demo.ts';
import {
  formatGeminiError,
  generateBusinessAdvice,
  generateMarketingContent,
  generatePosterImage,
} from './ai.ts';
import type { OrderStatus, PlanTier } from '../types/index.ts';

export const apiRouter = express.Router();

function isValidImageUrl(url: string): boolean {
  if (!url) return true;
  if (url.startsWith('/src/assets/images/')) return true;
  if (/^https?:\/\//i.test(url)) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(url) && url.length <= 2_800_000) return true;
  return false;
}

function mapBusinessRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    name: String(row.name),
    category: String(row.category),
    country: String(row.country),
    currency: String(row.currency),
    timezone: String(row.timezone),
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    address: String(row.address || ''),
    description: String(row.description || ''),
    logoUrl: String(row.logo_url || ''),
    taxRate: Number(row.tax_rate || 0),
    isDemo: Boolean(row.is_demo),
    createdAt: String(row.created_at),
  };
}

function getDateRangeBounds(range: string, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (range === 'today') {
    return { from: today, to: today };
  }
  if (range === 'week') {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 6);
    return { from: start.toISOString().slice(0, 10), to: today };
  }
  if (range === 'month') {
    return { from: `${today.slice(0, 7)}-01`, to: today };
  }
  if (range === 'last_month') {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  if (range === 'custom' && customFrom && customTo) {
    return { from: customFrom.slice(0, 10), to: customTo.slice(0, 10) };
  }
  return { from: '1970-01-01', to: '2999-12-31' };
}

// ---------------------------------------------------------------------------
// Auth & Onboarding
// ---------------------------------------------------------------------------
apiRouter.get('/auth/providers', (_req, res) => {
  res.json({
    googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
    smtpConfigured: Boolean(process.env.SMTP_HOST),
    paymentGatewayConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
  });
});

apiRouter.post('/auth/signup', (req, res) => {
  const { fullName, email, password } = req.body || {};
  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    res.status(400).json({ error: 'Please enter your full name.' });
    return;
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const userId = uid('usr');
  const createdAt = nowIso();
  db.prepare(
    'INSERT INTO users (id, full_name, email, password_hash, auth_provider, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, fullName.trim(), normalizedEmail, hashPassword(password), 'email', createdAt);

  const token = signSessionToken(userId, normalizedEmail);
  setSessionCookie(res, token);

  res.status(201).json({
    token,
    user: { id: userId, fullName: fullName.trim(), email: normalizedEmail, authProvider: 'email', createdAt },
    business: null,
  });
});

apiRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const row = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(normalizedEmail) as Record<string, unknown> | undefined;

  if (!row || !verifyPassword(password, String(row.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const user = {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    authProvider: String(row.auth_provider),
    createdAt: String(row.created_at),
  };
  const bizRow = db
    .prepare('SELECT * FROM businesses WHERE owner_user_id = ? ORDER BY created_at ASC LIMIT 1')
    .get(user.id) as Record<string, unknown> | undefined;

  const token = signSessionToken(user.id, user.email);
  setSessionCookie(res, token);

  res.json({
    token,
    user,
    business: bizRow ? mapBusinessRow(bizRow) : null,
  });
});

apiRouter.post('/auth/demo', (_req, res) => {
  const userId = uid('usr');
  const bizId = uid('biz');
  const now = nowIso();
  const demoEmail = `demo.${userId.slice(4, 12)}@sellsmart.demo`;

  db.prepare(
    'INSERT INTO users (id, full_name, email, password_hash, auth_provider, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, 'Demo Store Owner', demoEmail, hashPassword(crypto.randomBytes(16).toString('hex')), 'demo', now);

  db.prepare(`
    INSERT INTO businesses (
      id, owner_user_id, name, category, country, currency, timezone, phone, email, address, description, tax_rate, is_demo, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    bizId,
    userId,
    'Aurore Lifestyle Boutique (Demo)',
    'General merchandise',
    'United States',
    'USD',
    'America/New_York',
    '+1 415 555 0148',
    'hello@auroreboutique.demo',
    '420 Mercer Street, New York, NY',
    'Curated leather goods, wireless audio, and botanical skincare.',
    0,
    now
  );

  db.prepare(
    'INSERT INTO business_settings (business_id, date_format, number_format, invoice_prefix, order_prefix, theme_preference, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(bizId, 'YYYY-MM-DD', 'en-US', 'INV-', 'ORD-', 'dark', now);

  const periodEnd = new Date();
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 30);
  db.prepare(`
    INSERT INTO subscriptions (id, business_id, plan_tier, billing_cycle, status, price_usd, current_period_start, current_period_end, cancel_at_period_end, provider, created_at, updated_at)
    VALUES (?, ?, 'free', 'monthly', 'active', 0, ?, ?, 0, 'demo_workspace', ?, ?)
  `).run(uid('sub'), bizId, now, periodEnd.toISOString(), now, now);

  seedDemoWorkspaceData(bizId);

  const bizRow = db.prepare('SELECT * FROM businesses WHERE id = ?').get(bizId) as Record<string, unknown>;
  const token = signSessionToken(userId, demoEmail);
  setSessionCookie(res, token);

  res.status(201).json({
    token,
    user: { id: userId, fullName: 'Demo Store Owner', email: demoEmail, authProvider: 'demo', createdAt: now },
    business: mapBusinessRow(bizRow),
  });
});

apiRouter.post('/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

apiRouter.post('/auth/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Please provide your email address.' });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail) as { id: string } | undefined;

  if (!user) {
    res.json({
      ok: true,
      emailConfigured: Boolean(process.env.SMTP_HOST),
      message: 'If an account matches that email, a password reset code has been prepared.',
    });
    return;
  }

  const rawCode = crypto.randomInt(100000, 999999).toString();
  const tokenHash = crypto.createHash('sha256').update(rawCode).digest('hex');
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare('UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?').run(
    tokenHash,
    expires,
    user.id
  );

  const emailConfigured = Boolean(process.env.SMTP_HOST);
  res.json({
    ok: true,
    emailConfigured,
    message: emailConfigured
      ? 'Password reset code sent to your email.'
      : 'SMTP email delivery is not configured in this environment. Use the verification code below to test password reset.',
    previewResetCode: emailConfigured ? undefined : rawCode,
  });
});

apiRouter.post('/auth/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({ error: 'Valid email, 6-digit code, and new password (min 8 chars) are required.' });
    return;
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db
    .prepare('SELECT id, reset_token_hash, reset_token_expires FROM users WHERE email = ?')
    .get(normalizedEmail) as { id: string; reset_token_hash: string | null; reset_token_expires: string | null } | undefined;

  if (!user || !user.reset_token_hash || !user.reset_token_expires) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }
  if (new Date(user.reset_token_expires).getTime() < Date.now()) {
    res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    return;
  }

  const incomingHash = crypto.createHash('sha256').update(String(code).trim()).digest('hex');
  if (incomingHash !== user.reset_token_hash) {
    res.status(400).json({ error: 'Incorrect reset code.' });
    return;
  }

  db.prepare('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?').run(
    hashPassword(newPassword),
    user.id
  );

  res.json({ ok: true, message: 'Password updated successfully. You can now sign in.' });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthedRequest, res) => {
  const bizRow = db
    .prepare('SELECT * FROM businesses WHERE owner_user_id = ? ORDER BY created_at ASC LIMIT 1')
    .get(req.authUser!.id) as Record<string, unknown> | undefined;

  let settings = null;
  if (bizRow) {
    const setRow = db.prepare('SELECT * FROM business_settings WHERE business_id = ?').get(String(bizRow.id)) as
      | Record<string, unknown>
      | undefined;
    if (setRow) {
      settings = {
        businessId: String(setRow.business_id),
        dateFormat: String(setRow.date_format),
        numberFormat: String(setRow.number_format),
        invoicePrefix: String(setRow.invoice_prefix),
        orderPrefix: String(setRow.order_prefix),
        themePreference: String(setRow.theme_preference) as 'dark' | 'light',
      };
    }
  }

  res.json({
    user: req.authUser,
    business: bizRow ? mapBusinessRow(bizRow) : null,
    settings,
  });
});

apiRouter.patch('/auth/profile', requireAuth, (req: AuthedRequest, res) => {
  const { fullName } = req.body || {};
  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }
  db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(fullName.trim(), req.authUser!.id);
  res.json({ ok: true, fullName: fullName.trim() });
});

// ---------------------------------------------------------------------------
// Business Onboarding & Settings
// ---------------------------------------------------------------------------
apiRouter.post('/business/register', requireAuth, (req: AuthedRequest, res) => {
  const { name, category, country, currency, timezone, phone, email, address, description, taxRate, loadDemo } =
    req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Business name is required.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM businesses WHERE owner_user_id = ? LIMIT 1')
    .get(req.authUser!.id);
  if (existing) {
    res.status(409).json({ error: 'A business workspace already exists for this account.' });
    return;
  }

  const bizId = uid('biz');
  const now = nowIso();
  db.prepare(`
    INSERT INTO businesses (
      id, owner_user_id, name, category, country, currency, timezone, phone, email, address, description, tax_rate, is_demo, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bizId,
    req.authUser!.id,
    name.trim(),
    String(category || 'General merchandise'),
    String(country || 'United States'),
    String(currency || 'USD'),
    String(timezone || 'UTC'),
    String(phone || ''),
    String(email || req.authUser!.email),
    String(address || ''),
    String(description || ''),
    Number(taxRate || 0),
    loadDemo ? 1 : 0,
    now
  );

  db.prepare(
    'INSERT INTO business_settings (business_id, date_format, number_format, invoice_prefix, order_prefix, theme_preference, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(bizId, 'YYYY-MM-DD', 'en-US', 'INV-', 'ORD-', 'dark', now);

  const periodEnd = new Date();
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 30);
  db.prepare(`
    INSERT INTO subscriptions (id, business_id, plan_tier, billing_cycle, status, price_usd, current_period_start, current_period_end, cancel_at_period_end, provider, created_at, updated_at)
    VALUES (?, ?, 'free', 'monthly', 'active', 0, ?, ?, 0, 'free_tier', ?, ?)
  `).run(uid('sub'), bizId, now, periodEnd.toISOString(), now, now);

  if (loadDemo) {
    seedDemoWorkspaceData(bizId);
  }

  const bizRow = db.prepare('SELECT * FROM businesses WHERE id = ?').get(bizId) as Record<string, unknown>;
  res.status(201).json({ business: mapBusinessRow(bizRow) });
});

apiRouter.patch('/business', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const { name, category, country, currency, timezone, phone, email, address, description, logoUrl, taxRate, settings } =
    req.body || {};

  if (logoUrl && !isValidImageUrl(String(logoUrl))) {
    res.status(400).json({ error: 'Invalid business logo image format or file exceeds 2MB.' });
    return;
  }

  const current = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId!) as Record<string, unknown>;
  db.prepare(`
    UPDATE businesses SET
      name = ?, category = ?, country = ?, currency = ?, timezone = ?,
      phone = ?, email = ?, address = ?, description = ?, logo_url = ?, tax_rate = ?
    WHERE id = ?
  `).run(
    name ? String(name).trim() : String(current.name),
    category ? String(category) : String(current.category),
    country ? String(country) : String(current.country),
    currency ? String(currency) : String(current.currency),
    timezone ? String(timezone) : String(current.timezone),
    phone !== undefined ? String(phone) : String(current.phone),
    email !== undefined ? String(email) : String(current.email),
    address !== undefined ? String(address) : String(current.address),
    description !== undefined ? String(description) : String(current.description),
    logoUrl !== undefined ? String(logoUrl) : String(current.logo_url),
    taxRate !== undefined ? Math.max(0, Math.min(100, Number(taxRate))) : Number(current.tax_rate),
    req.businessId!
  );

  if (settings) {
    db.prepare(`
      UPDATE business_settings SET
        date_format = COALESCE(?, date_format),
        number_format = COALESCE(?, number_format),
        invoice_prefix = COALESCE(?, invoice_prefix),
        order_prefix = COALESCE(?, order_prefix),
        theme_preference = COALESCE(?, theme_preference),
        updated_at = ?
      WHERE business_id = ?
    `).run(
      settings.dateFormat ?? null,
      settings.numberFormat ?? null,
      settings.invoicePrefix ?? null,
      settings.orderPrefix ?? null,
      settings.themePreference ?? null,
      nowIso(),
      req.businessId!
    );
  }

  const updated = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId!) as Record<string, unknown>;
  const updatedSettings = db
    .prepare('SELECT * FROM business_settings WHERE business_id = ?')
    .get(req.businessId!) as Record<string, unknown>;

  res.json({
    business: mapBusinessRow(updated),
    settings: {
      businessId: String(updatedSettings.business_id),
      dateFormat: String(updatedSettings.date_format),
      numberFormat: String(updatedSettings.number_format),
      invoicePrefix: String(updatedSettings.invoice_prefix),
      orderPrefix: String(updatedSettings.order_prefix),
      themePreference: String(updatedSettings.theme_preference),
    },
  });
});

apiRouter.post('/business/load-demo', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  seedDemoWorkspaceData(req.businessId!);
  const updated = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId!) as Record<string, unknown>;
  res.json({ ok: true, business: mapBusinessRow(updated) });
});

apiRouter.post('/business/clear-data', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE business_id = ?)').run(bId);
    db.prepare('DELETE FROM invoices WHERE business_id = ?').run(bId);
    db.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id = ?)').run(bId);
    db.prepare('DELETE FROM orders WHERE business_id = ?').run(bId);
    db.prepare('DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE business_id = ?)').run(bId);
    db.prepare('DELETE FROM sales WHERE business_id = ?').run(bId);
    db.prepare('DELETE FROM inventory_movements WHERE business_id = ?').run(bId);
    db.prepare('DELETE FROM expenses WHERE business_id = ?').run(bId);
    db.prepare('DELETE FROM products WHERE business_id = ?').run(bId);
    db.prepare('DELETE FROM categories WHERE business_id = ?').run(bId);
    db.prepare('DELETE FROM customers WHERE business_id = ?').run(bId);
    db.prepare('UPDATE businesses SET is_demo = 0 WHERE id = ?').run(bId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  const updated = db.prepare('SELECT * FROM businesses WHERE id = ?').get(bId) as Record<string, unknown>;
  res.json({ ok: true, business: mapBusinessRow(updated) });
});

// ---------------------------------------------------------------------------
// Dashboard & Analytics
// ---------------------------------------------------------------------------
apiRouter.get('/dashboard', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const range = String(req.query.range || 'month');
  const customFrom = req.query.from ? String(req.query.from) : undefined;
  const customTo = req.query.to ? String(req.query.to) : undefined;
  const { from, to } = getDateRangeBounds(range, customFrom, customTo);

  const salesAgg = db
    .prepare(
      `SELECT COALESCE(SUM(total_amount),0) AS revenue,
              COALESCE(SUM(amount_paid),0) AS collected,
              COALESCE(SUM(total_cogs),0) AS cogs,
              COALESCE(SUM(gross_profit),0) AS gross_profit
       FROM sales WHERE business_id = ? AND sale_date >= ? AND sale_date <= ?`
    )
    .get(bId, from, to) as Record<string, number>;

  const expAgg = db
    .prepare(
      `SELECT COALESCE(SUM(amount),0) AS total_expenses
       FROM expenses WHERE business_id = ? AND expense_date >= ? AND expense_date <= ?`
    )
    .get(bId, from, to) as { total_expenses: number };

  const orderAgg = db
    .prepare(
      `SELECT COUNT(*) AS total_orders
       FROM orders WHERE business_id = ? AND order_date >= ? AND order_date <= ?`
    )
    .get(bId, from, to) as { total_orders: number };

  const prodAgg = db
    .prepare(
      `SELECT COUNT(*) AS total_products,
              COALESCE(SUM(CASE WHEN stock_qty <= low_stock_threshold AND stock_qty > 0 THEN 1 ELSE 0 END),0) AS low_stock_count,
              COALESCE(SUM(CASE WHEN stock_qty = 0 THEN 1 ELSE 0 END),0) AS out_of_stock_count,
              COALESCE(SUM(purchase_price * stock_qty),0) AS inventory_cost_value
       FROM products WHERE business_id = ?`
    )
    .get(bId) as Record<string, number>;

  const dailyRows = db
    .prepare(
      `SELECT sale_date AS dt, COALESCE(SUM(total_amount),0) AS rev, COALESCE(SUM(gross_profit),0) AS gp
       FROM sales WHERE business_id = ? AND sale_date >= ? AND sale_date <= ?
       GROUP BY sale_date ORDER BY sale_date ASC`
    )
    .all(bId, from, to) as { dt: string; rev: number; gp: number }[];

  const dailyExpRows = db
    .prepare(
      `SELECT expense_date AS dt, COALESCE(SUM(amount),0) AS exp
       FROM expenses WHERE business_id = ? AND expense_date >= ? AND expense_date <= ?
       GROUP BY expense_date`
    )
    .all(bId, from, to) as { dt: string; exp: number }[];
  const expByDate = new Map(dailyExpRows.map((r) => [r.dt, r.exp]));
  const allDates = Array.from(new Set([...dailyRows.map((r) => r.dt), ...dailyExpRows.map((r) => r.dt)])).sort();
  const salesByDate = new Map(dailyRows.map((r) => [r.dt, r]));

  const chartSeries = allDates.map((dt) => {
    const s = salesByDate.get(dt);
    const e = expByDate.get(dt) || 0;
    const rev = s?.rev || 0;
    const gp = s?.gp || 0;
    return {
      label: dt,
      revenue: Number(rev.toFixed(2)),
      expenses: Number(e.toFixed(2)),
      netProfit: Number((gp - e).toFixed(2)),
    };
  });

  const monthlySales = db
    .prepare(
      `SELECT substr(sale_date, 1, 7) AS ym, COALESCE(SUM(total_amount),0) AS rev, COALESCE(SUM(gross_profit),0) AS gp
       FROM sales WHERE business_id = ? GROUP BY ym ORDER BY ym ASC LIMIT 12`
    )
    .all(bId) as { ym: string; rev: number; gp: number }[];
  const monthlyExp = db
    .prepare(
      `SELECT substr(expense_date, 1, 7) AS ym, COALESCE(SUM(amount),0) AS exp
       FROM expenses WHERE business_id = ? GROUP BY ym`
    )
    .all(bId) as { ym: string; exp: number }[];
  const mExpMap = new Map(monthlyExp.map((r) => [r.ym, r.exp]));
  const mSalesMap = new Map(monthlySales.map((r) => [r.ym, r]));
  const months = Array.from(new Set([...monthlySales.map((m) => m.ym), ...monthlyExp.map((m) => m.ym)])).sort();
  const monthlySeries = months.map((ym) => {
    const s = mSalesMap.get(ym);
    const e = mExpMap.get(ym) || 0;
    return {
      month: ym,
      revenue: Number((s?.rev || 0).toFixed(2)),
      expenses: Number(e.toFixed(2)),
      profit: Number(((s?.gp || 0) - e).toFixed(2)),
    };
  });

  const topProducts = db
    .prepare(
      `SELECT si.product_id AS productId, si.product_name AS name,
              COALESCE(SUM(si.quantity),0) AS unitsSold,
              COALESCE(SUM(si.line_total),0) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.business_id = ? AND s.sale_date >= ? AND s.sale_date <= ?
       GROUP BY si.product_id, si.product_name
       ORDER BY revenue DESC LIMIT 5`
    )
    .all(bId, from, to);

  const lowStockProducts = db
    .prepare(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.business_id = ? AND p.stock_qty <= p.low_stock_threshold
       ORDER BY p.stock_qty ASC LIMIT 8`
    )
    .all(bId)
    .map(mapProductRow);

  const recentSales = getSalesWithItems(bId, 5);
  const recentOrders = getOrdersWithItems(bId, 5);

  const grossRevenue = Number((salesAgg.revenue || 0).toFixed(2));
  const cashCollected = Number((salesAgg.collected || 0).toFixed(2));
  const cogs = Number((salesAgg.cogs || 0).toFixed(2));
  const grossProfit = Number((salesAgg.gross_profit || 0).toFixed(2));
  const totalExpenses = Number((expAgg.total_expenses || 0).toFixed(2));
  const netProfit = Number((grossProfit - totalExpenses).toFixed(2));

  res.json({
    metrics: {
      grossRevenue,
      cashCollected,
      outstandingPayments: Number(Math.max(0, grossRevenue - cashCollected).toFixed(2)),
      cogs,
      grossProfit,
      totalExpenses,
      netProfit,
      totalOrders: orderAgg.total_orders || 0,
      totalProducts: prodAgg.total_products || 0,
      lowStockCount: prodAgg.low_stock_count || 0,
      outOfStockCount: prodAgg.out_of_stock_count || 0,
      inventoryCostValue: Number((prodAgg.inventory_cost_value || 0).toFixed(2)),
    },
    chartSeries,
    monthlySeries,
    topProducts,
    lowStockProducts,
    recentSales,
    recentOrders,
  });
});

apiRouter.get('/analytics', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const range = String(req.query.range || 'all');
  const { from, to } = getDateRangeBounds(
    range,
    req.query.from ? String(req.query.from) : undefined,
    req.query.to ? String(req.query.to) : undefined
  );

  const salesByCategory = db
    .prepare(
      `SELECT COALESCE(c.name, 'Uncategorized') AS category,
              COALESCE(SUM(si.quantity),0) AS unitsSold,
              COALESCE(SUM(si.line_total),0) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE s.business_id = ? AND s.sale_date >= ? AND s.sale_date <= ?
       GROUP BY COALESCE(c.name, 'Uncategorized')
       ORDER BY revenue DESC`
    )
    .all(bId, from, to);

  const expenseBreakdown = db
    .prepare(
      `SELECT category, COALESCE(SUM(amount),0) AS amount, COUNT(*) AS entries
       FROM expenses
       WHERE business_id = ? AND expense_date >= ? AND expense_date <= ?
       GROUP BY category ORDER BY amount DESC`
    )
    .all(bId, from, to);

  const bestSellingProducts = db
    .prepare(
      `SELECT si.product_name AS name,
              COALESCE(SUM(si.quantity),0) AS unitsSold,
              COALESCE(SUM(si.line_total),0) AS revenue,
              COALESCE(SUM(si.line_total - (si.quantity * si.unit_cost)),0) AS profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.business_id = ? AND s.sale_date >= ? AND s.sale_date <= ?
       GROUP BY si.product_name
       ORDER BY revenue DESC LIMIT 10`
    )
    .all(bId, from, to);

  const customerTrends = db
    .prepare(
      `SELECT c.id, c.name, COUNT(s.id) AS orders, COALESCE(SUM(s.total_amount),0) AS totalSpent,
              MAX(s.sale_date) AS lastPurchase
       FROM customers c
       LEFT JOIN sales s ON s.customer_id = c.id AND s.sale_date >= ? AND s.sale_date <= ?
       WHERE c.business_id = ?
       GROUP BY c.id
       ORDER BY totalSpent DESC LIMIT 10`
    )
    .all(from, to, bId);

  const inventoryHealth = db
    .prepare(
      `SELECT name, sku, stock_qty AS stockQty, low_stock_threshold AS threshold,
              purchase_price AS purchasePrice, selling_price AS sellingPrice,
              (purchase_price * stock_qty) AS costValue,
              (selling_price * stock_qty) AS retailValue
       FROM products WHERE business_id = ? ORDER BY costValue DESC LIMIT 20`
    )
    .all(bId);

  res.json({
    salesByCategory,
    expenseBreakdown,
    bestSellingProducts,
    customerTrends,
    inventoryHealth,
  });
});

// ---------------------------------------------------------------------------
// Categories & Products & Inventory
// ---------------------------------------------------------------------------
function mapProductRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryName: row.category_name ? String(row.category_name) : 'Uncategorized',
    name: String(row.name),
    sku: String(row.sku),
    purchasePrice: Number(row.purchase_price || 0),
    sellingPrice: Number(row.selling_price || 0),
    stockQty: Number(row.stock_qty || 0),
    lowStockThreshold: Number(row.low_stock_threshold ?? 5),
    imageUrl: String(row.image_url || ''),
    description: String(row.description || ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

apiRouter.get('/categories', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM categories WHERE business_id = ? ORDER BY name ASC')
    .all(req.businessId!) as Record<string, unknown>[];
  res.json(
    rows.map((r) => ({
      id: String(r.id),
      businessId: String(r.business_id),
      name: String(r.name),
      description: String(r.description || ''),
      createdAt: String(r.created_at),
    }))
  );
});

apiRouter.post('/categories', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const { name, description } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }
  const existing = db
    .prepare('SELECT id FROM categories WHERE business_id = ? AND lower(name) = lower(?)')
    .get(req.businessId!, name.trim());
  if (existing) {
    res.status(409).json({ error: 'Category already exists.' });
    return;
  }
  const id = uid('cat');
  const createdAt = nowIso();
  db.prepare('INSERT INTO categories (id, business_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    req.businessId!,
    name.trim(),
    String(description || ''),
    createdAt
  );
  res.status(201).json({ id, businessId: req.businessId!, name: name.trim(), description: String(description || ''), createdAt });
});

apiRouter.delete('/categories/:id', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM categories WHERE id = ? AND business_id = ?').run(req.params.id, req.businessId!);
  res.json({ ok: true });
});

apiRouter.get('/products', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.business_id = ? ORDER BY p.updated_at DESC`
    )
    .all(req.businessId!) as Record<string, unknown>[];
  res.json(rows.map(mapProductRow));
});

apiRouter.post('/products', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const sub = db.prepare('SELECT plan_tier FROM subscriptions WHERE business_id = ?').get(bId) as { plan_tier: PlanTier } | undefined;
  const tier: PlanTier = sub?.plan_tier || 'free';
  const maxProducts = PLAN_LIMITS[tier].productsMax;
  if (maxProducts !== null) {
    const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM products WHERE business_id = ?').get(bId) as { cnt: number };
    if (countRow.cnt >= maxProducts) {
      res.status(403).json({
        error: `Free plan limit of ${maxProducts} products reached. Upgrade to Pro for unlimited product records.`,
      });
      return;
    }
  }

  const { name, sku, categoryId, purchasePrice, sellingPrice, stockQty, lowStockThreshold, imageUrl, description } =
    req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Product name is required.' });
    return;
  }
  if (imageUrl && !isValidImageUrl(String(imageUrl))) {
    res.status(400).json({ error: 'Invalid product image format or file exceeds 2MB.' });
    return;
  }

  const id = uid('prd');
  const now = nowIso();
  const safeSku = String(sku || `SKU-${Math.floor(10000 + Math.random() * 90000)}`).trim();
  const qty = Math.max(0, Math.round(Number(stockQty || 0)));
  const cost = Math.max(0, Number(purchasePrice || 0));
  const price = Math.max(0, Number(sellingPrice || 0));
  const threshold = Math.max(0, Math.round(Number(lowStockThreshold ?? 5)));

  db.prepare(`
    INSERT INTO products (
      id, business_id, category_id, name, sku, purchase_price, selling_price,
      stock_qty, low_stock_threshold, image_url, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    bId,
    categoryId || null,
    name.trim(),
    safeSku,
    cost,
    price,
    qty,
    threshold,
    String(imageUrl || ''),
    String(description || ''),
    now,
    now
  );

  if (qty > 0) {
    db.prepare(`
      INSERT INTO inventory_movements (
        id, business_id, product_id, movement_type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at
      ) VALUES (?, ?, ?, 'initial', ?, 0, ?, 'Initial product stock', ?, ?)
    `).run(uid('mov'), bId, id, qty, qty, id, now);
  }

  const created = db
    .prepare(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`
    )
    .get(id) as Record<string, unknown>;
  res.status(201).json(mapProductRow(created));
});

apiRouter.patch('/products/:id', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const existing = db
    .prepare('SELECT * FROM products WHERE id = ? AND business_id = ?')
    .get(req.params.id, bId) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const { name, sku, categoryId, purchasePrice, sellingPrice, stockQty, lowStockThreshold, imageUrl, description } =
    req.body || {};

  if (imageUrl && !isValidImageUrl(String(imageUrl))) {
    res.status(400).json({ error: 'Invalid product image format or file exceeds 2MB.' });
    return;
  }

  const now = nowIso();
  const prevQty = Number(existing.stock_qty || 0);
  const nextQty = stockQty !== undefined ? Math.max(0, Math.round(Number(stockQty))) : prevQty;

  db.prepare(`
    UPDATE products SET
      name = ?, sku = ?, category_id = ?, purchase_price = ?, selling_price = ?,
      stock_qty = ?, low_stock_threshold = ?, image_url = ?, description = ?, updated_at = ?
    WHERE id = ? AND business_id = ?
  `).run(
    name ? String(name).trim() : String(existing.name),
    sku ? String(sku).trim() : String(existing.sku),
    categoryId !== undefined ? (categoryId ? String(categoryId) : null) : (existing.category_id ? String(existing.category_id) : null),
    purchasePrice !== undefined ? Math.max(0, Number(purchasePrice)) : Number(existing.purchase_price),
    sellingPrice !== undefined ? Math.max(0, Number(sellingPrice)) : Number(existing.selling_price),
    nextQty,
    lowStockThreshold !== undefined ? Math.max(0, Math.round(Number(lowStockThreshold))) : Number(existing.low_stock_threshold),
    imageUrl !== undefined ? String(imageUrl) : String(existing.image_url),
    description !== undefined ? String(description) : String(existing.description),
    now,
    req.params.id,
    bId
  );

  if (nextQty !== prevQty) {
    const diff = nextQty - prevQty;
    db.prepare(`
      INSERT INTO inventory_movements (
        id, business_id, product_id, movement_type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uid('mov'),
      bId,
      req.params.id,
      diff > 0 ? 'restock' : 'adjustment',
      diff,
      prevQty,
      nextQty,
      'Manual product stock edit',
      req.params.id,
      now
    );
  }

  const updated = db
    .prepare(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`
    )
    .get(req.params.id) as Record<string, unknown>;
  res.json(mapProductRow(updated));
});

apiRouter.post('/products/:id/adjust-stock', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const { delta, reason } = req.body || {};
  const change = Math.round(Number(delta || 0));
  if (!change) {
    res.status(400).json({ error: 'Stock adjustment quantity cannot be zero.' });
    return;
  }

  const existing = db
    .prepare('SELECT * FROM products WHERE id = ? AND business_id = ?')
    .get(req.params.id, bId) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const prevQty = Number(existing.stock_qty || 0);
  const newQty = Math.max(0, prevQty + change);
  const now = nowIso();

  db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ? AND business_id = ?').run(
    newQty,
    now,
    req.params.id,
    bId
  );
  db.prepare(`
    INSERT INTO inventory_movements (
      id, business_id, product_id, movement_type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uid('mov'),
    bId,
    req.params.id,
    change > 0 ? 'restock' : 'adjustment',
    newQty - prevQty,
    prevQty,
    newQty,
    String(reason || (change > 0 ? 'Stock replenishment' : 'Stock write-off')),
    req.params.id,
    now
  );

  const updated = db
    .prepare(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`
    )
    .get(req.params.id) as Record<string, unknown>;
  res.json(mapProductRow(updated));
});

apiRouter.delete('/products/:id', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM products WHERE id = ? AND business_id = ?').run(req.params.id, req.businessId!);
  res.json({ ok: true });
});

apiRouter.get('/inventory/movements', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT m.*, p.name AS product_name FROM inventory_movements m
       LEFT JOIN products p ON p.id = m.product_id
       WHERE m.business_id = ? ORDER BY m.created_at DESC LIMIT 80`
    )
    .all(req.businessId!) as Record<string, unknown>[];
  res.json(
    rows.map((r) => ({
      id: String(r.id),
      businessId: String(r.business_id),
      productId: String(r.product_id),
      productName: r.product_name ? String(r.product_name) : 'Deleted Product',
      movementType: String(r.movement_type),
      quantityChange: Number(r.quantity_change),
      previousQty: Number(r.previous_qty),
      newQty: Number(r.new_qty),
      reason: String(r.reason || ''),
      referenceId: String(r.reference_id || ''),
      createdAt: String(r.created_at),
    }))
  );
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
apiRouter.get('/customers', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const rows = db
    .prepare(
      `SELECT c.*,
              COALESCE((SELECT SUM(s.total_amount) FROM sales s WHERE s.customer_id = c.id), 0) AS total_purchases,
              (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id) + (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
              COALESCE((SELECT SUM(MAX(0, s.total_amount - s.amount_paid)) FROM sales s WHERE s.customer_id = c.id), 0) AS outstanding_balance,
              (SELECT MAX(s.sale_date) FROM sales s WHERE s.customer_id = c.id) AS last_purchase_date
       FROM customers c
       WHERE c.business_id = ?
       ORDER BY total_purchases DESC, c.created_at DESC`
    )
    .all(bId) as Record<string, unknown>[];

  res.json(
    rows.map((r) => ({
      id: String(r.id),
      businessId: String(r.business_id),
      name: String(r.name),
      phone: String(r.phone || ''),
      email: String(r.email || ''),
      address: String(r.address || ''),
      notes: String(r.notes || ''),
      totalPurchases: Number(r.total_purchases || 0),
      orderCount: Number(r.order_count || 0),
      outstandingBalance: Number(r.outstanding_balance || 0),
      lastPurchaseDate: r.last_purchase_date ? String(r.last_purchase_date) : null,
      createdAt: String(r.created_at),
    }))
  );
});

apiRouter.post('/customers', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const { name, phone, email, address, notes } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Customer name is required.' });
    return;
  }
  const id = uid('cus');
  const createdAt = nowIso();
  db.prepare(
    'INSERT INTO customers (id, business_id, name, phone, email, address, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.businessId!, name.trim(), String(phone || ''), String(email || ''), String(address || ''), String(notes || ''), createdAt);

  res.status(201).json({
    id,
    businessId: req.businessId!,
    name: name.trim(),
    phone: String(phone || ''),
    email: String(email || ''),
    address: String(address || ''),
    notes: String(notes || ''),
    totalPurchases: 0,
    orderCount: 0,
    outstandingBalance: 0,
    lastPurchaseDate: null,
    createdAt,
  });
});

apiRouter.patch('/customers/:id', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const existing = db
    .prepare('SELECT * FROM customers WHERE id = ? AND business_id = ?')
    .get(req.params.id, req.businessId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }
  const { name, phone, email, address, notes } = req.body || {};
  db.prepare(
    'UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ? AND business_id = ?'
  ).run(
    name ? String(name).trim() : String(existing.name),
    phone !== undefined ? String(phone) : String(existing.phone),
    email !== undefined ? String(email) : String(existing.email),
    address !== undefined ? String(address) : String(existing.address),
    notes !== undefined ? String(notes) : String(existing.notes),
    req.params.id,
    req.businessId!
  );
  res.json({ ok: true });
});

apiRouter.get('/customers/:id/history', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const cust = db.prepare('SELECT * FROM customers WHERE id = ? AND business_id = ?').get(req.params.id, bId);
  if (!cust) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }
  const sales = db
    .prepare('SELECT * FROM sales WHERE customer_id = ? AND business_id = ? ORDER BY sale_date DESC')
    .all(req.params.id, bId);
  const orders = db
    .prepare('SELECT * FROM orders WHERE customer_id = ? AND business_id = ? ORDER BY order_date DESC')
    .all(req.params.id, bId);
  res.json({ sales, orders });
});

apiRouter.delete('/customers/:id', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM customers WHERE id = ? AND business_id = ?').run(req.params.id, req.businessId!);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Sales & Profit Management
// ---------------------------------------------------------------------------
function getSalesWithItems(businessId: string, limit = 100) {
  const rows = db
    .prepare(
      `SELECT s.*, c.name AS customer_name FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.business_id = ? ORDER BY s.sale_date DESC, s.created_at DESC LIMIT ?`
    )
    .all(businessId, limit) as Record<string, unknown>[];

  const getItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
  return rows.map((r) => {
    const items = getItems.all(String(r.id)) as Record<string, unknown>[];
    return {
      id: String(r.id),
      businessId: String(r.business_id),
      customerId: r.customer_id ? String(r.customer_id) : null,
      customerName: r.customer_name ? String(r.customer_name) : 'Walk-in Customer',
      saleNumber: String(r.sale_number),
      subtotal: Number(r.subtotal || 0),
      discount: Number(r.discount || 0),
      taxAmount: Number(r.tax_amount || 0),
      totalAmount: Number(r.total_amount || 0),
      amountPaid: Number(r.amount_paid || 0),
      paymentMethod: String(r.payment_method),
      paymentStatus: String(r.payment_status),
      totalCogs: Number(r.total_cogs || 0),
      grossProfit: Number(r.gross_profit || 0),
      notes: String(r.notes || ''),
      saleDate: String(r.sale_date),
      createdAt: String(r.created_at),
      items: items.map((it) => ({
        id: String(it.id),
        productId: it.product_id ? String(it.product_id) : null,
        productName: String(it.product_name),
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        unitCost: Number(it.unit_cost),
        lineTotal: Number(it.line_total),
      })),
    };
  });
}

apiRouter.get('/sales', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  res.json(getSalesWithItems(req.businessId!, 200));
});

apiRouter.post('/sales', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const { customerId, items, discount, taxRate, amountPaid, paymentMethod, notes, saleDate, idempotencyKey } =
    req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Select at least one product to record a sale.' });
    return;
  }

  if (idempotencyKey) {
    const dup = db
      .prepare('SELECT id FROM sales WHERE business_id = ? AND idempotency_key = ?')
      .get(bId, String(idempotencyKey));
    if (dup) {
      res.status(409).json({ error: 'Duplicate sale submission prevented.' });
      return;
    }
  }

  const now = nowIso();
  const dateStr = saleDate ? String(saleDate).slice(0, 10) : now.slice(0, 10);
  const saleId = uid('sal');
  const saleNum = `SL-${Math.floor(1000 + Math.random() * 9000)}`;

  db.exec('BEGIN');
  try {
    let subtotal = 0;
    let totalCogs = 0;
    const resolvedItems: {
      productId: string | null;
      productName: string;
      quantity: number;
      unitPrice: number;
      unitCost: number;
      lineTotal: number;
    }[] = [];

    for (const rawItem of items) {
      const qty = Math.max(1, Math.round(Number(rawItem.quantity || 1)));
      if (rawItem.productId) {
        const prod = db
          .prepare('SELECT * FROM products WHERE id = ? AND business_id = ?')
          .get(String(rawItem.productId), bId) as Record<string, unknown> | undefined;
        if (!prod) {
          throw new Error('Selected product was not found in your inventory.');
        }
        const currentStock = Number(prod.stock_qty || 0);
        if (currentStock < qty) {
          throw new Error(`Insufficient stock for "${prod.name}". Available: ${currentStock}, requested: ${qty}.`);
        }
        const unitPrice = rawItem.unitPrice !== undefined ? Math.max(0, Number(rawItem.unitPrice)) : Number(prod.selling_price || 0);
        const unitCost = Number(prod.purchase_price || 0);
        const lineTotal = unitPrice * qty;
        subtotal += lineTotal;
        totalCogs += unitCost * qty;

        const newStock = currentStock - qty;
        db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(newStock, now, String(prod.id));
        db.prepare(`
          INSERT INTO inventory_movements (
            id, business_id, product_id, movement_type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at
          ) VALUES (?, ?, ?, 'sale', ?, ?, ?, ?, ?, ?)
        `).run(uid('mov'), bId, String(prod.id), -qty, currentStock, newStock, `Sale ${saleNum}`, saleId, now);

        resolvedItems.push({
          productId: String(prod.id),
          productName: String(prod.name),
          quantity: qty,
          unitPrice,
          unitCost,
          lineTotal,
        });
      } else {
        const unitPrice = Math.max(0, Number(rawItem.unitPrice || 0));
        const unitCost = Math.max(0, Number(rawItem.unitCost || 0));
        const lineTotal = unitPrice * qty;
        subtotal += lineTotal;
        totalCogs += unitCost * qty;
        resolvedItems.push({
          productId: null,
          productName: String(rawItem.productName || 'Custom Item'),
          quantity: qty,
          unitPrice,
          unitCost,
          lineTotal,
        });
      }
    }

    const disc = Math.max(0, Math.min(subtotal, Number(discount || 0)));
    const taxable = Math.max(0, subtotal - disc);
    const rate = Math.max(0, Number(taxRate || 0));
    const taxAmount = Number(((taxable * rate) / 100).toFixed(2));
    const totalAmount = Number((taxable + taxAmount).toFixed(2));
    const paid = amountPaid !== undefined ? Math.max(0, Math.min(totalAmount, Number(amountPaid))) : totalAmount;
    const paymentStatus = paid >= totalAmount ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    const grossProfit = Number((totalAmount - totalCogs).toFixed(2));

    db.prepare(`
      INSERT INTO sales (
        id, business_id, customer_id, sale_number, idempotency_key, subtotal, discount, tax_amount,
        total_amount, amount_paid, payment_method, payment_status, total_cogs, gross_profit, notes, sale_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      saleId,
      bId,
      customerId || null,
      saleNum,
      idempotencyKey ? String(idempotencyKey) : null,
      subtotal,
      disc,
      taxAmount,
      totalAmount,
      paid,
      String(paymentMethod || 'Cash'),
      paymentStatus,
      totalCogs,
      grossProfit,
      String(notes || ''),
      dateStr,
      now
    );

    const insertItem = db.prepare(`
      INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of resolvedItems) {
      insertItem.run(uid('sli'), saleId, item.productId, item.productName, item.quantity, item.unitPrice, item.unitCost, item.lineTotal);
    }

    db.exec('COMMIT');
    res.status(201).json({ id: saleId, saleNumber: saleNum, totalAmount, grossProfit });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to record sale.' });
  }
});

apiRouter.patch('/sales/:id', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND business_id = ?').get(req.params.id, bId) as
    | Record<string, unknown>
    | undefined;
  if (!sale) {
    res.status(404).json({ error: 'Sale record not found.' });
    return;
  }

  const { amountPaid, paymentMethod, notes } = req.body || {};
  const totalAmount = Number(sale.total_amount || 0);
  const nextPaid =
    amountPaid !== undefined ? Math.max(0, Math.min(totalAmount, Number(amountPaid))) : Number(sale.amount_paid || 0);
  const nextStatus = nextPaid >= totalAmount ? 'paid' : nextPaid > 0 ? 'partial' : 'unpaid';

  db.prepare(
    'UPDATE sales SET amount_paid = ?, payment_status = ?, payment_method = ?, notes = ? WHERE id = ? AND business_id = ?'
  ).run(
    nextPaid,
    nextStatus,
    paymentMethod ? String(paymentMethod) : String(sale.payment_method),
    notes !== undefined ? String(notes) : String(sale.notes),
    req.params.id,
    bId
  );

  res.json({ ok: true });
});

apiRouter.delete('/sales/:id', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND business_id = ?').get(req.params.id, bId) as
    | Record<string, unknown>
    | undefined;
  if (!sale) {
    res.status(404).json({ error: 'Sale not found.' });
    return;
  }
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id) as Record<string, unknown>[];
  const now = nowIso();

  db.exec('BEGIN');
  try {
    for (const item of items) {
      if (item.product_id) {
        const prod = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(String(item.product_id)) as
          | { stock_qty: number }
          | undefined;
        if (prod) {
          const prev = prod.stock_qty;
          const next = prev + Number(item.quantity);
          db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(next, now, String(item.product_id));
          db.prepare(`
            INSERT INTO inventory_movements (
              id, business_id, product_id, movement_type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at
            ) VALUES (?, ?, ?, 'order_restore', ?, ?, ?, ?, ?, ?)
          `).run(uid('mov'), bId, String(item.product_id), Number(item.quantity), prev, next, `Voided sale ${sale.sale_number}`, req.params.id, now);
        }
      }
    }
    db.prepare('DELETE FROM sales WHERE id = ? AND business_id = ?').run(req.params.id, bId);
    db.exec('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to void sale.' });
  }
});

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
apiRouter.get('/expenses', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM expenses WHERE business_id = ? ORDER BY expense_date DESC, created_at DESC')
    .all(req.businessId!) as Record<string, unknown>[];
  res.json(
    rows.map((r) => ({
      id: String(r.id),
      businessId: String(r.business_id),
      category: String(r.category),
      title: String(r.title),
      amount: Number(r.amount),
      expenseDate: String(r.expense_date),
      notes: String(r.notes || ''),
      createdAt: String(r.created_at),
    }))
  );
});

apiRouter.post('/expenses', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const { category, title, amount, expenseDate, notes } = req.body || {};
  if (!title || Number(amount) <= 0) {
    res.status(400).json({ error: 'Expense title and positive amount are required.' });
    return;
  }
  const id = uid('exp');
  const now = nowIso();
  const dateStr = expenseDate ? String(expenseDate).slice(0, 10) : now.slice(0, 10);
  db.prepare(
    'INSERT INTO expenses (id, business_id, category, title, amount, expense_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.businessId!, String(category || 'Operations'), String(title).trim(), Number(amount), dateStr, String(notes || ''), now);

  res.status(201).json({
    id,
    businessId: req.businessId!,
    category: String(category || 'Operations'),
    title: String(title).trim(),
    amount: Number(amount),
    expenseDate: dateStr,
    notes: String(notes || ''),
    createdAt: now,
  });
});

apiRouter.delete('/expenses/:id', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ? AND business_id = ?').run(req.params.id, req.businessId!);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
const FULFILLED_ORDER_STATUSES: OrderStatus[] = ['confirmed', 'processing', 'dispatched', 'completed'];

function getOrdersWithItems(businessId: string, limit = 100) {
  const rows = db
    .prepare(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.business_id = ?
       ORDER BY o.order_date DESC, o.created_at DESC LIMIT ?`
    )
    .all(businessId, limit) as Record<string, unknown>[];

  const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  return rows.map((r) => {
    const items = getItems.all(String(r.id)) as Record<string, unknown>[];
    return {
      id: String(r.id),
      businessId: String(r.business_id),
      customerId: r.customer_id ? String(r.customer_id) : null,
      customerName: r.customer_name ? String(r.customer_name) : 'Walk-in Customer',
      customerPhone: r.customer_phone ? String(r.customer_phone) : '',
      orderNumber: String(r.order_number),
      status: String(r.status) as OrderStatus,
      totalAmount: Number(r.total_amount || 0),
      inventoryDeducted: Boolean(r.inventory_deducted),
      notes: String(r.notes || ''),
      orderDate: String(r.order_date),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      items: items.map((it) => ({
        id: String(it.id),
        productId: it.product_id ? String(it.product_id) : null,
        productName: String(it.product_name),
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        unitCost: Number(it.unit_cost),
        lineTotal: Number(it.line_total),
      })),
    };
  });
}

apiRouter.get('/orders', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  res.json(getOrdersWithItems(req.businessId!, 200));
});

apiRouter.post('/orders', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const { customerId, items, status, notes, orderDate } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Add at least one product to create an order.' });
    return;
  }

  const safeStatus: OrderStatus = ['pending', 'confirmed', 'processing', 'dispatched', 'completed', 'cancelled'].includes(
    String(status)
  )
    ? (String(status) as OrderStatus)
    : 'pending';
  const shouldDeduct = FULFILLED_ORDER_STATUSES.includes(safeStatus);

  const settings = db.prepare('SELECT order_prefix FROM business_settings WHERE business_id = ?').get(bId) as
    | { order_prefix: string }
    | undefined;
  const orderId = uid('ord');
  const orderNumber = `${settings?.order_prefix || 'ORD-'}${Math.floor(2000 + Math.random() * 7999)}`;
  const now = nowIso();
  const dateStr = orderDate ? String(orderDate).slice(0, 10) : now.slice(0, 10);

  db.exec('BEGIN');
  try {
    let totalAmount = 0;
    const resolvedItems: {
      productId: string | null;
      productName: string;
      quantity: number;
      unitPrice: number;
      unitCost: number;
      lineTotal: number;
    }[] = [];

    for (const rawItem of items) {
      const qty = Math.max(1, Math.round(Number(rawItem.quantity || 1)));
      if (rawItem.productId) {
        const prod = db
          .prepare('SELECT * FROM products WHERE id = ? AND business_id = ?')
          .get(String(rawItem.productId), bId) as Record<string, unknown> | undefined;
        if (!prod) throw new Error('Product not found in inventory.');
        if (shouldDeduct && Number(prod.stock_qty) < qty) {
          throw new Error(`Insufficient stock for "${prod.name}". Available: ${prod.stock_qty}.`);
        }
        const unitPrice = rawItem.unitPrice !== undefined ? Math.max(0, Number(rawItem.unitPrice)) : Number(prod.selling_price || 0);
        const unitCost = Number(prod.purchase_price || 0);
        const lineTotal = unitPrice * qty;
        totalAmount += lineTotal;

        if (shouldDeduct) {
          const prev = Number(prod.stock_qty);
          const next = prev - qty;
          db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(next, now, String(prod.id));
          db.prepare(`
            INSERT INTO inventory_movements (
              id, business_id, product_id, movement_type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at
            ) VALUES (?, ?, ?, 'order', ?, ?, ?, ?, ?, ?)
          `).run(uid('mov'), bId, String(prod.id), -qty, prev, next, `Order ${orderNumber} (${safeStatus})`, orderId, now);
        }

        resolvedItems.push({
          productId: String(prod.id),
          productName: String(prod.name),
          quantity: qty,
          unitPrice,
          unitCost,
          lineTotal,
        });
      } else {
        const unitPrice = Math.max(0, Number(rawItem.unitPrice || 0));
        const lineTotal = unitPrice * qty;
        totalAmount += lineTotal;
        resolvedItems.push({
          productId: null,
          productName: String(rawItem.productName || 'Custom Item'),
          quantity: qty,
          unitPrice,
          unitCost: 0,
          lineTotal,
        });
      }
    }

    db.prepare(`
      INSERT INTO orders (id, business_id, customer_id, order_number, status, total_amount, inventory_deducted, notes, order_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, bId, customerId || null, orderNumber, safeStatus, totalAmount, shouldDeduct ? 1 : 0, String(notes || ''), dateStr, now, now);

    const insItem = db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const it of resolvedItems) {
      insItem.run(uid('ori'), orderId, it.productId, it.productName, it.quantity, it.unitPrice, it.unitCost, it.lineTotal);
    }

    db.exec('COMMIT');
    res.status(201).json({ id: orderId, orderNumber, status: safeStatus, totalAmount });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create order.' });
  }
});

apiRouter.patch('/orders/:id/status', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const { status } = req.body || {};
  const nextStatus = String(status) as OrderStatus;
  if (!['pending', 'confirmed', 'processing', 'dispatched', 'completed', 'cancelled'].includes(nextStatus)) {
    res.status(400).json({ error: 'Invalid order status.' });
    return;
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND business_id = ?').get(req.params.id, bId) as
    | Record<string, unknown>
    | undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id) as Record<string, unknown>[];
  const wasDeducted = Boolean(order.inventory_deducted);
  const needsDeduction = FULFILLED_ORDER_STATUSES.includes(nextStatus) && !wasDeducted;
  const needsRestore = (nextStatus === 'cancelled' || nextStatus === 'pending') && wasDeducted;
  const now = nowIso();

  db.exec('BEGIN');
  try {
    if (needsDeduction) {
      for (const it of items) {
        if (!it.product_id) continue;
        const prod = db.prepare('SELECT id, name, stock_qty FROM products WHERE id = ? AND business_id = ?').get(String(it.product_id), bId) as
          | { id: string; name: string; stock_qty: number }
          | undefined;
        if (!prod) continue;
        const qty = Number(it.quantity);
        if (prod.stock_qty < qty) {
          throw new Error(`Insufficient stock for "${prod.name}". Available: ${prod.stock_qty}, required: ${qty}.`);
        }
        const nextQty = prod.stock_qty - qty;
        db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(nextQty, now, prod.id);
        db.prepare(`
          INSERT INTO inventory_movements (
            id, business_id, product_id, movement_type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at
          ) VALUES (?, ?, ?, 'order', ?, ?, ?, ?, ?, ?)
        `).run(uid('mov'), bId, prod.id, -qty, prod.stock_qty, nextQty, `Order ${order.order_number} -> ${nextStatus}`, req.params.id, now);
      }
      db.prepare('UPDATE orders SET status = ?, inventory_deducted = 1, updated_at = ? WHERE id = ?').run(nextStatus, now, req.params.id);
    } else if (needsRestore) {
      for (const it of items) {
        if (!it.product_id) continue;
        const prod = db.prepare('SELECT id, stock_qty FROM products WHERE id = ? AND business_id = ?').get(String(it.product_id), bId) as
          | { id: string; stock_qty: number }
          | undefined;
        if (!prod) continue;
        const qty = Number(it.quantity);
        const nextQty = prod.stock_qty + qty;
        db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(nextQty, now, prod.id);
        db.prepare(`
          INSERT INTO inventory_movements (
            id, business_id, product_id, movement_type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at
          ) VALUES (?, ?, ?, 'order_restore', ?, ?, ?, ?, ?, ?)
        `).run(uid('mov'), bId, prod.id, qty, prod.stock_qty, nextQty, `Order ${order.order_number} ${nextStatus}`, req.params.id, now);
      }
      db.prepare('UPDATE orders SET status = ?, inventory_deducted = 0, updated_at = ? WHERE id = ?').run(nextStatus, now, req.params.id);
    } else {
      db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, now, req.params.id);
    }

    db.exec('COMMIT');
    res.json({ ok: true, status: nextStatus, inventoryDeducted: needsDeduction ? true : needsRestore ? false : wasDeducted });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update order status.' });
  }
});

apiRouter.delete('/orders/:id', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM orders WHERE id = ? AND business_id = ?').run(req.params.id, req.businessId!);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Invoices & Receipts
// ---------------------------------------------------------------------------
apiRouter.get('/invoices', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const rows = db
    .prepare(
      `SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.address AS customer_address
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.business_id = ?
       ORDER BY i.invoice_date DESC, i.created_at DESC`
    )
    .all(bId) as Record<string, unknown>[];

  const getItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?');
  res.json(
    rows.map((r) => ({
      id: String(r.id),
      businessId: String(r.business_id),
      customerId: r.customer_id ? String(r.customer_id) : null,
      customerName: r.customer_name ? String(r.customer_name) : 'Walk-in Customer',
      customerEmail: r.customer_email ? String(r.customer_email) : '',
      customerPhone: r.customer_phone ? String(r.customer_phone) : '',
      customerAddress: r.customer_address ? String(r.customer_address) : '',
      invoiceNumber: String(r.invoice_number),
      invoiceDate: String(r.invoice_date),
      dueDate: String(r.due_date),
      subtotal: Number(r.subtotal || 0),
      discount: Number(r.discount || 0),
      taxRate: Number(r.tax_rate || 0),
      taxAmount: Number(r.tax_amount || 0),
      totalAmount: Number(r.total_amount || 0),
      amountPaid: Number(r.amount_paid || 0),
      paymentStatus: String(r.payment_status),
      notes: String(r.notes || ''),
      createdAt: String(r.created_at),
      items: (getItems.all(String(r.id)) as Record<string, unknown>[]).map((it) => ({
        id: String(it.id),
        productId: it.product_id ? String(it.product_id) : null,
        description: String(it.description),
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        lineTotal: Number(it.line_total),
      })),
    }))
  );
});

apiRouter.post('/invoices', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const sub = db.prepare('SELECT plan_tier FROM subscriptions WHERE business_id = ?').get(bId) as { plan_tier: PlanTier } | undefined;
  const tier: PlanTier = sub?.plan_tier || 'free';
  const invoiceLimit = PLAN_LIMITS[tier].invoicesPerMonth;
  const usage = getOrCreateUsageRecord(bId);
  if (invoiceLimit !== null && usage.invoices_count >= invoiceLimit) {
    res.status(403).json({
      error: `Free plan limit of ${invoiceLimit} invoices this month reached. Upgrade to Pro for unlimited invoices.`,
    });
    return;
  }

  const { customerId, items, invoiceDate, dueDate, discount, taxRate, amountPaid, notes } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Add at least one line item to generate an invoice.' });
    return;
  }

  const settings = db.prepare('SELECT invoice_prefix FROM business_settings WHERE business_id = ?').get(bId) as
    | { invoice_prefix: string }
    | undefined;
  const now = nowIso();
  const invDate = invoiceDate ? String(invoiceDate).slice(0, 10) : now.slice(0, 10);
  const due = dueDate ? String(dueDate).slice(0, 10) : invDate;
  const invId = uid('inv');
  const invNumber = `${settings?.invoice_prefix || 'INV-'}${new Date().getUTCFullYear()}-${Math.floor(100 + Math.random() * 899)}`;

  let subtotal = 0;
  const resolvedItems = items.map((it: Record<string, unknown>) => {
    const qty = Math.max(1, Math.round(Number(it.quantity || 1)));
    const price = Math.max(0, Number(it.unitPrice || 0));
    const lineTotal = Number((qty * price).toFixed(2));
    subtotal += lineTotal;
    return {
      productId: it.productId ? String(it.productId) : null,
      description: String(it.description || 'Item'),
      quantity: qty,
      unitPrice: price,
      lineTotal,
    };
  });

  const disc = Math.max(0, Math.min(subtotal, Number(discount || 0)));
  const taxable = Math.max(0, subtotal - disc);
  const rate = Math.max(0, Number(taxRate || 0));
  const taxAmount = Number(((taxable * rate) / 100).toFixed(2));
  const totalAmount = Number((taxable + taxAmount).toFixed(2));
  const paid = Math.max(0, Math.min(totalAmount, Number(amountPaid || 0)));
  const paymentStatus = paid >= totalAmount ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO invoices (
        id, business_id, customer_id, invoice_number, invoice_date, due_date,
        subtotal, discount, tax_rate, tax_amount, total_amount, amount_paid, payment_status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invId, bId, customerId || null, invNumber, invDate, due, subtotal, disc, rate, taxAmount, totalAmount, paid, paymentStatus, String(notes || ''), now);

    const ins = db.prepare(
      'INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const it of resolvedItems) {
      ins.run(uid('ini'), invId, it.productId, it.description, it.quantity, it.unitPrice, it.lineTotal);
    }

    db.prepare('UPDATE usage_records SET invoices_count = invoices_count + 1 WHERE id = ?').run(usage.id);
    db.exec('COMMIT');
    res.status(201).json({ id: invId, invoiceNumber: invNumber, totalAmount });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create invoice.' });
  }
});

apiRouter.patch('/invoices/:id', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ? AND business_id = ?').get(req.params.id, bId) as
    | Record<string, unknown>
    | undefined;
  if (!inv) {
    res.status(404).json({ error: 'Invoice not found.' });
    return;
  }
  const { amountPaid, paymentStatus } = req.body || {};
  const total = Number(inv.total_amount || 0);
  const nextPaid = amountPaid !== undefined ? Math.max(0, Math.min(total, Number(amountPaid))) : Number(inv.amount_paid || 0);
  const computedStatus =
    paymentStatus || (nextPaid >= total ? 'paid' : nextPaid > 0 ? 'partial' : 'unpaid');

  db.prepare('UPDATE invoices SET amount_paid = ?, payment_status = ? WHERE id = ? AND business_id = ?').run(
    nextPaid,
    computedStatus,
    req.params.id,
    bId
  );
  res.json({ ok: true });
});

apiRouter.delete('/invoices/:id', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM invoices WHERE id = ? AND business_id = ?').run(req.params.id, req.businessId!);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Subscription & Billing
// ---------------------------------------------------------------------------
apiRouter.get('/subscription', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  let sub = db.prepare('SELECT * FROM subscriptions WHERE business_id = ?').get(bId) as
    | Record<string, unknown>
    | undefined;
  if (!sub) {
    const now = nowIso();
    const end = new Date();
    end.setUTCDate(end.getUTCDate() + 30);
    db.prepare(`
      INSERT INTO subscriptions (id, business_id, plan_tier, billing_cycle, status, price_usd, current_period_start, current_period_end, cancel_at_period_end, provider, created_at, updated_at)
      VALUES (?, ?, 'free', 'monthly', 'active', 0, ?, ?, 0, 'free_tier', ?, ?)
    `).run(uid('sub'), bId, now, end.toISOString(), now, now);
    sub = db.prepare('SELECT * FROM subscriptions WHERE business_id = ?').get(bId) as Record<string, unknown>;
  }

  const tier = String(sub.plan_tier) as PlanTier;
  const limits = PLAN_LIMITS[tier];
  const usage = getOrCreateUsageRecord(bId);
  const payments = db
    .prepare('SELECT * FROM payment_history WHERE business_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(bId) as Record<string, unknown>[];

  res.json({
    planTier: tier,
    billingCycle: String(sub.billing_cycle),
    status: String(sub.status),
    priceUsd: Number(sub.price_usd || 0),
    currentPeriodStart: String(sub.current_period_start),
    currentPeriodEnd: String(sub.current_period_end),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    provider: String(sub.provider),
    usage: {
      periodMonth: usage.period_month,
      aiGenerationsCount: usage.ai_generations_count,
      aiGenerationsLimit: limits.aiGenerationsPerMonth,
      invoicesCount: usage.invoices_count,
      invoicesLimit: limits.invoicesPerMonth,
      productsCount: usage.products_count,
      productsLimit: limits.productsMax,
    },
    paymentGatewayConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    paymentHistory: payments.map((p) => ({
      id: String(p.id),
      amountUsd: Number(p.amount_usd),
      currency: String(p.currency),
      status: String(p.status),
      description: String(p.description),
      createdAt: String(p.created_at),
    })),
  });
});

apiRouter.post('/subscription/change', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const bId = req.businessId!;
  const { planTier, billingCycle } = req.body || {};
  const tier = String(planTier) as PlanTier;
  const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';

  if (!['free', 'pro', 'business'].includes(tier)) {
    res.status(400).json({ error: 'Invalid subscription plan selected.' });
    return;
  }

  const now = nowIso();
  if (tier === 'free') {
    db.prepare(
      "UPDATE subscriptions SET plan_tier = 'free', billing_cycle = ?, price_usd = 0, status = 'active', cancel_at_period_end = 0, updated_at = ? WHERE business_id = ?"
    ).run(cycle, now, bId);
    res.json({ ok: true, planTier: 'free' });
    return;
  }

  // Server-side verification gate: never unlock paid tiers without configured payment provider verification
  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(402).json({
      paymentGatewayRequired: true,
      error:
        'Live billing requires payment provider credentials (STRIPE_SECRET_KEY) configured on the server. Paid features remain locked until a verified checkout is completed.',
    });
    return;
  }

  res.status(501).json({
    error: 'Connect your Stripe Checkout webhook endpoint to verify payment before activating paid tiers.',
  });
});

apiRouter.post('/subscription/cancel', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  db.prepare('UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE business_id = ?').run(
    nowIso(),
    req.businessId!
  );
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// AI Endpoints
// ---------------------------------------------------------------------------
apiRouter.get('/ai/history', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM ai_generations WHERE business_id = ? ORDER BY created_at DESC LIMIT 40')
    .all(req.businessId!) as Record<string, unknown>[];
  res.json(
    rows.map((r) => ({
      id: String(r.id),
      businessId: String(r.business_id),
      generationType: String(r.generation_type),
      platform: String(r.platform),
      tone: String(r.tone),
      style: String(r.style),
      promptSummary: String(r.prompt_summary),
      outputText: String(r.output_text),
      metadataJson: (() => {
        try {
          return JSON.parse(String(r.metadata_json || '{}'));
        } catch {
          return {};
        }
      })(),
      createdAt: String(r.created_at),
    }))
  );
});

apiRouter.delete('/ai/history/:id', requireAuth, requireBusiness, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM ai_generations WHERE id = ? AND business_id = ?').run(req.params.id, req.businessId!);
  res.json({ ok: true });
});

apiRouter.post('/ai/marketing', requireAuth, requireBusiness, async (req: AuthedRequest, res) => {
  try {
    const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId!) as Record<string, unknown>;
    const { contentType, productName, productCategory, productPrice, targetAudience, productFeatures, platform, tone, style } =
      req.body || {};
    if (!productName || typeof productName !== 'string' || !productName.trim()) {
      res.status(400).json({ error: 'Product name is required to generate marketing copy.' });
      return;
    }

    const out = await generateMarketingContent({
      businessId: req.businessId!,
      userId: req.authUser!.id,
      businessName: String(biz.name),
      currency: String(biz.currency),
      country: String(biz.country),
      contentType: String(contentType || 'Product description'),
      productName: productName.trim(),
      productCategory: String(productCategory || biz.category),
      productPrice: String(productPrice || ''),
      targetAudience: String(targetAudience || ''),
      productFeatures: String(productFeatures || ''),
      platform: String(platform || 'Instagram'),
      tone: String(tone || 'Persuasive'),
      style: String(style || 'Professional'),
    });

    res.json(out);
  } catch (err) {
    const { status, message } = formatGeminiError(err);
    res.status(status).json({ error: message });
  }
});

apiRouter.post('/ai/advisor', requireAuth, requireBusiness, async (req: AuthedRequest, res) => {
  try {
    const { question, history } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'Please enter a question for the AI Business Advisor.' });
      return;
    }
    const out = await generateBusinessAdvice({
      businessId: req.businessId!,
      userId: req.authUser!.id,
      question: question.trim(),
      history: Array.isArray(history) ? history : [],
    });
    res.json(out);
  } catch (err) {
    const { status, message } = formatGeminiError(err);
    res.status(status).json({ error: message });
  }
});

apiRouter.post('/ai/poster-image', requireAuth, requireBusiness, async (req: AuthedRequest, res) => {
  try {
    const { prompt, aspectRatio, productImageBase64, productImageMimeType } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Describe the promotional visual you want to generate.' });
      return;
    }
    const out = await generatePosterImage({
      businessId: req.businessId!,
      userId: req.authUser!.id,
      prompt: prompt.trim(),
      aspectRatio: ['1:1', '3:4', '9:16', '16:9', '4:3'].includes(String(aspectRatio))
        ? (String(aspectRatio) as '1:1' | '3:4' | '9:16' | '16:9' | '4:3')
        : '1:1',
      productImageBase64: productImageBase64 ? String(productImageBase64) : undefined,
      productImageMimeType: productImageMimeType ? String(productImageMimeType) : undefined,
    });
    res.json(out);
  } catch (err) {
    const { status, message } = formatGeminiError(err);
    res.status(status).json({ error: message });
  }
});
