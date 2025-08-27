const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import our organized modules
const routes = require('./routes');



const app = express();
const port = process.env.PORT || 3001;

// =============================================
// MIDDLEWARE SETUP
// =============================================


// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Add IP address to request for rate limiting and session tracking
app.use((req, res, next) => {
  req.ip = req.ip || req.connection.remoteAddress || 'unknown';
  next();
});



// =============================================
// ROUTES SETUP
// =============================================



// Use all existing routes (these now support optional authentication)
app.use('/', routes);

// Root endpoint (updated to show auth capabilities)
app.get('/', (req, res) => {
  res.json({
    message: 'AI-Powered Multilingual Personal Assistant Backend',
    version: '2.0.0-organized-with-auth',
    features: [
      'Multi-user support',
      'Multilingual AI processing', 
      'Persistent data storage',
      'Lists, schedules, and memory management',
      'Real-time chat processing',
      '🔐 User authentication and registration',
      '🛡️ JWT token-based security',
      '⚡ Rate limiting protection'
    ],
    endpoints: {
      // Existing endpoints
      health: 'GET /health',
      users: 'GET /users',
      data: 'GET /data/:userId',
      chat: 'POST /chat',
      lists: 'GET|POST /lists/:userId',
      schedules: 'GET|POST /schedules/:userId', 
      memory: 'GET|POST /memory/:userId',
      migration: 'POST /migrate-database',
      
      // New authentication endpoints
      register: 'POST /auth/register',
      login: 'POST /auth/login',
      logout: 'POST /auth/logout',
      profile: 'GET /auth/me',
      resetPassword: 'POST /auth/forgot-password'
    },
    authentication: {
      note: 'All existing endpoints work without authentication for backward compatibility',
      authSupported: 'Include "Authorization: Bearer <token>" header for authenticated requests',
      registration: 'Create new accounts via POST /auth/register',
      login: 'Login via POST /auth/login to get JWT token'
    },
    documentation: 'See routes.js and authRoutes.js for detailed API documentation'
  });
});

// =============================================
// ERROR HANDLING MIDDLEWARE
// =============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `${req.method} ${req.path} is not a valid endpoint`,
    availableEndpoints: [
      'GET /health',
      'GET /users', 
      'POST /chat',
      'GET /data/:userId',
      'POST /migrate-database',
      'POST /auth/register',
      'POST /auth/login',
      'GET /auth/me'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Global error handler:', error);
  
  // Database connection errors
  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Database connection failed',
      message: 'Please check if PostgreSQL is running'
    });
  }
  
  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.message
    });
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Please log in again'
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      message: 'Please log in again'
    });
  }
  
  // Default server error
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});



// =============================================
// SERVER STARTUP
// =============================================

async function startServer() {
  try {
    // Test database connection
    const { pool } = require('./database');
    await pool.query('SELECT 1');
    console.log('✅ Database connection verified');
    

    
    // Start listening
    app.listen(port, () => {
      console.log('🚀 ===================================');
      console.log(`🚀 AI Backend Server Started!`);
      console.log(`🚀 ===================================`);
      console.log(`📡 Server URL: http://localhost:${port}`);
      console.log(`🗄️  Database: PostgreSQL Connected`);
      console.log(`🤖 AI Engine: OpenAI GPT-3.5-turbo`);
      console.log(`🌍 Languages: English, Hindi, Spanish, French, German`);
      console.log(`📊 Features: Lists, Schedules, Memory, Multi-user`);
      console.log(`🔐 Authentication: JWT-based (optional)`);
      console.log(`🛡️  Security: Rate limiting, password hashing`);
      console.log(`🔄 Health Check: http://localhost:${port}/health`);
      console.log(`📚 API Docs: http://localhost:${port}/`);
      console.log(`🔑 Auth Endpoints: http://localhost:${port}/auth/*`);
      console.log('🚀 ===================================');
      console.log(`📁 Project Structure:`);
      console.log(`   ├── server.js (main server with auth)`);
      console.log(`   ├── database.js (database functions)`);
      console.log(`   ├── routes.js (existing API endpoints)`);
      console.log(`   ├── authRoutes.js (authentication endpoints)`);
      console.log(`   └── auth.js (authentication utilities)`);
      console.log('🚀 ===================================');
      console.log(`🔐 Authentication Info:`);
      console.log(`   ├── All existing endpoints work without auth`);
      console.log(`   ├── Register: POST /auth/register`);
      console.log(`   ├── Login: POST /auth/login`);
      console.log(`   ├── Profile: GET /auth/me`);
      console.log(`   └── Include "Authorization: Bearer <token>" for auth`);
      console.log('🚀 ===================================');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Make sure PostgreSQL is running and check your .env file');
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer().catch(console.error);

module.exports = app;