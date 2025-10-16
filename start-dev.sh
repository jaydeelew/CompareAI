#!/bin/bash

# CompareAI Development Startup Script

echo "🚀 Starting CompareAI Development Environment"
echo ""

# Check if backend is already running
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Backend already running on port 8000"
else
    echo "🔧 Starting Backend..."
    cd backend
    python -m uvicorn app.main:app --reload &
    BACKEND_PID=$!
    cd ..
    echo "✅ Backend started (PID: $BACKEND_PID)"
fi

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
for i in {1..10}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Backend is ready!"
        break
    fi
    sleep 1
done

echo ""
echo "🔧 Starting Frontend..."
cd frontend
npm run dev

echo ""
echo "✅ Development environment ready!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"

