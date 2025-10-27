# Environment Variables Setup Guide

## ✅ Changes Implemented

I've updated your codebase to use **environment variables with smart fallbacks** following 2025 industry best practices.

### What Changed:

1. **All frontend API calls** now use `import.meta.env.VITE_API_URL || '/api'`
   - Falls back to `/api` if not set (works with Vite proxy)
   - Uses absolute URL if set (for production without proxy)

2. **Created example files** in repository:
   - `frontend/env.example` - Template for frontend
   - `backend/env.example` - Template for backend

3. **Updated your current env files**:
   - `frontend/env_frontend` - Now set to `/api` (correct!)
   - `backend/env_backend` - Added documentation

## 📋 Action Required: Update Your Actual .env Files

### Frontend:

**File:** `frontend/.env`

```bash
# Copy the corrected values to your actual .env file
cp frontend/env_frontend frontend/.env
```

**Or manually update `frontend/.env`:**
```bash
VITE_API_URL=/api
```

Remove the incorrect line:
```bash
# DELETE THIS LINE:
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### Backend:

**File:** `backend/.env`

Your backend env is already correctly configured! Just make sure it matches:

```bash
ENVIRONMENT=development
DATABASE_URL=sqlite:///./compareintel.db
SECRET_KEY=dev_secret_key_change_in_production_12345678
OPENROUTER_API_KEY=your_actual_api_key
FRONTEND_URL=http://localhost:5173
```

## 🎯 How It Works Now

### Development:
- Frontend: Uses `/api` → Vite proxy → `http://127.0.0.1:8000/api/*`
- Backend: Serves at `http://127.0.0.1:8000`
- Everything works through proxy! ✓

### Docker (Production):
- Frontend: Uses `VITE_API_URL=/api` from docker-compose.yml
- Backend: PostgreSQL via `DATABASE_URL`
- Nginx: Routes `/api/*` to backend
- Everything works! ✓

### Custom Configuration:
If you need to bypass the proxy for any reason:
```bash
# In frontend/.env:
VITE_API_URL=http://127.0.0.1:8000
```

## 📝 Environment Files Created

1. **`frontend/env.example`** - Template with documentation
2. **`backend/env.example`** - Comprehensive template with all options
3. **`frontend/env_frontend`** - Your current values (fixed)
4. **`backend/env_backend`** - Your current values (documented)

## ⚠️ Security Reminders

1. **Never commit actual `.env` files** - They're in .gitignore ✓
2. **Update `env_frontend` and `env_backend` to `.env.example`** when ready
3. **Rotate keys** before going to production
4. **Use different keys** for development vs production

## 🔄 Next Steps

1. **Restart your dev server** to pick up new env variables
2. **Test the app** - it should work exactly as before
3. **For production**, update docker-compose with production values
4. **For email**, add SendGrid credentials to backend/.env

## 💡 Why This Approach is Better

✅ **Flexible**: Works in dev, staging, and production  
✅ **Standard**: Industry best practice for 2025  
✅ **Maintainable**: Clear fallbacks and documentation  
✅ **Secure**: No hardcoded URLs in source code  
✅ **Environment-aware**: Different configs for different environments  

