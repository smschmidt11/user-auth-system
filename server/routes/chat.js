const express = require('express');
const Message = require('../models/Message');
const { authenticateToken, requireModerator } = require('../middleware/auth');

const router = express.Router();

// Get messages with pagination
router.get('/messages', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search;

    let messages;
    
    if (search) {
      messages = await Message.searchMessages(search);
    } else {
      messages = await Message.getMessages(page, limit);
    }

    res.json({
      success: true,
      messages: messages.reverse(), // Show oldest first
      pagination: {
        page,
        limit,
        hasMore: messages.length === limit
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch messages'
    });
  }
});

// Send a message
router.post('/messages', authenticateToken, async (req, res) => {
  try {
    const { content, messageType = 'text', attachments = [], replyTo } = req.body;
    const userId = req.user._id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Message content is required'
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Message content cannot exceed 1000 characters'
      });
    }

    const messageData = {
      user: userId,
      content: content.trim(),
      messageType,
      attachments
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    const message = new Message(messageData);
    await message.save();

    // Populate user info for response
    await message.populate('user', 'name avatar');
    if (replyTo) {
      await message.populate('replyTo', 'content user');
    }

    res.status(201).json({
      success: true,
      message: {
        id: message._id,
        content: message.content,
        messageType: message.messageType,
        attachments: message.attachments,
        user: {
          id: message.user._id,
          name: message.user.name,
          avatar: message.user.avatar
        },
        replyTo: message.replyTo,
        createdAt: message.createdAt,
        formattedTime: message.formattedTime
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to send message'
    });
  }
});

// Edit a message
router.put('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Message content is required'
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Message content cannot exceed 1000 characters'
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        error: 'Message not found',
        message: 'The specified message does not exist'
      });
    }

    // Check if user can edit this message
    if (message.user.toString() !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only edit your own messages'
      });
    }

    await message.editMessage(content.trim());
    await message.populate('user', 'name avatar');

    res.json({
      success: true,
      message: {
        id: message._id,
        content: message.content,
        isEdited: message.isEdited,
        editedAt: message.editedAt,
        user: {
          id: message.user._id,
          name: message.user.name,
          avatar: message.user.avatar
        },
        createdAt: message.createdAt,
        formattedTime: message.formattedTime
      }
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to edit message'
    });
  }
});

// Delete a message (soft delete)
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        error: 'Message not found',
        message: 'The specified message does not exist'
      });
    }

    // Check if user can delete this message
    if (message.user.toString() !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only delete your own messages'
      });
    }

    await message.softDelete();

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to delete message'
    });
  }
});

// Add reaction to message
router.post('/messages/:messageId/reactions', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Emoji is required'
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        error: 'Message not found',
        message: 'The specified message does not exist'
      });
    }

    await message.addReaction(userId, emoji);

    res.json({
      success: true,
      message: 'Reaction added successfully',
      reactions: message.reactions
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to add reaction'
    });
  }
});

// Remove reaction from message
router.delete('/messages/:messageId/reactions', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        error: 'Message not found',
        message: 'The specified message does not exist'
      });
    }

    await message.removeReaction(userId);

    res.json({
      success: true,
      message: 'Reaction removed successfully',
      reactions: message.reactions
    });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to remove reaction'
    });
  }
});

// Get chat statistics (moderator/admin only)
router.get('/stats', authenticateToken, requireModerator, async (req, res) => {
  try {
    const stats = await Message.getMessageStats();
    
    res.json({
      success: true,
      stats: stats[0] || {
        totalMessages: 0,
        totalReactions: 0,
        avgReactionsPerMessage: 0,
        messagesWithReactions: 0
      }
    });
  } catch (error) {
    console.error('Get chat stats error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get chat statistics'
    });
  }
});

// Search messages
router.get('/search', async (req, res) => {
  try {
    const { q: query, userId } = req.query;

    if (!query) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Search query is required'
      });
    }

    const messages = await Message.searchMessages(query, userId);

    res.json({
      success: true,
      messages,
      query
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to search messages'
    });
  }
});

module.exports = router; 