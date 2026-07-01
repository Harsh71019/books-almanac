import request from 'supertest';
import { INestApplication } from '@nestjs/common';

export async function loginAsAdmin(app: INestApplication) {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD
    })
    .expect(201);

  const token = res.body.token;
  if (!token) throw new Error('JWT token not found in login response');

  return {
    token,
    user: res.body
  };
}

export function authedRequest(
  app: INestApplication,
  token: string
) {
  const server = app.getHttpServer();
  const bearer = `Bearer ${token}`;
  return {
    get:    (url: string) => request(server).get(url).set('Authorization', bearer),
    post:   (url: string) => request(server).post(url).set('Authorization', bearer),
    patch:  (url: string) => request(server).patch(url).set('Authorization', bearer),
    delete: (url: string) => request(server).delete(url).set('Authorization', bearer),
  };
}
