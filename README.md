# User Authentication System

A comprehensive full-stack application featuring user authentication, real-time chat, external API integration, and cloud deployment capabilities.

## Features

- 🔐 **OAuth Authentication** - Google OAuth integration with JWT tokens
- 💬 **Real-time Chat** - Socket.io powered chat system
- 🌤️ **External API Integration** - Weather API integration
- 🗄️ **Database Design** - MongoDB with proper schema design
- 🚀 **Cloud Ready** - AWS deployment configuration
- 📱 **Modern UI** - React with TypeScript and Tailwind CSS

## Tech Stack

### Backend
- Node.js with Express
- MongoDB with Mongoose
- Socket.io for real-time features
- JWT for authentication
- Passport.js for OAuth

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- Socket.io client
- Axios for API calls

### External APIs
- Google OAuth API
- OpenWeatherMap API

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd user-auth-system
   npm run install-all
   ```

2. **Set up environment variables:**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your API keys
   ```

3. **Start the development servers:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Environment Variables

Create a `.env` file in the server directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/auth-system
JWT_SECRET=your-jwt-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
WEATHER_API_KEY=your-openweathermap-api-key
CLIENT_URL=http://localhost:3000
```

## API Documentation

### Authentication Endpoints
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Chat Endpoints
- `GET /api/chat/messages` - Get chat messages
- `POST /api/chat/messages` - Send a message

### Weather Endpoints
- `GET /api/weather/:city` - Get weather for a city

## Database Schema

### User Model
```javascript
{
  googleId: String,
  email: String,
  name: String,
  avatar: String,
  createdAt: Date
}
```

### Message Model
```javascript
{
  user: ObjectId,
  content: String,
  timestamp: Date
}
```

## Deployment

### AWS Deployment
1. Build the application: `npm run build`
2. Deploy to AWS using the provided configuration files
3. Set up environment variables in AWS

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License 