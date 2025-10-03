const app = require('../index');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const PORT = process.env.PORT || 3001;

// For local development, we need to handle the API routes directly
const express = require('express');
const server = express();

// Use the API app for all routes
server.use(app);

server.listen(PORT, () => {
  console.log(`
🚀 E-Invoicing Readiness Analyzer API
📡 Server running on port ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}

📋 Available endpoints:
   POST   http://localhost:${PORT}/api/upload
   POST   http://localhost:${PORT}/api/analyze
   GET    http://localhost:${PORT}/api/share/:reportId
   GET    http://localhost:${PORT}/api/share/:reportId/pdf
   GET    http://localhost:${PORT}/api/reports
   GET    http://localhost:${PORT}/api/health

📖 Test with: Postman collection provided
🔗 Frontend: http://localhost:5173 (when running Vite)
  `);
});