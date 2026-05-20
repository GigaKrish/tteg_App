// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token from Authorization header
 * Token format: "Bearer <token>"
 * Adds user info to request object (req.userId, req.user)
 */
const protect = (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user ID and full user data to request
    req.userId = decoded.userId;
    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please login again.'
      });
    }

    console.error('Auth Middleware Error:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Not authorized. Invalid token.'
    });
  }
};

/**
 * Optional middleware for role-based access control
 * Use for future extensibility (e.g., admin routes)
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (req.user && req.user.role === requiredRole) {
      next();
    } else {
      res.status(403).json({
        success: false,
        error: `${requiredRole} access required`
      });
    }
  };
};

module.exports = { protect, requireRole };
