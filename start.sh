#!/bin/bash

# AI Task Executor - Startup Script
# This script starts both backend and frontend servers

echo "🚀 Starting AI Task Executor..."
echo ""

# Check if OpenRouter API key is set
if [ ! -f "backend/.env" ] || ! grep -q "OPENROUTER_API_KEY" "backend/.env"; then
    echo "⚠️  WARNING: backend/.env not found or missing OPENROUTER_API_KEY"
    echo "   Please create backend/.env with:"
    echo "   OPENROUTER_API_KEY=your_key_here"
    echo ""
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Start backend
echo -e "${BLUE}Starting Backend Server...${NC}"
cd backend
npm start &
BACKEND_PID=$!
sleep 2

# Start frontend in a new way (for macOS/Linux compatibility)
echo -e "${BLUE}Starting Frontend Server...${NC}"
cd ../frontend
npm run dev &
FRONTEND_PID=$!
sleep 2

echo ""
echo -e "${GREEN}✅ Servers started!${NC}"
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "⚙️  Backend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
