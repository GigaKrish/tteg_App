// index.js - Main server entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB, disconnectDB } = require('./src/config/database');
const { validateEnv } = require('./src/config/env');
const { initializeAzure } = require('./src/config/azure');
const errorHandler = require('./src/middleware/errorHandler');
const rateLimiter = require('./src/middleware/rateLimiter');

// Validate environment variables first
validateEnv();

// Initialize database connection
connectDB();

// Initialize Azure Storage
initializeAzure();

const app = express();

// Trust proxy for rate limiting behind load balancers (Render, AWS, etc.)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ============ MIDDLEWARE (in order of importance) ============

// Security headers
app.use(helmet());

// CORS configuration - Allow frontend origins
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:8081'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsers - 5MB limit for JSON; file uploads go through multer (separate limit)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Rate limiting - Prevent abuse
app.use('/auth', rateLimiter);
app.use('/api', rateLimiter);

// ============ API ROUTES ============

// Health check endpoint - No auth required
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Authentication routes
app.use('/auth', require('./src/routes/auth'));

// Report and upload routes
app.use('/api/upload', require('./src/routes/upload'));



// ============ ERROR HANDLING ============

// 404 handler - Route not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      statusCode: 404,
      message: 'Route not found',
      path: req.path,
      method: req.method
    }
  });
});

// Centralized error handler (must be last)
app.use(errorHandler);

// ============ GRACEFUL SHUTDOWN ============

const gracefulShutdown = async (signal) => {
  console.log(`\n📊 ${signal} received, closing server gracefully...`);

  server.close(async () => {
    console.log('✓ HTTP server closed');
    await disconnectDB();
    console.log('✓ Database disconnected');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============ START SERVER ============

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🚀 TTEG Backend Server Running        ║
║  📡 Port: ${PORT.toString().padEnd(30)}║
║  🌍 Environment: ${(process.env.NODE_ENV || 'development').padEnd(20)}║
║  📧 API URL: http://localhost:${PORT}   ║
╚════════════════════════════════════════╝
  `);
});

module.exports = app;

