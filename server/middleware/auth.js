const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        message: 'Please provide a valid authentication token'
      });
    }

    // Validate token format
    if (!/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(token)) {
      return res.status(401).json({ 
        error: 'Invalid token format',
        message: 'The provided token has an invalid format'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Validate decoded token structure
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ 
        error: 'Invalid token payload',
        message: 'The token contains invalid data'
      });
    }

    // Validate userId format (MongoDB ObjectId)
    if (!/^[0-9a-fA-F]{24}$/.test(decoded.userId)) {
      return res.status(401).json({ 
        error: 'Invalid user ID',
        message: 'The token contains an invalid user ID'
      });
    }
    
    // Find user and attach to request
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        error: 'Account deactivated',
        message: 'Your account has been deactivated'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Your session has expired. Please login again'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please login to access this resource'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Admin privileges required'
    });
  }

  next();
};

// Middleware to check if user is moderator or admin
const requireModerator = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please login to access this resource'
    });
  }

  if (!['admin', 'moderator'].includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Moderator privileges required'
    });
  }

  next();
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // Validate token format
      if (!/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(token)) {
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Rate limiting for authentication endpoints
const authRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
};

// Generate JWT token with additional security
const generateToken = (userId) => {
  if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
    throw new Error('Invalid user ID provided for token generation');
  }

  return jwt.sign(
    { 
      userId,
      iat: Math.floor(Date.now() / 1000),
      type: 'access'
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'auth-system',
      audience: 'auth-system-users'
    }
  );
};

// Verify JWT token without middleware
const verifyToken = (token) => {
  try {
    if (!token || !/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(token)) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'auth-system',
      audience: 'auth-system-users'
    });

    // Validate decoded token structure
    if (!decoded || !decoded.userId || !/^[0-9a-fA-F]{24}$/.test(decoded.userId)) {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
};

// Sanitize user data for responses
const sanitizeUser = (user) => {
  if (!user) return null;
  
  const { password, __v, ...sanitizedUser } = user.toObject ? user.toObject() : user;
  return sanitizedUser;
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireModerator,
  optionalAuth,
  authRateLimit,
  generateToken,
  verifyToken,
  sanitizeUser
}; 