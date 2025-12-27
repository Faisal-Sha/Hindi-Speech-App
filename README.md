# Personal Assistant App 🤖

[![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat&logo=react&logoColor=white)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--3.5-412991?style=flat&logo=openai&logoColor=white)](https://openai.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)

A sophisticated, multilingual AI-powered personal assistant application that helps users manage their daily tasks, schedules, and memories through natural language conversation. Built with modern web technologies and designed with an elegant, warm UI aesthetic.

## 🌟 Overview

The Personal Assistant App is a full-stack web application that combines the power of artificial intelligence with intuitive user interface design to create a seamless productivity experience. Users can interact with the assistant in multiple languages, manage multiple data types, and receive intelligent responses to natural language queries.

## ✨ Key Features

### 🧠 AI-Powered Intelligence

- **Natural Language Processing**: Understands context and intent across multiple languages (English, Hindi, Spanish, French, German)
- **Smart Matching**: AI-powered algorithms automatically categorize and organize user data
- **Intelligent Context Building**: Maintains conversation history and contextual awareness

### 📋 Comprehensive Task Management

- **Dynamic Lists**: Create, manage, and organize multiple task lists with checkbox functionality
- **Smart Categorization**: AI automatically assigns tasks to appropriate lists
- **Real-time Updates**: Instant synchronization across all user sessions

### 📅 Schedule Management

- **Flexible Calendar System**: Manage events across multiple schedules
- **Natural Language Input**: Add events using conversational phrases like "meeting tomorrow at 3pm"
- **Event Tracking**: Complete event history with timestamps and descriptions

### 💾 Persistent Memory

- **Multi-Category Storage**: Organize information across customizable memory categories
- **Long-term Data Retention**: PostgreSQL-backed persistent storage ensures data integrity
- **Quick Retrieval**: Efficiently search and access stored information

### 👥 Multi-User Support

- **User Profiles**: Individual user accounts with personalized data
- **Profile Customization**: Custom display names, language preferences, avatar emojis, and themes
- **Family Account System**: Shared authentication with individual user profiles
- **JWT Authentication**: Secure, token-based authentication system

### 🎨 Beautiful User Interface

- **Warm, Cozy Design**: Carefully crafted aesthetic with warm colors and smooth transitions
- **Responsive Layout**: Fully responsive design works seamlessly on all devices
- **Intuitive Navigation**: Clear visual hierarchy and user-friendly controls
- **Custom Theming**: Personalized color schemes and styling options

## 🏗️ Technical Architecture

### Frontend (React 18.2.0)

- **Component-Based Architecture**: Modular, reusable React components
- **State Management**: Efficient state handling with React Hooks
- **Custom Styling**: Hand-crafted CSS with CSS variables for theming
- **Real-time Updates**: Dynamic UI updates without page refreshes

### Backend (Node.js + Express)

- **RESTful API**: Clean, well-documented API endpoints
- **Modular Design**: Separated concerns across multiple modules
  - `server.js` - Main server configuration and startup
  - `routes.js` - API endpoint definitions
  - `database.js` - Database operations and queries
  - `ai-processor.js` - AI intent detection and processing
  - `action-processor.js` - Business logic for data operations
  - `ai-matcher.js` - Smart matching algorithms
  - `auth.js` - Authentication utilities
  - `authRoutes.js` - Authentication endpoints
- **Error Handling**: Comprehensive error handling and logging
- **Rate Limiting**: Protection against abuse with request throttling

### Database (PostgreSQL 16)

- **Relational Data Model**: Well-structured schema with proper relationships
- **Data Integrity**: Foreign key constraints and transactions
- **Optimized Queries**: Efficient database queries with indexing
- **Migration Support**: Database initialization scripts included

### AI Integration (OpenAI GPT-3.5-turbo)

- **Intent Detection**: Determines user intent from natural language input
- **Smart Naming**: AI-generated names for lists and schedules
- **Category Matching**: Intelligent categorization of tasks and events
- **Multilingual Support**: Processes requests in 5+ languages

## 📦 Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Frontend** | React 18.2.0 | UI framework |
| **Styling** | Custom CSS3 | Responsive design |
| **Backend** | Node.js 20.x | Server runtime |
| **Framework** | Express 4.x | Web framework |
| **Database** | PostgreSQL 16 | Data persistence |
| **AI** | OpenAI API | Natural language processing |
| **Authentication** | JWT | Secure user sessions |
| **Security** | bcrypt, express-rate-limit | Password hashing, rate limiting |
| **Deployment** | Docker | Containerization |
| **Web Server** | Nginx | Production web server |
| **SSL/TLS** | Let's Encrypt | Certificate management |

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or higher
- PostgreSQL 16 or higher
- Docker & Docker Compose (for containerized deployment)
- OpenAI API key

### Installation

#### Option 1: Docker Deployment (Recommended)

The entire application (frontend, backend, and PostgreSQL database) can be run using Docker with just a few commands.

**Development Environment:**

1. **Copy the backend environment template and update any secrets:**
   ```bash
   cp backend/.env.example backend/.env
   ```
   Edit `backend/.env` with your API keys and database credentials.

2. **Start all services with live-reload support:**
   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```

3. **Visit the app:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - PostgreSQL: localhost:5432
   - Database Admin (Adminer): http://localhost:8080

**Production Build:**

1. **Provide the required environment variables** (for example by exporting them or by creating a `.env` file next to the compose file). At minimum set `SERVER_NAME` to the public domain that will terminate TLS and the backend secrets described in `backend/.env.example`. 
   
   Example:
   ```env
   SERVER_NAME=voice.example.com
   FRONTEND_URL=https://voice.example.com
   DB_PASSWORD=super-secret
   DB_NAME=personal_assistant
   CERTBOT_RENEW_INTERVAL=12h # optional, defaults to 12 hours
   ```

2. **Request an initial TLS certificate** (only required once per domain). Replace the email and domain with your own values:
   ```bash
   docker compose -f docker-compose.prod.yml run --rm certbot \
     certonly --webroot -w /var/www/certbot \
     -d "$SERVER_NAME" --email you@example.com --agree-tos --no-eff-email
   ```
   > **Note:** The nginx container serves a self-signed certificate until a real one is issued.

3. **Build and start the containers:**
   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```

4. **Access the application** at `https://$SERVER_NAME`. Port `80` remains open so Certbot can renew the certificate using the HTTP challenge.

**Stopping the Application:**

To stop the stack, use `docker compose ... down` with the same compose file that was used to start it:
```bash
# Development
docker compose -f docker-compose.dev.yml down

# Production
docker compose -f docker-compose.prod.yml down
```

> **Data Persistence:** The PostgreSQL data persists in the named Docker volume `postgres-data`, and TLS assets live in `certbot-certs`.

#### Option 2: Manual Installation

**Backend Setup:**
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Initialize database
psql -U postgres -f init-db.sql

# Start backend server
npm start
```

**Frontend Setup:**
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm start

# Access application at http://localhost:3000
```

### Environment Configuration

**Backend (.env):**
```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=personal_assistant

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Authentication
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d

# Supabase (Optional)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 📚 API Documentation

### Core Endpoints

#### Health Check
```
GET /health
```
Returns server status and database connection health.

#### User Management
```
GET /users
```
Retrieve all user profiles with activity statistics.

```
GET /data/:userId
```
Fetch all data for a specific user (lists, schedules, memory).

#### Chat Processing
```
POST /chat
Content-Type: application/json

{
  "userId": "user123",
  "message": "Add milk to shopping list",
  "language": "en-US",
  "mode": "all"
}
```
Process natural language commands with AI.

#### List Management
```
GET /lists/:userId
POST /lists/:userId
PUT /lists/:userId/:listName
DELETE /lists/:userId/:listName
```
Complete CRUD operations for task lists.

#### Schedule Management
```
GET /schedules/:userId
POST /schedules/:userId
PUT /schedules/:userId/:scheduleName
DELETE /schedules/:userId/:scheduleName
```
Manage calendar events and schedules.

#### Memory Management
```
GET /memory/:userId
POST /memory/:userId
PUT /memory/:userId/:categoryName
DELETE /memory/:userId/:categoryName
```
Store and retrieve user information.

### Authentication Endpoints

```
POST /auth/register    - Create new account
POST /auth/login       - User login
POST /auth/logout      - User logout
GET  /auth/me          - Get user profile
POST /auth/forgot-password - Password reset
```

## 🎯 Use Cases

1. **Task Management**: "Add buy groceries, clean kitchen, and call mom to my todo list"
2. **Event Scheduling**: "Schedule dentist appointment next Tuesday at 2pm"
3. **Information Storage**: "Remember that my doctor's phone number is 555-1234"
4. **Quick Retrieval**: "What's on my shopping list?"
5. **Multilingual**: "Añade estudiar español a mi lista de tareas" (Spanish)

## 🔒 Security Features

- **JWT Authentication**: Secure token-based user sessions
- **Password Hashing**: bcrypt encryption for user passwords
- **Rate Limiting**: Protection against brute force attacks
- **CORS Configuration**: Controlled cross-origin resource sharing
- **SQL Injection Prevention**: Parameterized queries
- **Input Validation**: Comprehensive input sanitization

## 🎨 Design Philosophy

The application follows a warm, cozy design aesthetic intended to make productivity feel approachable and pleasant:

- **Color Palette**: Warm caramel (#C8A882), soft peachy cream (#E4C4A0), and dusty pink (#E8C5C1)
- **Typography**: Inter font family for clean, modern readability
- **Spacing**: Consistent spacing system for visual harmony
- **Animations**: Smooth transitions and hover effects
- **Background**: Subtle gradient overlays with carefully selected imagery

## 📈 Performance Optimizations

- **Database Indexing**: Optimized queries for fast data retrieval
- **Connection Pooling**: Efficient database connection management
- **Lazy Loading**: Components loaded on demand
- **Caching**: Smart caching strategies for repeated queries
- **Minification**: Production builds are optimized and minified

## 🛠️ Development Workflow

```bash
# Start development environment
npm run dev

# Run tests (if available)
npm test

# Build for production
npm run build

# Run linter
npm run lint

# Database migration
npm run migrate
```

## 📊 Project Statistics

- **Total Lines of Code**: ~15,000+
- **Components**: 10+ React components
- **API Endpoints**: 25+ REST endpoints
- **Database Tables**: 8 core tables
- **Supported Languages**: 5 languages
- **Security**: JWT + bcrypt + rate limiting

## 🤝 Contributing

This project was developed as a personal project to help immigrant families. While contributions are not currently being accepted, feedback and suggestions are always welcome.

## 📝 License

This project is private and proprietary. All rights reserved.

## 👤 Author

**Sakhi Jindal**
- Resume: [View Resume](drive.google.com/file/d/1QzpWVp-5xt6N5awsiHIAKkgF2S-0C1BV/view?usp=sharing)
- GitHub: [@sakhijindal](https://github.com/sakhijindal)

## 🙏 Acknowledgments

- OpenAI for GPT-3.5-turbo API
- PostgreSQL team for the robust database
- React team for the excellent framework
- The open-source community for various libraries and tools

## 📞 Contact

For questions or inquiries about this project, please contact:
- **Email**: sakhi.jindal@gmail.com

---

**Built with ❤️ to help struggling families**

