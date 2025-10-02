#!/bin/bash

# E-Invoicing Readiness Analyzer - Backend Startup Script

echo "🚀 Starting E-Invoicing Readiness Analyzer Backend..."
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "📋 Please copy .env.example to .env and configure your DATABASE_URL"
    echo ""
    echo "   cp .env.example .env"
    echo "   # Then edit .env with your Neon PostgreSQL URL"
    echo ""
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if DATABASE_URL is configured
if grep -q "YOUR_NEON_POSTGRES_URL_HERE" .env; then
    echo "⚠️  Please configure your DATABASE_URL in .env file"
    echo "📋 Replace YOUR_NEON_POSTGRES_URL_HERE with your actual Neon PostgreSQL URL"
    echo ""
    exit 1
fi

echo "✅ Configuration looks good!"
echo "🗄️  Database: Configured"
echo "📦 Dependencies: Installed"
echo ""

# Start the development server
echo "🌟 Starting development server..."
echo "📡 Server will be available at: http://localhost:3001"
echo "🔗 Frontend should connect to: http://localhost:3001"
echo ""
echo "💡 Available endpoints:"
echo "   POST   /upload      - Upload invoice data"
echo "   POST   /analyze     - Analyze uploaded data"
echo "   GET    /report/:id  - Get analysis report"
echo "   GET    /reports     - List recent reports"
echo "   GET    /health      - Health check"
echo ""
echo "🧪 Test with Postman collection: postman_collection.json"
echo "📖 Full documentation: README.md"
echo ""
echo "Press Ctrl+C to stop the server"
echo "----------------------------------------"

npm run dev