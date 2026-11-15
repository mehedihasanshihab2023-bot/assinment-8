import { MongoClient } from "mongodb";

/**
 * Mongo connection is cached on the global object so that Vercel's warm
 * serverless invocations reuse the same pool instead of opening a new one.
 */
const globalForMongo = globalThis;
if (!globalForMongo.__studioSpaceMongo) {
  globalForMongo.__studioSpaceMongo = {
    client: null,
    dbPromise: null,
    indexesPromise: null,
  };
}
const state = globalForMongo.__studioSpaceMongo;

export const DB_NAME = process.env.DB_NAME || "studiospace";

export async function getDB() {
  if (!process.env.MONGODB_URI) {
    throw Object.assign(
      new Error("MONGODB_URI is missing. Add it to your .env file or Vercel environment variables."),
      { status: 500 }
    );
  }

  if (!state.dbPromise) {
    state.client = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      retryWrites: true,
    });
    state.dbPromise = state.client
      .connect()
      .then((client) => client.db(DB_NAME))
      .catch((error) => {
        // Reset so the next invocation can retry instead of caching a broken promise.
        state.dbPromise = null;
        throw error;
      });
  }

  return state.dbPromise;
}

export async function getCollections() {
  const db = await getDB();
  return {
    db,
    users: db.collection("users"),
    studios: db.collection("studios"),
    bookings: db.collection("bookings"),
    reviews: db.collection("reviews"),
    wishlists: db.collection("wishlists"),
  };
}

export async function ensureIndexes() {
  if (state.indexesPromise) return state.indexesPromise;

  state.indexesPromise = (async () => {
    const db = await getDB();
    await Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db.collection("studios").createIndex({ ownerEmail: 1, createdAt: -1 }),
      db.collection("studios").createIndex({ category: 1, createdAt: -1 }),
      db.collection("studios").createIndex({ rating: -1, createdAt: -1 }),
      db.collection("bookings").createIndex({ studioId: 1, date: 1, status: 1 }),
      db.collection("bookings").createIndex({ userEmail: 1, createdAt: -1 }),
      db.collection("bookings").createIndex({ ownerEmail: 1, createdAt: -1 }),
      db.collection("reviews").createIndex({ studioId: 1, createdAt: -1 }),
      db.collection("wishlists").createIndex(
        { userEmail: 1, studioId: 1 },
        { unique: true }
      ),
    ]);
  })().catch((error) => {
    state.indexesPromise = null;
    throw error;
  });

  return state.indexesPromise;
}
