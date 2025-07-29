const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      },
      message: 'Please provide a valid email address'
    }
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  avatar: {
    type: String,
    default: null,
    validate: {
      validator: function(url) {
        if (!url) return true; // Allow null/empty
        const urlRegex = /^https?:\/\/.+$/;
        return urlRegex.test(url);
      },
      message: 'Avatar must be a valid URL'
    }
  },
  password: {
    type: String,
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false,
    validate: {
      validator: function(password) {
        if (!password) return true; // Allow empty for OAuth users
        // At least one uppercase, one lowercase, one number, one special character
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(password);
      },
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 0,
    min: [0, 'Login count cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    }
  },
  // Security fields
  failedLoginAttempts: {
    type: Number,
    default: 0,
    min: [0, 'Failed login attempts cannot be negative']
  },
  lockUntil: {
    type: Date,
    default: null
  },
  passwordChangedAt: {
    type: Date,
    default: Date.now
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1 });

// Virtual for user's full profile URL
userSchema.virtual('profileUrl').get(function() {
  return `/api/users/${this._id}`;
});

// Virtual to check if account is locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password if modified
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    // Check password strength
    if (this.password && this.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = Date.now() - 1000; // Ensure token was created after password change
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.loginCount += 1;
  this.failedLoginAttempts = 0; // Reset failed attempts on successful login
  this.lockUntil = null; // Unlock account on successful login
  return this.save();
};

// Instance method to handle failed login
userSchema.methods.handleFailedLogin = function() {
  this.failedLoginAttempts += 1;
  
  // Lock account after 5 failed attempts for 15 minutes
  if (this.failedLoginAttempts >= 5) {
    this.lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
  }
  
  return this.save();
};

// Instance method to check if password was changed after token was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Static method to find by email or googleId
userSchema.statics.findByEmailOrGoogleId = function(email, googleId) {
  return this.findOne({
    $or: [
      { email: email },
      { googleId: googleId }
    ]
  });
};

// Static method to get user stats
userSchema.statics.getStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
        verifiedUsers: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
        avgLoginCount: { $avg: '$loginCount' },
        lockedUsers: { $sum: { $cond: [{ $gt: ['$lockUntil', new Date()] }, 1, 0] } }
      }
    }
  ]);
};

// Static method to clean up expired tokens
userSchema.statics.cleanupExpiredTokens = function() {
  const now = new Date();
  return this.updateMany(
    {
      $or: [
        { passwordResetExpires: { $lt: now } },
        { emailVerificationExpires: { $lt: now } }
      ]
    },
    {
      $unset: {
        passwordResetToken: 1,
        passwordResetExpires: 1,
        emailVerificationToken: 1,
        emailVerificationExpires: 1
      }
    }
  );
};

module.exports = mongoose.model('User', userSchema); 