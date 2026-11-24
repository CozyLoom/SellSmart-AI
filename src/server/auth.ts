import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : EPHEMERAL_FALLBACK_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export interface SessionPayload {
  userId: string;
  email: string;
  exp: number;
}

export function signSessionToken(userId: string, email: string): string {
  const payload: SessionPayload = {
    userId,
    email,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.userId || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = 'sellsmart_session';

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function setSessionCookie(res: Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${7 * 24 * 60 * 60}`
  );
}

export function clearSessionCookie(res: Response) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
  );
}

export interface AuthedRequest extends Request {
  authUser?: {
    id: string;
    fullName: string;
    email: string;
    authProvider: string;
    createdAt: string;
  };
  businessId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';
  let usedCookie = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[SESSION_COOKIE_NAME]) {
      token = cookies[SESSION_COOKIE_NAME];
      usedCookie = true;
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  // CSRF defense for cookie-authenticated state-changing requests
  if (usedCookie && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    const requestedWith = req.headers['x-requested-with'];
    const origin = req.headers.origin;
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    const originMatches =
      origin && host
        ? (() => {
            try {
              return new URL(origin).host === host;
            } catch {
              return false;
            }
          })()
        : false;
    if (requestedWith !== 'XMLHttpRequest' && !originMatches) {
      res.status(403).json({ error: 'Invalid request origin.' });
      return;
    }
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  const user = db
    .prepare('SELECT id, full_name, email, auth_provider, created_at FROM users WHERE id = ?')
    .get(payload.userId) as
    | { id: string; full_name: string; email: string; auth_provider: string; created_at: string }
    | undefined;

  if (!user) {
    res.status(401).json({ error: 'Account no longer exists.' });
    return;
  }

  req.authUser = {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    authProvider: user.auth_provider,
    createdAt: user.created_at,
  };
  next();
}

export function requireBusiness(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const business = db
    .prepare('SELECT id FROM businesses WHERE owner_user_id = ? ORDER BY created_at ASC LIMIT 1')
    .get(req.authUser.id) as { id: string } | undefined;

  if (!business) {
    res.status(404).json({ error: 'Business onboarding required.', code: 'ONBOARDING_REQUIRED' });
    return;
  }

  req.businessId = business.id;
  next();
}
