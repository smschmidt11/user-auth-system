#!/bin/bash

# User Authentication System Setup Script
echo "🚀 Setting up User Authentication System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to generate secure random string
generate_secret() {
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || \
    openssl rand -hex 32 2>/dev/null || \
    echo "generate-secure-secret-$(date +%s)-$(head -c 16 /dev/urandom | xxd -p)"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    print_success "Node.js $(node -v) is installed"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    print_success "npm $(npm -v) is installed"
}

# Check if MongoDB is installed (optional)
check_mongodb() {
    if command -v mongod &> /dev/null; then
        print_success "MongoDB is installed"
    else
        print_warning "MongoDB is not installed. You can use Docker or install MongoDB locally."
        print_warning "For Docker: docker run -d -p 27017:27017 --name mongodb mongo:6.0"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing root dependencies..."
    npm install
    
    print_status "Installing server dependencies..."
    cd server && npm install && cd ..
    
    print_status "Installing client dependencies..."
    cd client && npm install && cd ..
    
    print_success "All dependencies installed successfully"
}

# Create environment files with secure defaults
setup_environment() {
    print_status "Setting up environment files..."
    
    # Generate secure secrets
    JWT_SECRET=$(generate_secret)
    SESSION_SECRET=$(generate_secret)
    MONGO_PASSWORD=$(generate_secret | cut -c1-16)
    MONGO_EXPRESS_PASSWORD=$(generate_secret | cut -c1-16)
    
    # Create server .env file if it doesn't exist
    if [ ! -f "server/.env" ]; then
        cat > server/.env << EOF
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/auth-system

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# Google OAuth
# Get these from: https://console.developers.google.com/
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# External APIs
# Get from: https://openweathermap.org/api
WEATHER_API_KEY=your-openweathermap-api-key

# Client Configuration
CLIENT_URL=http://localhost:3000

# Session Configuration
SESSION_SECRET=${SESSION_SECRET}

# MongoDB Configuration (for Docker)
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=${MONGO_PASSWORD}

# MongoDB Express (optional)
MONGO_EXPRESS_USERNAME=admin
MONGO_EXPRESS_PASSWORD=${MONGO_EXPRESS_PASSWORD}

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379
EOF
        print_success "Created server/.env file with secure secrets"
        print_warning "Please update server/.env with your API keys (Google OAuth, Weather API)"
    else
        print_warning "server/.env already exists"
        print_warning "Please ensure your JWT_SECRET and SESSION_SECRET are at least 32 characters long"
    fi
    
    # Create client .env file if it doesn't exist
    if [ ! -f "client/.env" ]; then
        cat > client/.env << EOF
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
EOF
        print_success "Created client/.env file"
    else
        print_warning "client/.env already exists"
    fi

    # Create .env file for Docker Compose
    if [ ! -f ".env" ]; then
        cat > .env << EOF
# Docker Compose Environment Variables
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=${MONGO_PASSWORD}
MONGO_EXPRESS_USERNAME=admin
MONGO_EXPRESS_PASSWORD=${MONGO_EXPRESS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
WEATHER_API_KEY=your-openweathermap-api-key
CLIENT_URL=http://localhost:3000
EOF
        print_success "Created .env file for Docker Compose"
    else
        print_warning ".env file already exists"
    fi
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    # Check if MongoDB is running
    if command -v mongod &> /dev/null; then
        if pgrep -x "mongod" > /dev/null; then
            print_success "MongoDB is running"
        else
            print_warning "MongoDB is not running. Please start MongoDB:"
            print_warning "  sudo systemctl start mongod (Linux)"
            print_warning "  brew services start mongodb/brew/mongodb-community (macOS)"
        fi
    fi
}

# Build client
build_client() {
    print_status "Building client application..."
    cd client && npm run build && cd ..
    print_success "Client built successfully"
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    mkdir -p logs
    mkdir -p uploads
    mkdir -p scripts
    print_success "Directories created"
}

# Security checks
security_checks() {
    print_status "Performing security checks..."
    
    # Check if .env files are in .gitignore
    if ! grep -q "\.env" .gitignore; then
        print_warning ".env files are not in .gitignore - adding them"
        echo "" >> .gitignore
        echo "# Environment files" >> .gitignore
        echo ".env" >> .gitignore
        echo "*.env" >> .gitignore
    fi
    
    # Check for hardcoded secrets
    if grep -r "password123\|your-secret\|your-key" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null; then
        print_warning "Found potential hardcoded secrets in the codebase"
        print_warning "Please review and replace with environment variables"
    fi
    
    print_success "Security checks completed"
}

# Display next steps
show_next_steps() {
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "🔒 Security Features:"
    echo "  ✅ Secure JWT and Session secrets generated"
    echo "  ✅ Password hashing with bcrypt"
    echo "  ✅ Rate limiting configured"
    echo "  ✅ Input validation implemented"
    echo "  ✅ CORS and security headers enabled"
    echo ""
    echo "📋 Next steps:"
    echo "1. Update server/.env with your API keys:"
    echo "   - GOOGLE_CLIENT_ID"
    echo "   - GOOGLE_CLIENT_SECRET"
    echo "   - WEATHER_API_KEY"
    echo ""
    echo "2. Start the development servers:"
    echo "   npm run dev"
    echo ""
    echo "3. Access the application:"
    echo "   - Frontend: http://localhost:3000"
    echo "   - Backend API: http://localhost:5000"
    echo "   - API Health: http://localhost:5000/api/health"
    echo ""
    echo "4. For production deployment:"
    echo "   - Use Docker: docker-compose up -d"
    echo "   - Or deploy to AWS using aws-deployment.yml"
    echo ""
    echo "🔐 Security Notes:"
    echo "  - All secrets are stored in environment variables"
    echo "  - Passwords are encrypted with bcrypt"
    echo "  - JWT tokens have proper validation"
    echo "  - Rate limiting prevents brute force attacks"
    echo ""
    echo "📚 Documentation: README.md"
    echo ""
}

# Main setup function
main() {
    echo "🔧 User Authentication System Setup"
    echo "=================================="
    echo ""
    
    # Check prerequisites
    check_node
    check_npm
    check_mongodb
    
    # Install dependencies
    install_dependencies
    
    # Setup environment
    setup_environment
    
    # Setup database
    setup_database
    
    # Create directories
    create_directories
    
    # Security checks
    security_checks
    
    # Build client
    build_client
    
    # Show next steps
    show_next_steps
}

# Run main function
main 