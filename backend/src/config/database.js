// src/config/database.js
const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 * - Handles connection pooling
 * - Sets proper timeout options
 * - Graceful error handling
 */
const connectDB = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✓ MongoDB connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

/**
 * Disconnect from MongoDB database
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('✓ MongoDB disconnected');
  } catch (error) {
    console.error('✗ MongoDB disconnect error:', error.message);
  }
};

module.exports = { connectDB, disconnectDB };


