import mongoose from 'mongoose';

const globalForMongoose = globalThis;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add it in Vercel → Settings → Environment Variables.');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!globalForMongoose.mongoosePromise) {
    globalForMongoose.mongoosePromise = mongoose
      .connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10000,
      })
      .catch((err) => {
        globalForMongoose.mongoosePromise = null;
        throw err;
      });
  }

  await globalForMongoose.mongoosePromise;
  return mongoose.connection;
}
