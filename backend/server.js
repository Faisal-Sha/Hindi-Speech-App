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

const allowedOrigins = [
  'http://localhost:3000',
  'https://personal-ai-assistant-l3d6.onrender.com',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
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

// =============================================
// ROUTES SETUP
// =============================================

// Use all routes from our organized routes file
app.use('/', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AI-Powered Multilingual Personal Assistant Backend',
    version: '2.0.0-organized',
    features: [
      'Multi-user support',
      'Multilingual AI processing', 
      'Persistent data storage',
      'Lists, schedules, and memory management',
      'Real-time chat processing'
    ],
    endpoints: {
      health: 'GET /health',
      users: 'GET /users',
      data: 'GET /data/:userId',
      chat: 'POST /chat',
      lists: 'GET|POST /lists/:userId',
      schedules: 'GET|POST /schedules/:userId', 
      memory: 'GET|POST /memory/:userId',
      migration: 'POST /migrate-database'
    },
    documentation: 'See routes.js for detailed API documentation'
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
      'POST /migrate-database'
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
      console.log(`🔄 Health Check: http://localhost:${port}/health`);
      console.log(`📚 API Docs: http://localhost:${port}/`);
      console.log('🚀 ===================================');
      console.log(`📁 Project Structure:`);
      console.log(`   ├── server.js (main server)`);
      console.log(`   ├── database.js (database functions)`);
      console.log(`   └── routes.js (API endpoints)`);
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