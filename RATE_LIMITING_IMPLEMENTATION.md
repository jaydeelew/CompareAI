# Rate Limiting Implementation Guide

## Overview

This document describes the **multi-layer anti-abuse system** implemented to prevent users from exceeding the daily comparison limit without requiring user accounts.

## Architecture

### Three-Layer Defense System

1. **Backend IP-Based Rate Limiting** ⭐ (Primary - Cannot be bypassed)
   - Tracks requests by client IP address
   - Enforced on the backend before any processing
   - Most effective layer

2. **Browser Fingerprint Tracking** (Secondary - Harder to bypass)
   - Generates unique fingerprint from browser characteristics
   - Sent with each request to backend
   - Catches users with dynamic IPs or VPN switching

3. **localStorage Tracking** (UX Only - Easy to bypass)
   - Provides immediate visual feedback for honest users
   - Shows usage count in the UI
   - Already implemented

## What Was Changed

### Backend Changes (`backend/app/main.py`)

1. **Added Rate Limiting Configuration**
   ```python
   MAX_DAILY_COMPARISONS = 10
   rate_limit_storage = {}  # In-memory storage
   ```

2. **Added Helper Functions**
   - `get_client_ip(request)`: Extracts IP from request (handles proxies)
   - `check_rate_limit(identifier)`: Checks if identifier exceeded limit
   - `increment_usage(identifier)`: Increments usage counter

3. **Updated `/compare` Endpoint**
   - Now accepts `browser_fingerprint` in request body
   - Checks rate limits for both IP and fingerprint
   - Returns 429 error if limit exceeded
   - Increments counters on successful request

4. **Added New Endpoint**
   - `GET /rate-limit-status`: Check current usage status
   - Useful for debugging and user transparency

5. **Updated `CompareRequest` Model**
   - Added optional `browser_fingerprint` field

### Frontend Changes (`frontend/src/App.tsx`)

1. **Restored Browser Fingerprint Generation**
   - Generates fingerprint on component mount
   - Uses canvas rendering + browser properties
   - Stored in state for reuse

2. **Updated API Calls**
   - Sends `browser_fingerprint` with `/compare` requests
   - Better error handling for 429 (rate limit) errors

### Dependencies (`backend/requirements.txt`)

- Added `slowapi>=0.1.9` (optional - not currently used but available)

## How It Works

### Request Flow

```
1. User clicks "Compare Models"
   ↓
2. Frontend sends request with:
   - input_data
   - models
   - browser_fingerprint
   ↓
3. Backend extracts:
   - IP address from request
   - Browser fingerprint from body
   ↓
4. Backend checks rate limits:
   - IP count < 10? ✓
   - Fingerprint count < 10? ✓
   ↓
5. If EITHER limit exceeded:
   → Return 429 error
   → User sees error message
   ↓
6. If both pass:
   → Increment both counters
   → Process comparison
   → Return results
```

### Identifier Format

- IP addresses: `ip:192.168.1.1`
- Fingerprints: `fp:eyJ1c2VyQWdlbnQiOi...`

This prevents collisions between IP and fingerprint tracking.

### Daily Reset

Counters automatically reset at midnight (based on date comparison).

## Installation & Deployment

### 1. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Or if using Docker:
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### 2. Restart Backend

```bash
# If running locally
python backend/app/main.py

# If using Docker
docker-compose restart backend
```

### 3. Rebuild Frontend (if needed)

```bash
cd frontend
npm run build
```

## Testing the Rate Limiting

### Test 1: Basic Functionality

1. Open your app in a browser
2. Make a comparison → Should work ✓
3. Check browser console: Should see fingerprint being generated
4. Check backend logs: Should see IP and fingerprint tracking

### Test 2: Reach the Limit

1. Make 10 comparisons from the same browser
2. On the 11th attempt:
   - Should see error: "Daily limit of 10 comparisons exceeded..."
   - Frontend shows red error message
   - Backend returns 429 status code

### Test 3: Bypass Attempts

**Clearing localStorage (should NOT bypass):**
1. Open DevTools → Application → Local Storage → Clear
2. Try to compare → Should still be blocked ✓ (Backend tracks)

