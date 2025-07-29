import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  sendMessage: (content: string, messageType?: string, attachments?: any[], replyTo?: string) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  removeReaction: (messageId: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: React.ReactNode;
}

// Secure token retrieval
const getSecureToken = (): string | null => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    
    // Validate token format
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Invalid stored token format');
      }
      localStorage.removeItem('auth_token');
      return null;
    }
    
    return token;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to retrieve token:', error);
    }
    return null;
  }
};

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const token = getSecureToken();
    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        console.error('No valid token found for socket connection');
      }
      return;
    }

    const socketUrl = process.env.REACT_APP_SOCKET_URL || (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5000');
    
    const newSocket = io(socketUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    newSocket.on('connect', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Connected to socket server');
      }
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Disconnected from socket server');
      }
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('Socket connection error:', error);
      }
      setConnected(false);
      
      // Handle authentication errors
      if (error.message === 'Authentication failed' || error.message === 'Authentication token required') {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const sendMessage = (content: string, messageType = 'text', attachments: any[] = [], replyTo?: string) => {
    if (socket && connected) {
      // Validate message content
      if (!content || content.trim().length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Cannot send empty message');
        }
        return;
      }
      
      if (content.length > 1000) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Message too long');
        }
        return;
      }

      socket.emit('send_message', {
        content: content.trim(),
        messageType,
        attachments,
        replyTo
      });
    }
  };

  const editMessage = (messageId: string, content: string) => {
    if (socket && connected) {
      // Validate inputs
      if (!messageId || !content || content.trim().length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Invalid message edit parameters');
        }
        return;
      }
      
      if (content.length > 1000) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Message too long');
        }
        return;
      }

      socket.emit('edit_message', {
        messageId,
        content: content.trim()
      });
    }
  };

  const deleteMessage = (messageId: string) => {
    if (socket && connected && messageId) {
      socket.emit('delete_message', {
        messageId
      });
    }
  };

  const addReaction = (messageId: string, emoji: string) => {
    if (socket && connected && messageId && emoji) {
      socket.emit('add_reaction', {
        messageId,
        emoji
      });
    }
  };

  const removeReaction = (messageId: string) => {
    if (socket && connected && messageId) {
      socket.emit('remove_reaction', {
        messageId
      });
    }
  };

  const startTyping = () => {
    if (socket && connected) {
      socket.emit('typing_start');
    }
  };

  const stopTyping = () => {
    if (socket && connected) {
      socket.emit('typing_stop');
    }
  };

  const value: SocketContextType = {
    socket,
    connected,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    startTyping,
    stopTyping
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}; 