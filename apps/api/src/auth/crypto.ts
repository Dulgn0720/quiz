import { createHmac, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Password hashing (scrypt) and compact signed tokens (JWT, HS256), built on
 * node:crypto so no native modules are needed.
 */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** `scrypt$N$r$p$salt$hash`, with salt and hash base64url-encoded. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scryptAsync(password, Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export interface TokenClaims {
  sub: string;
  iat: number;
  exp: number;
}

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

function signature(data: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

export function signToken(userId: string, secret: string, ttlSeconds: number, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: userId, iat, exp: iat + ttlSeconds })).toString('base64url');
  const data = `${HEADER}.${payload}`;
  return `${data}.${signature(data, secret).toString('base64url')}`;
}

/** The token's claims, or null if it is malformed, forged or expired. */
export function verifyToken(token: string, secret: string, now = Date.now()): TokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts as [string, string, string];
  if (header !== HEADER) return null;
  const expected = signature(`${header}.${payload}`, secret);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<TokenClaims>;
    if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number' || typeof claims.iat !== 'number') return null;
    if (claims.exp * 1000 <= now) return null;
    return claims as TokenClaims;
  } catch {
    return null;
  }
}

/**
 * Verifies an HS256 JWT made by another system (the employee portal) and returns its payload.
 * Unlike {@link verifyToken} it accepts any standard header with `alg: HS256`, and it requires a
 * short lifetime so a leaked link stops working quickly.
 */
export function verifyForeignToken(
  token: string,
  secret: string,
  maxLifetimeSeconds: number,
  now = Date.now(),
): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts as [string, string, string];
  try {
    const head = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg?: unknown };
    if (head.alg !== 'HS256') return null;
    const expected = signature(`${header}.${payload}`, secret);
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const exp = claims.exp;
    if (typeof exp !== 'number' || exp * 1000 <= now || exp * 1000 - now > maxLifetimeSeconds * 1000) return null;
    return claims;
  } catch {
    return null;
  }
}
