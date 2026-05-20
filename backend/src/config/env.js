// src/config/env.js
require('dotenv').config();

// Core required variables
const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET'
];

// Optional for local dev - required only in production
const optionalEnvVars = [
  'AZURE_STORAGE_CONNECTION_STRING'
];

const validateEnv = () => {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please create a .env file based on .env.example');
    process.exit(1);
  }

  // Warn about optional vars in development
  const missingOptional = optionalEnvVars.filter(varName => !process.env[varName]);
  if (missingOptional.length > 0 && process.env.NODE_ENV !== 'production') {
    console.log(`⚠️  Optional env vars not set (local mode): ${missingOptional.join(', ')}`);
    console.log('   Files will be saved locally in test_upload/ folder');
  }

  console.log('✓ Environment variables validated');
};


module.exports = { validateEnv };

