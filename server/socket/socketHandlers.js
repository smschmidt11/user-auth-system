const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const { verifyToken } = require('../middleware/auth');

const connectedUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId

const setupSocketHandlers = (io) => {
  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error('Invalid token'));
      }

      const user = await User.findById(decoded.userId).select('-password');
      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`User connected: ${user.name} (${user._id})`);

    // Store user connection
    connectedUsers.set(user._id.toString(), socket.id);
    userSockets.set(socket.id, user._id.toString());

    // Join user to their personal room
    socket.join(`user_${user._id}`);
    
    // Join user to general chat room
    socket.join('general');

    // Emit user connected event
    socket.to('general').emit('user_connected', {
      userId: user._id,
      name: user.name,
      avatar: user.avatar,
      timestamp: new Date()
    });

    // Send current online users to the new user
    const onlineUsers = Array.from(connectedUsers.keys()).map(userId => ({
      userId,
      socketId: connectedUsers.get(userId)
    }));
    socket.emit('online_users', onlineUsers);

    // Handle new message
    socket.on('send_message', async (data) => {
      try {
        const { content, messageType = 'text', attachments = [], replyTo } = data;

        if (!content || content.trim().length === 0) {
          socket.emit('error', { message: 'Message content is required' });
          return;
        }

        if (content.length > 1000) {
          socket.emit('error', { message: 'Message content cannot exceed 1000 characters' });
          return;
        }

        const messageData = {
          user: user._id,
          content: content.trim(),
          messageType,
          attachments
        };

        if (replyTo) {
          messageData.replyTo = replyTo;
        }

        const message = new Message(messageData);
        await message.save();

        // Populate user info
        await message.populate('user', 'name avatar');
        if (replyTo) {
          await message.populate('replyTo', 'content user');
        }

        const messagePayload = {
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
        };

        // Broadcast to all users in general room
        io.to('general').emit('new_message', messagePayload);

        // Emit confirmation to sender
        socket.emit('message_sent', { success: true, messageId: message._id });

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle message edit
    socket.on('edit_message', async (data) => {
      try {
        const { messageId, content } = data;

        if (!content || content.trim().length === 0) {
          socket.emit('error', { message: 'Message content is required' });
          return;
        }

        if (content.length > 1000) {
          socket.emit('error', { message: 'Message content cannot exceed 1000 characters' });
          return;
        }

        const message = await Message.findById(messageId);

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Check if user can edit this message
        if (message.user.toString() !== user._id.toString() && user.role !== 'admin') {
          socket.emit('error', { message: 'You can only edit your own messages' });
          return;
        }

        await message.editMessage(content.trim());
        await message.populate('user', 'name avatar');

        const messagePayload = {
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
        };

        // Broadcast edit to all users
        io.to('general').emit('message_edited', messagePayload);

      } catch (error) {
        console.error('Edit message error:', error);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    // Handle message deletion
    socket.on('delete_message', async (data) => {
      try {
        const { messageId } = data;

        const message = await Message.findById(messageId);

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Check if user can delete this message
        if (message.user.toString() !== user._id.toString() && user.role !== 'admin') {
          socket.emit('error', { message: 'You can only delete your own messages' });
          return;
        }

        await message.softDelete();

        // Broadcast deletion to all users
        io.to('general').emit('message_deleted', { messageId });

      } catch (error) {
        console.error('Delete message error:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // Handle message reactions
    socket.on('add_reaction', async (data) => {
      try {
        const { messageId, emoji } = data;

        if (!emoji) {
          socket.emit('error', { message: 'Emoji is required' });
          return;
        }

        const message = await Message.findById(messageId);

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        await message.addReaction(user._id, emoji);

        // Broadcast reaction to all users
        io.to('general').emit('reaction_added', {
          messageId,
          reactions: message.reactions
        });

      } catch (error) {
        console.error('Add reaction error:', error);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });

    // Handle reaction removal
    socket.on('remove_reaction', async (data) => {
      try {
        const { messageId } = data;

        const message = await Message.findById(messageId);

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        await message.removeReaction(user._id);

        // Broadcast reaction removal to all users
        io.to('general').emit('reaction_removed', {
          messageId,
          reactions: message.reactions
        });

      } catch (error) {
        console.error('Remove reaction error:', error);
        socket.emit('error', { message: 'Failed to remove reaction' });
      }
    });

    // Handle typing indicator
    socket.on('typing_start', () => {
      socket.to('general').emit('user_typing', {
        userId: user._id,
        name: user.name,
        timestamp: new Date()
      });
    });

    socket.on('typing_stop', () => {
      socket.to('general').emit('user_stopped_typing', {
        userId: user._id,
        timestamp: new Date()
      });
    });

    // Handle user status updates
    socket.on('update_status', (data) => {
      const { status } = data;
      socket.to('general').emit('user_status_update', {
        userId: user._id,
        status,
        timestamp: new Date()
      });
    });

    // Handle private messages (future feature)
    socket.on('private_message', async (data) => {
      try {
        const { recipientId, content } = data;

        if (!content || content.trim().length === 0) {
          socket.emit('error', { message: 'Message content is required' });
          return;
        }

        const message = new Message({
          user: user._id,
          content: content.trim(),
          messageType: 'private',
          recipient: recipientId
        });

        await message.save();
        await message.populate('user', 'name avatar');

        const messagePayload = {
          id: message._id,
          content: message.content,
          user: {
            id: message.user._id,
            name: message.user.name,
            avatar: message.user.avatar
          },
          createdAt: message.createdAt,
          formattedTime: message.formattedTime
        };

        // Send to recipient if online
        const recipientSocketId = connectedUsers.get(recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('private_message', messagePayload);
        }

        // Send confirmation to sender
        socket.emit('private_message_sent', { success: true, messageId: message._id });

      } catch (error) {
        console.error('Private message error:', error);
        socket.emit('error', { message: 'Failed to send private message' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${user.name} (${user._id})`);

      // Remove user from connected users
      connectedUsers.delete(user._id.toString());
      userSockets.delete(socket.id);

      // Emit user disconnected event
      socket.to('general').emit('user_disconnected', {
        userId: user._id,
        name: user.name,
        timestamp: new Date()
      });
    });
  });

  // Error handling
  io.on('error', (error) => {
    console.error('Socket.io error:', error);
  });
};

// Helper function to get online users count
const getOnlineUsersCount = () => {
  return connectedUsers.size;
};

// Helper function to get online users
const getOnlineUsers = () => {
  return Array.from(connectedUsers.entries()).map(([userId, socketId]) => ({
    userId,
    socketId
  }));
};

// Helper function to send message to specific user
const sendToUser = (userId, event, data) => {
  const socketId = connectedUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

// Helper function to broadcast to all users
const broadcastToAll = (event, data) => {
  io.emit(event, data);
};

module.exports = {
  setupSocketHandlers,
  getOnlineUsersCount,
  getOnlineUsers,
  sendToUser,
  broadcastToAll
}; 