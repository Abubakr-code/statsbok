const mongoose = require('mongoose');

/**
 * Connect to MongoDB. Uses MONGODB_URI from environment.
 * Exits the process on failure so the container restarts cleanly.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Check your .env file.');
    process.exit(1);
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });
}

module.exports = connectDB;
