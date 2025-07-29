const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'file', 'link']
    },
    url: String,
    filename: String,
    size: Number
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
messageSchema.index({ user: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ 'reactions.user': 1 });

// Virtual for formatted timestamp
messageSchema.virtual('formattedTime').get(function() {
  return this.createdAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for formatted date
messageSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for reaction count
messageSchema.virtual('reactionCount').get(function() {
  return this.reactions.length;
});

// Pre-save middleware to handle mentions
messageSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    // Extract mentions from content (@username)
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(this.content)) !== null) {
      mentions.push(match[1]);
    }
    
    this.mentions = mentions;
  }
  next();
});

// Instance method to add reaction
messageSchema.methods.addReaction = function(userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(
    reaction => reaction.user.toString() !== userId.toString()
  );
  
  // Add new reaction
  this.reactions.push({
    user: userId,
    emoji: emoji
  });
  
  return this.save();
};

// Instance method to remove reaction
messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(
    reaction => reaction.user.toString() !== userId.toString()
  );
  
  return this.save();
};

// Instance method to soft delete
messageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to edit message
messageSchema.methods.editMessage = function(newContent) {
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

// Static method to get messages with pagination
messageSchema.statics.getMessages = function(page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  
  return this.find({ isDeleted: false })
    .populate('user', 'name avatar')
    .populate('replyTo', 'content user')
    .populate('mentions', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Static method to search messages
messageSchema.statics.searchMessages = function(query, userId = null) {
  const searchQuery = {
    isDeleted: false,
    content: { $regex: query, $options: 'i' }
  };
  
  if (userId) {
    searchQuery.user = userId;
  }
  
  return this.find(searchQuery)
    .populate('user', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
};

// Static method to get message statistics
messageSchema.statics.getMessageStats = function() {
  return this.aggregate([
    {
      $match: { isDeleted: false }
    },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        totalReactions: { $sum: { $size: '$reactions' } },
        avgReactionsPerMessage: { $avg: { $size: '$reactions' } },
        messagesWithReactions: {
          $sum: { $cond: [{ $gt: [{ $size: '$reactions' }, 0] }, 1, 0] }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Message', messageSchema); 