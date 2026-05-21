// src/controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { logLogin } = require('../utils/logger');

/**
 * Generate JWT token with proper payload structure
 * Payload includes userId and email for identification
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      fullName: user.fullName,
      assignedGeotrons: user.assignedGeotrons
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * User Login
 * POST /auth/login
 * - Validates credentials
 * - Generates JWT token
 * - Returns user data and token
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      logLogin(email || 'Unknown', false, req.ip, 'Missing credentials');
      const error = new Error('Email and password required');
      error.statusCode = 400;
      throw error;
    }

    // Find user and select password field explicitly (since it's normally hidden)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      logLogin(email, false, req.ip, 'Invalid email');
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    // Check if user is active
    if (!user.isActive) {
      logLogin(email, false, req.ip, 'Account deactivated');
      const error = new Error('Account is deactivated');
      error.statusCode = 403;
      throw error;
    }

    // Compare password using the User model method
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logLogin(email, false, req.ip, 'Invalid password');
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    // Generate token
    const token = generateToken(user);

    // Log successful login
    logLogin(email, true, req.ip);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        assignedGeotrons: user.assignedGeotrons
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * User Registration
 * POST /auth/register
 * NOTE: Currently disabled as user registration is handled by admin dashboard
 * Users are created in the database directly by administrators
 */
exports.register = async (req, res, next) => {
  try {
    // Registration endpoint disabled for security
    // Users are created by admin dashboard only
    const error = new Error('Registration is not available. Contact admin for account creation.');
    error.statusCode = 403;
    throw error;
  } catch (error) {
    next(error);
  }
};

/**
 * Get Current User
 * GET /auth/me
 * Requires authentication
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * User Logout
 * POST /auth/logout
 * Note: JWT is stateless, so logout just clears client-side storage
 */
exports.logout = async (req, res, next) => {
  try {
    // Log logout (fire-and-forget)
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

