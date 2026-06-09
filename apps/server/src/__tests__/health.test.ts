// Smoke test for the app factory + health endpoint. Runs without a real DB.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// Set required env vars before importing modules that read them.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/samagama-test';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-test-access-secret-12345';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-test-refresh-secret-12345';
process.env.CORS_ORIGINS ||= 'http://localhost:5173';

let app: Express;

beforeAll(async () => {
  const { createApp } = await import('../app.js');
  app = createApp();
});

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });
});

describe('GET /api/does-not-exist', () => {
  it('returns 404 with structured error', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
