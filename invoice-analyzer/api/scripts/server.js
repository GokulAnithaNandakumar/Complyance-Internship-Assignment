const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { initDb, testConnection } = require('./config/database');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Compression middleware
app.use(compression());

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://complyance-internship-assignment.vercel.app',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Specific rate limiting for upload and analyze endpoints
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 uploads per windowMs
  message: {
    error: 'Too many uploads',
    message: 'Please wait before uploading again'
  }
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Apply upload rate limiting to specific routes
app.use('/upload', uploadLimiter);
app.use('/analyze', uploadLimiter);

// API routes
app.use('/', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'E-Invoicing Readiness Analyzer API',
    version: '1.0.0',
    description: 'Backend API for analyzing invoice data against GETS v0.1 schema',
    endpoints: {
      upload: 'POST /upload',
      analyze: 'POST /analyze',
      report: 'GET /report/:reportId',
      reports: 'GET /reports',
      health: 'GET /health'
    },
    documentation: 'See README.md for detailed API documentation'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} was not found`,
    availableEndpoints: [
      'POST /upload',
      'POST /analyze',
      'GET /report/:reportId',
      'GET /reports',
      'GET /health'
    ]
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    console.log('Testing database connection...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('Failed to connect to database. Please check your DATABASE_URL.');
      process.exit(1);
    }

    // Initialize database tables
    console.log('Initializing database tables...');
    await initDb();

    // Start the server
    app.listen(PORT, () => {
      console.log(`\n🚀 E-Invoicing Readiness Analyzer API`);
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️  Database: Connected`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'https://complyance-internship-assignment.vercel.app'}`);
      console.log(`\n📋 Available endpoints:`);
      console.log(`   POST   http://localhost:${PORT}/upload`);
      console.log(`   POST   http://localhost:${PORT}/analyze`);
      console.log(`   GET    http://localhost:${PORT}/report/:reportId`);
      console.log(`   GET    http://localhost:${PORT}/reports`);
      console.log(`   GET    http://localhost:${PORT}/health`);
      console.log(`\n📖 API Documentation: Check README.md`);
      console.log(`🧪 Test with: Postman collection provided\n`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();