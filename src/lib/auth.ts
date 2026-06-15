import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

// ── Password Hashing (BUG-001 fix) ────────────────────────────

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(
  plainText: string,
  hashed: string,
): Promise<boolean> {
  return bcrypt.compare(plainText, hashed);
}

// ── JWT Session Management (BUG-002 fix) ──────────────────────

function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET is required. Refusing to use an insecure fallback secret in runtime.',
    );
  }

  if (secret === 'change-me-in-production') {
    throw new Error(
      'JWT_SECRET must not use the default placeholder value `change-me-in-production`.',
    );
  }

  return new TextEncoder().encode(secret);
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  const secret = getJWTSecret();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = getJWTSecret();
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: (payload.userId as string) || '',
      username: (payload.username as string) || '',
      role: (payload.role as string) || 'user',
    };
  } catch {
    return null;
  }
}

// ── In-Memory Rate Limiter (BUG-005/006 fix) ─────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Check rate limit for a given key (usually IP address).
 * Returns true if the request should be allowed, false if rate-limited.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Get remaining attempts and reset time for rate limit headers.
 */
export function getRateLimitInfo(
  key: string,
  maxRequests: number,
  windowMs: number,
): { remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    return { remaining: maxRequests, resetAt: now + windowMs };
  }

  return {
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}
