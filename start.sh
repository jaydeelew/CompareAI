#!/bin/bash

echo "🚀 Starting CompareAI Development Servers..."
echo ""

# Kill any existing processes
echo "Cleaning up existing processes..."
pkill -f "uvicorn app.main:app" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# Start backend
echo "Starting backend on http://127.0.0.1:8000..."
cd /home/dan_wsl/jaydeelew/CompareAI/backend
nohup python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Check backend health
if curl -s http://127.0.0.1:8000/health > /dev/null; then
    echo "✅ Backend is running!"
else
    echo "❌ Backend failed to start. Check /tmp/backend.log"
    exit 1
fi

# Start frontend
echo ""
echo "Starting frontend on http://localhost:5173..."
cd /home/dan_wsl/jaydeelew/CompareAI/frontend
nohup npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

sleep 3

echo ""
echo "✅ Development servers started!"
echo ""
echo "📍 URLs:"
echo "   Backend:  http://127.0.0.1:8000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f /tmp/backend.log"
echo "   Frontend: tail -f /tmp/frontend.log"
echo ""
echo "🛑 To stop: pkill -f uvicorn && pkill -f vite"
echo ""

