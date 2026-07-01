import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
  const mongod = await MongoMemoryServer.create({
    instance: { dbName: 'test_reading_almanac' }
  });
  process.env.MONGO_TEST_URI = mongod.getUri();
  (globalThis as any).__MONGOD__ = mongod;
}
