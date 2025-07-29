import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  isEmailVerified: boolean;
  lastLogin: string;
  loginCount: number;
  preferences: {
    theme: string;
    notifications: {
      email: boolean;
      push: boolean;
    };
  };
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

// Secure token storage with validation
const secureTokenStorage = {
  setToken: (token: string) => {
    if (!token || typeof token !== 'string') {
      if (process.env.NODE_ENV === 'development') {
        console.error('Invalid token provided');
      }
      return false;
    }
    
    // Validate token format (basic JWT structure)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Invalid JWT token format');
      }
      return false;
    }
    
    try {
      localStorage.setItem('auth_token', token);
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to store token:', error);
      }
      return false;
    }
  },
  
  getToken: (): string | null => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return null;
      
      // Validate token format
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Invalid stored token format');
        }
        secureTokenStorage.removeToken();
        return null;
      }
      
      return token;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to retrieve token:', error);
      }
      return null;
    }
  },
  
  removeToken: () => {
    try {
      localStorage.removeItem('auth_token');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to remove token:', error);
      }
    }
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Set up axios defaults
  const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5000');
  axios.defaults.baseURL = apiUrl;

  // Add token to requests if it exists
  axios.interceptors.request.use((config) => {
    const token = secureTokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Handle token expiration and errors
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        secureTokenStorage.removeToken();
        setUser(null);
        toast.error('Session expired. Please login again.');
      }
      return Promise.reject(error);
    }
  );

  const login = (token: string) => {
    if (secureTokenStorage.setToken(token)) {
      fetchUser();
    } else {
      toast.error('Invalid authentication token');
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Logout error:', error);
      }
    } finally {
      secureTokenStorage.removeToken();
      setUser(null);
      toast.success('Successfully logged out');
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const fetchUser = async () => {
    try {
      const token = secureTokenStorage.getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.get('/api/auth/me');
      setUser(response.data.user);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Fetch user error:', error);
      }
      secureTokenStorage.removeToken();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 