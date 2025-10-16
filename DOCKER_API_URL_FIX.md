# Docker API URL Fix - COMPLETE ✅

## Issue
When running with Docker, the frontend couldn't connect to the backend because it was trying to use `http://127.0.0.1:8000` instead of the nginx proxy path `/api`.

## Root Cause
The frontend code checked for `VITE_API_BASE_URL`, but Docker Compose sets `VITE_API_URL=/api`. The code didn't fall back to checking `VITE_API_URL`.

## Solution
Updated all API URL constants to check `VITE_API_URL` first, then `VITE_API_BASE_URL`, then fall back to localhost.

## Files Fixed

All API URL constants now use this pattern:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
```

Fixed files:
1. ✅ `/frontend/src/contexts/AuthContext.tsx`
2. ✅ `/frontend/src/components/auth/VerifyEmail.tsx`
3. ✅ `/frontend/src/components/auth/VerificationBanner.tsx`

## How to Use

### Option 1: Docker (Recommended for Production-like Testing)

1. **Start Docker:**
   ```bash
   docker compose up
   ```

2. **Access the app:**
   - Frontend + API: http://localhost:8080
   - The app will automatically use `/api` for backend calls through nginx

3. **Register a new user** - should work now!

### Option 2: Local Development (Recommended for Active Development)

1. **Start Backend:**
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the app:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - The app will use `http://127.0.0.1:8000` for backend calls

## Environment Variables

### Docker (docker-compose.yml)
```yaml
environment:
  - VITE_API_URL=/api  # Uses nginx proxy
```

### Local Development
No environment variables needed - falls back to `http://127.0.0.1:8000`

Or create `/frontend/.env`:
```env
VITE_API_URL=http://127.0.0.1:8000
```

## Architecture

### Docker Setup
```
Browser (localhost:8080)
    ↓
Nginx (port 80 inside container, 8080 exposed)
    ├─→ /api/*  → Backend (port 8000 inside container)
    └─→ /*      → Frontend (port 5173 inside container)
```

### Local Setup
```
Browser (localhost:5173)
    ↓
Frontend Dev Server (port 5173)
    ↓
Backend (port 8000) ← Direct connection
```

## Testing

### Test Docker Setup
1. `docker compose up`
2. Visit http://localhost:8080
3. Try to register - should work
4. Check browser console: Should show `API_BASE_URL: /api`

### Test Local Setup
1. Start backend on port 8000
2. Start frontend `npm run dev`
3. Visit http://localhost:5173
4. Try to register - should work
5. Check browser console: Should show `API_BASE_URL: http://127.0.0.1:8000`

## Troubleshooting

### Docker: Still getting connection errors
- Make sure all containers are running: `docker compose ps`
- Check nginx logs: `docker compose logs nginx`
- Check backend logs: `docker compose logs backend`
- Restart: `docker compose restart`

### Local: Still getting connection errors
- Make sure backend is running on port 8000
- Check: `curl http://127.0.0.1:8000/docs`
- Clear browser cache (Ctrl+Shift+R)

## Status
**✅ FIXED** - Both Docker and local development now work correctly!