**Using Incognito Mode (should NOT bypass):**
1. Open incognito/private window
2. Try to compare after hitting limit → Should be blocked ✓ (IP tracked)

**Changing Networks (will reset counter):**
1. Switch to different WiFi/mobile network (new IP)
2. Can make 10 more comparisons (expected behavior)

### Test 4: Check Status Endpoint

```bash
# Check your current rate limit status
curl "http://localhost:8000/rate-limit-status"

# Response example:
{
  "ip_address": "192.168.1.100",
  "ip_usage_count": 5,
  "max_daily_limit": 10,
  "remaining": 5,
  "is_limited": false
}
```

## Security Considerations

### What This Prevents

✅ **Casual abuse**: Regular users can't exceed 10/day without effort  
✅ **Browser-based bypass**: Clearing localStorage doesn't help  
✅ **Incognito mode**: Still tracked by IP  
✅ **Multiple browsers**: Same IP = shared limit  
✅ **Automated scripts**: Must spoof both IP and fingerprint  

### What This Does NOT Prevent

⚠️ **VPN switching**: New IP = new 10 comparisons  
⚠️ **Multiple devices**: Different IP = separate counter  
⚠️ **Sophisticated attackers**: Can spoof fingerprints  
⚠️ **Server restart**: In-memory storage is reset  

### Limitations

**In-Memory Storage:**
- Rate limits are stored in RAM
- Restarting the server resets all counters
- Not shared between multiple backend instances

**For Production:**
Consider upgrading to persistent storage:
- Redis (fast, in-memory database)
- PostgreSQL (persistent database)
- MongoDB (document database)

## Configuration

### Change Daily Limit

Edit `backend/app/main.py`:
```python
MAX_DAILY_COMPARISONS = 20  # Change from 10 to 20
```

### Disable Rate Limiting (Development)

Comment out the rate limiting section in `/compare` endpoint:
```python
# # --- RATE LIMITING ENFORCEMENT ---
# client_ip = get_client_ip(request)
# ... rest of rate limiting code ...
# # --- END RATE LIMITING ---
```

### Add Whitelist IPs

Add this to `check_rate_limit()` function:
```python
def check_rate_limit(identifier: str) -> tuple[bool, int]:
    # Whitelist for development/testing
    WHITELIST_IPS = ["127.0.0.1", "192.168.1.100"]
    if identifier.startswith("ip:") and identifier[3:] in WHITELIST_IPS:
        return True, 0
    
    # ... rest of function ...
```

## Monitoring & Debugging

### Backend Logs

Look for these messages:
```
Rate limit check passed - IP: 192.168.1.100 (6/10), Fingerprint: eyJ1c2VyQWdlbnQiOi (6/10)
```

### Check Rate Limit Storage

Add a debug endpoint (development only):
```python
@app.get("/debug/rate-limits")
async def debug_rate_limits():
    """Debug endpoint to view all rate limit data"""
    return {"rate_limits": dict(rate_limit_storage)}
```

## Future Enhancements

### Option 1: Persistent Storage (Recommended)

Use Redis for rate limiting:
```python
import redis
r = redis.Redis(host='localhost', port=6379, db=0)

def check_rate_limit(identifier: str):
    key = f"ratelimit:{identifier}:{datetime.now().date()}"
    count = r.get(key) or 0
    return int(count) < MAX_DAILY_COMPARISONS, int(count)
```

### Option 2: Distributed Rate Limiting

For multiple backend servers, use shared storage:
- Redis
- Memcached
- Database

### Option 3: User Accounts

Most effective solution:
- Email/password authentication
- OAuth (Google, GitHub)
- Tracks by user ID (not IP/fingerprint)
- Enables paid upgrades

## Summary

**You now have a multi-layer defense system that:**
- ✅ Prevents casual abuse effectively
- ✅ Works without user accounts
- ✅ Tracks by both IP and browser fingerprint
- ✅ Shows clear error messages
- ✅ Easy to configure and monitor

**This is NOT bulletproof, but it's:**
- Good enough for freemium models
- Better than localStorage alone
- Balances security with user experience
- Easy to upgrade to user accounts later

For most use cases, this level of protection is sufficient!

