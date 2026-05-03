process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-different-from-access-secret!';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '8h';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.DATABASE_URL = 'postgresql://x:x@localhost/x';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.FRONTEND_URL = 'http://localhost:5173';

import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken, generateSecureToken, hashToken } from '../../utils/tokens';

const payload = { sub: 'user-123', email: 'test@example.com', sessionId: 'sess-1' };

describe('JWT tokens', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.sessionId).toBe(payload.sessionId);
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken(payload);
    const [h, p, s] = token.split('.');
    expect(() => verifyAccessToken(`${h}.${p}.tampered`)).toThrow();
  });

  it('access token cannot be verified with refresh secret', () => {
    const token = signAccessToken(payload);
    expect(() => verifyRefreshToken(token)).toThrow();
  });
});

describe('generateSecureToken', () => {
  it('produces a raw token and matching hash', () => {
    const { raw, hash } = generateSecureToken();
    expect(raw).toHaveLength(64); // 32 bytes hex
    expect(hashToken(raw)).toBe(hash);
  });

  it('produces unique tokens', () => {
    expect(generateSecureToken().raw).not.toBe(generateSecureToken().raw);
  });
});
