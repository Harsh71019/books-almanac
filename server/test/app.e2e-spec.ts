import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/test-app';
import { loginAsAdmin, authedRequest } from './helpers/auth.helper';
import request from 'supertest';

describe('Auth & Health E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/health', () => {
    it('should return 200 ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Auth flows', () => {
    it('should reject login with wrong password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: process.env.ADMIN_USERNAME,
          password: 'wrongpassword'
        })
        .expect(401);
    });

    it('should login successfully as admin', async () => {
      const { token, user } = await loginAsAdmin(app);
      expect(token).toBeDefined();
      expect(user.username).toBe(process.env.ADMIN_USERNAME);
    });

    it('should reject access to /api/auth/me without token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });

    it('should fetch user info with valid token', async () => {
      const { token } = await loginAsAdmin(app);
      const req = authedRequest(app, token);

      const res = await req.get('/api/auth/me')
        .expect(200);

      expect(res.body.username).toBe(process.env.ADMIN_USERNAME);
    });
  });
});
