// src/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateLogin } = require('../validators/authValidator');
const { protect } = require('../middleware/authMiddleware');

const rateLimit = require('express-rate-limit');

// Rate Limiter: Max 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login only - user registration is handled by admin/database directly
router.post('/login', loginLimiter, validateLogin, authController.login);

// Get current user profile (used by frontend refreshUser)
router.get('/me', protect, authController.getMe);

module.exports = router;

