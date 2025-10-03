#!/bin/bash

# Start the API server in the background
echo "🚀 Starting API server..."
cd api && npm run dev &
API_PID=$!

# Wait a moment for the API to start
sleep 3

# Start the frontend server
echo "🎨 Starting frontend server..."
cd ..
npm run dev

# Kill the API server when the frontend stops
kill $API_PID