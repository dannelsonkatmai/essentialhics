/**
 * Auth integration tests — these require a running test database.
 * Run with: DATABASE_URL=<test-db-url> npm test
 *
 * Uses supertest against the Express app; Prisma connects to a real DB.
 * Tests are skipped automatically if DATABASE_URL points to a non-test db
 * (detected by checking for "_test" in the db name).
 */

import request from 'supertest';
import app from '../../app';

const skip = !process.env.DATABASE_URL?.includes('_test');
const describeOrSkip = skip ? describe.skip : describe;

describeOrSkip('POST /auth/login', () => {
  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'doesnotmatter' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBeDefined();
  });

  it('returns 400 for invalid schema (no email)', async () => {
    const res = await request(app).post('/auth/login').send({ password: 'somepass' });
    expect(res.status).toBe(400);
  });

  it('rate limits after too many requests', async () => {
    // Fire 11 requests quickly; the 11th should be rate-limited
    const requests = Array.from({ length: 12 }, () =>
      request(app).post('/auth/login').send({ email: 'test@x.com', password: 'wrong' }),
    );
    const results = await Promise.all(requests);
    const tooMany = results.some((r) => r.status === 429);
    expect(tooMany).toBe(true);
  });
});

describeOrSkip('POST /auth/forgot-password', () => {
  it('always returns 200 regardless of email existence', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If that email/);
  });
});

describeOrSkip('POST /auth/reset-password', () => {
  it('returns 400 for an invalid token', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'badtoken', password: 'NewSecurePass@123!' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a weak password', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'anytoken', password: 'weak' });
    expect(res.status).toBe(400);
  });
});

describeOrSkip('POST /auth/refresh', () => {
  it('returns 401 when no cookie is present', async () => {
    const res = await request(app).post('/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describeOrSkip('Protected routes require auth', () => {
  it('GET /api/users returns 401 without token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('GET /api/facilities returns 401 without token', async () => {
    const res = await request(app).get('/api/facilities');
    expect(res.status).toBe(401);
  });

  it('GET /api/audit-logs returns 401 without token', async () => {
    const res = await request(app).get('/api/audit-logs');
    expect(res.status).toBe(401);
  });
});
