# Dev Reset Feature Documentation

## Overview

Added a **development-only** reset button that clears both frontend AND backend rate limits, allowing unlimited testing during development.

## What Was Fixed

### Problem
- The reset button only cleared `localStorage` (frontend)
- Backend rate limiting was still enforced
- Developer would still see "Daily limit exceeded" after clicking reset

### Solution
- Added backend endpoint: `POST /dev/reset-rate-limit`
- Updated frontend reset button to call backend
- Reset now clears **both** frontend and backend limits

---

## How It Works

### 1. Backend Endpoint (`/dev/reset-rate-limit`)

**Location:** `backend/app/main.py`

```python
@app.post("/dev/reset-rate-limit")
async def reset_rate_limit_dev(request: Request, fingerprint: Optional[str] = None):
    # Only works when ENVIRONMENT=development
    if os.environ.get('ENVIRONMENT') != 'development':
        raise HTTPException(status_code=403, detail="Only available in development")
    
    # Clears IP-based and fingerprint-based rate limits
    # ...
```

**Security:**
- ✅ Only works when `ENVIRONMENT=development`
- ❌ Returns 403 in production
- ✅ Cannot be abused by users

### 2. Frontend Reset Button

**Location:** `frontend/src/App.tsx`

The reset button now:
1. Calls backend to reset server-side rate limits
2. Clears `localStorage`
3. Resets frontend state
4. Shows success/error alert

### 3. Docker Configuration

**Location:** `docker-compose.yml`

Added environment variable:
```yaml
environment:
  - ENVIRONMENT=development  # Enables dev features
```

---

## Usage

### In Browser (Recommended)

1. Use your app normally
2. When you hit the rate limit
3. Click **"🔄 Reset Usage (Dev Only)"** button
4. See success message
5. Continue testing with 10 new comparisons

### Via Command Line

```bash
# Reset for your current IP
curl -X POST http://localhost:8000/dev/reset-rate-limit

# Reset for specific fingerprint
curl -X POST "http://localhost:8000/dev/reset-rate-limit?fingerprint=YOUR_FINGERPRINT"
```

---

## Production Safety

### What Happens in Production?

If someone tries to call the reset endpoint in production:

```bash
curl -X POST https://your-prod-site.com/dev/reset-rate-limit
```

**Response:**
```json
{
  "detail": "This endpoint is only available in development mode"
}
```

**HTTP Status:** 403 Forbidden

### How to Deploy to Production

**Option 1: Docker Compose Production**
```yaml
# docker-compose.prod.yml
environment:
  - ENVIRONMENT=production  # Disables dev features
```

**Option 2: Environment Variables**
```bash
export ENVIRONMENT=production
python -m uvicorn app.main:app
```

**Option 3: Don't set it**
- If `ENVIRONMENT` is not set, it defaults to `None`
- Reset endpoint will be disabled

---

## Testing the Feature

### Test 1: Verify Reset Works

1. Make 10 comparisons
2. Try to make #11 → Should see error
3. Click reset button
4. Should see: "✅ Rate limits reset successfully!"
5. Make another comparison → Should work

### Test 2: Verify Production Safety

1. Set `ENVIRONMENT=production` in docker-compose
2. Restart backend
3. Try to reset → Should get 403 error

---

## Troubleshooting

### Reset Button Doesn't Work

**Check 1: Is ENVIRONMENT set?**
```bash
docker exec compareai-backend-1 printenv | grep ENVIRONMENT
```
Should show: `ENVIRONMENT=development`

**Check 2: Is backend running?**
```bash
curl http://localhost:8000/health
```

**Check 3: Check browser console**
- Open DevTools (F12)
- Look for errors when clicking reset
- Should see success/error alert

### Getting 403 Error

The backend thinks it's in production:
```bash
# Update docker-compose.yml
environment:
  - ENVIRONMENT=development

# Restart
docker-compose restart backend
```

### Reset Button Not Visible

The button only shows when `import.meta.env.DEV` is true:
```bash
# Make sure you're running frontend in dev mode
cd frontend
npm run dev
```

---

## Code Changes Summary

### Backend Changes
- ✅ Added `POST /dev/reset-rate-limit` endpoint
- ✅ Checks `ENVIRONMENT` variable
- ✅ Resets IP and fingerprint rate limits
- ✅ Returns 403 in production

### Frontend Changes
- ✅ Made `resetUsage()` async
- ✅ Calls backend reset endpoint
- ✅ Shows success/error alerts
- ✅ Sends browser fingerprint

### Configuration Changes
- ✅ Added `ENVIRONMENT=development` to `docker-compose.yml`
- ✅ Documented production deployment

---

## Future Enhancements

### Option 1: Admin Panel Reset
- Add authentication
- Allow resetting specific users
- View rate limit status for all users

### Option 2: Timed Reset
- Reset automatically after X hours
- Useful for QA testing

### Option 3: Reset All
- Clear all rate limits for all users
- Useful when testing with multiple IPs/fingerprints

---

## FAQ

**Q: Will this affect production?**
A: No, the endpoint is disabled when `ENVIRONMENT != development`

**Q: Can users abuse this?**
A: No, the reset button only appears in dev mode (npm run dev)

**Q: Does this reset the daily timestamp?**
A: Yes, it completely removes the rate limit entry, so next request starts fresh

**Q: What if I want to test production rate limiting locally?**
A: Set `ENVIRONMENT=production` in docker-compose and restart

**Q: Can I reset a specific IP/fingerprint?**
A: Yes, pass `?fingerprint=XXX` parameter to the endpoint

---

## Summary

✅ **Development:** Reset button works perfectly  
✅ **Production:** Reset endpoint is disabled  
✅ **Security:** Cannot be abused  
✅ **UX:** Shows clear success/error messages  
✅ **Testing:** Easy to test rate limiting repeatedly  

You can now develop and test rate limiting without restarting the backend! 🎉

