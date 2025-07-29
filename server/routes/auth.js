const express = require('express');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { generateToken, authenticateToken, sanitizeUser } = require('../middleware/auth');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to sensitive endpoints
router.use('/google', authLimiter);
router.use('/logout', authLimiter);
router.use('/refresh', authLimiter);

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/login',
    session: false 
  }),
  async (req, res) => {
    try {
      const { user } = req;
      
      if (!user) {
        return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
      }

      // Update last login
      await user.updateLastLogin();

      // Generate JWT token
      const token = generateToken(user._id);

      // Redirect to frontend with token
      res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.CLIENT_URL}/login?error=server_error`);
    }
  }
);

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      success: true,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get user information'
    });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In a more complex system, you might want to blacklist the token
    // For now, we'll just return success
    res.json({
      success: true,
      message: 'Successfully logged out'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to logout'
    });
  }
});

// Refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Generate new token
    const newToken = generateToken(user._id);
    
    res.json({
      success: true,
      token: newToken,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to refresh token'
    });
  }
});

// Update user preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { theme, notifications } = req.body;
    const user = req.user;

    // Validate theme
    if (theme && !['light', 'dark', 'auto'].includes(theme)) {
      return res.status(400).json({
        error: 'Invalid theme',
        message: 'Theme must be light, dark, or auto'
      });
    }

    // Validate notifications object
    if (notifications && typeof notifications !== 'object') {
      return res.status(400).json({
        error: 'Invalid notifications',
        message: 'Notifications must be an object'
      });
    }

    // Update preferences
    if (theme) {
      user.preferences.theme = theme;
    }
    
    if (notifications) {
      user.preferences.notifications = {
        ...user.preferences.notifications,
        ...notifications
      };
    }

    await user.save();

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: user.preferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to update preferences'
    });
  }
});

// Get user statistics (admin only)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }

    const stats = await User.getStats();
    
    res.json({
      success: true,
      stats: stats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        verifiedUsers: 0,
        avgLoginCount: 0
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get user statistics'
    });
  }
});

// Deactivate account
router.post('/deactivate', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to deactivate account'
    });
  }
});

module.exports = router; 