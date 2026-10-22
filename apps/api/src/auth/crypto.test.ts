import { describe, expect, it } from 'vitest';
import { hashPassword, signToken, verifyPassword, verifyToken } from './crypto';

const SECRET = 'test-secret-that-is-long-enough-1234567890';

describe('passwords', () => {
  it('verifies the right password and rejects others', async () => {
    const stored = await hashPassword('correct horse');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse', stored)).toBe(true);
    expect(await verifyPassword('wrong horse', stored)).toBe(false);
    expect(await verifyPassword('correct horse', 'garbage')).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });
});

describe('tokens', () => {
  it('round-trips the user id', () => {
    const token = signToken('user-1', SECRET, 60);
    expect(verifyToken(token, SECRET)?.sub).toBe('user-1');
  });

  it('rejects tampered, foreign and expired tokens', () => {
    const token = signToken('user-1', SECRET, 60, 1_000_000);
    const [h, , s] = token.split('.');
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: 'admin', iat: 1, exp: 9e9 })).toString('base64url')}.${s}`;
    expect(verifyToken(forged, SECRET, 1_000_000)).toBeNull();
    expect(verifyToken(token, 'another-secret-that-is-long-enough-123', 1_000_000)).toBeNull();
    expect(verifyToken(token, SECRET, 1_000_000 + 61_000)).toBeNull();
    expect(verifyToken('not.a.token', SECRET)).toBeNull();
  });
});
