import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/test-app';
import { loginAsAdmin, authedRequest } from './helpers/auth.helper';
import { buildBook, randomObjectId } from './helpers/factories';
import request from 'supertest';

describe('Books CRUD E2E', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    const loginResult = await loginAsAdmin(app);
    token = loginResult.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should deny unauthorized access to list books', () => {
    return request(app.getHttpServer())
      .get('/api/books')
      .expect(401);
  });

  it('should create a book, get it, update it, and delete it', async () => {
    const authed = authedRequest(app, token);

    // 1. Create
    const bookPayload = buildBook({ title: 'E2E Book' });
    const createRes = await authed.post('/api/books')
      .send(bookPayload)
      .expect(201);

    expect(createRes.body.title).toBe('E2E Book');
    expect(createRes.body.id).toBeDefined();
    const bookId = createRes.body.id;

    // 2. Read (Get One)
    const getRes = await authed.get(`/api/books/${bookId}`)
      .expect(200);
    expect(getRes.body.title).toBe('E2E Book');

    // 3. Update
    const updateRes = await authed.patch(`/api/books/${bookId}`)
      .send({ title: 'Updated E2E Book' })
      .expect(200);
    expect(updateRes.body.title).toBe('Updated E2E Book');

    // 4. Delete
    await authed.delete(`/api/books/${bookId}`)
      .expect(200);

    // 5. Get (Should be 404)
    await authed.get(`/api/books/${bookId}`)
      .expect(404);
  });
});
