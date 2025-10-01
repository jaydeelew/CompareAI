# Rate Limiting Testing Guide

## Quick Start

### Option 1: Automated Test Script ⭐ (Recommended)

```bash
# 1. Make sure backend is running
cd /home/dan_wsl/jaydeelew/CompareAI/backend
python -m uvicorn app.main:app --reload

# 2. In a new terminal, run the test script
cd /home/dan_wsl/jaydeelew/CompareAI
python test_rate_limiting.py
```

The script will automatically test:
- ✓ Server health
- ✓ Single comparison
- ✓ Rate limit status endpoint
- ✓ Fingerprint tracking
- ✓ Rate limit enforcement

---

## Option 2: Manual Testing (Browser)

### Step 1: Start Your Services

```bash
# Terminal 1: Start backend
cd backend
python -m uvicorn app.main:app --reload

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### Step 2: Open Browser DevTools

1. Open your app in Chrome/Firefox
2. Press F12 to open DevTools
3. Go to Console tab

### Step 3: Check Fingerprint Generation

Look for console messages about fingerprint generation. You should see:
```
Browser fingerprint generated: eyJ1c2VyQWdlbnQi...
```

### Step 4: Make Your First Comparison

1. Select a few models
2. Enter some text
3. Click "Compare Models"
4. ✅ Should work normally

**Check backend logs** - you should see:
```
Rate limit check passed - IP: 127.0.0.1 (1/10), Fingerprint: eyJ1c2... (1/10)
```

### Step 5: Test Rate Limit

Make 10 comparisons total, then try an 11th:

**Expected behavior:**
- First 10 comparisons: ✅ Work fine
- 11th comparison: ❌ Red error message
  ```
  ⚠️ Daily limit of 10 comparisons exceeded. You've used 10 today. 
  Resets at midnight UTC. Upgrade to Pro for unlimited access!
  ```

**Check Network tab in DevTools:**
- Status code: `429` (Too Many Requests)

### Step 6: Try to Bypass (All Should Fail)

**Test A: Clear localStorage**
1. DevTools → Application → Local Storage → Right-click → Clear
2. Try to compare again
3. ❌ Still blocked (backend tracks IP)

**Test B: Incognito/Private Window**
1. Open incognito window
2. Navigate to your app
3. Try to compare
4. ❌ Still blocked (same IP address)

**Test C: Different Browser**
1. Open Firefox (if you were using Chrome)
2. Navigate to your app
3. Try to compare
4. ❌ Still blocked (same IP address)

**Test D: Different Network** (This WILL bypass - expected)
1. Switch to mobile hotspot or different WiFi
2. Try to compare
3. ✅ Works (new IP = new limit)

---

## Option 3: Manual Testing (Command Line)

### Test 1: Check Server Health

```bash
curl http://localhost:8000/health
```

**Expected:**
```json
{"status":"healthy"}
```

### Test 2: Check Rate Limit Status

```bash
curl http://localhost:8000/rate-limit-status
```

**Expected:**
```json
{
  "ip_address": "127.0.0.1",
  "ip_usage_count": 0,
  "max_daily_limit": 10,
  "remaining": 10,
  "is_limited": false
}
```

### Test 3: Make a Comparison

```bash
curl -X POST http://localhost:8000/compare \
  -H "Content-Type: application/json" \
  -d '{
    "input_data": "Hello world",
    "models": ["openai/gpt-3.5-turbo"],
    "browser_fingerprint": "test_fingerprint_123"
  }'
```

**Expected:** JSON response with results

### Test 4: Check Status Again

```bash
curl http://localhost:8000/rate-limit-status
```

**Expected:** `ip_usage_count` increased by 1

### Test 5: Hit the Limit

Run this to make 10 requests quickly:

```bash
for i in {1..10}; do
  echo "Request $i..."
  curl -s -X POST http://localhost:8000/compare \
    -H "Content-Type: application/json" \
    -d '{
      "input_data": "Test '$i'",
      "models": ["openai/gpt-3.5-turbo"],
      "browser_fingerprint": "test_fp"
    }' | jq -r '.metadata.timestamp // .detail' 
  sleep 1
done
```

### Test 6: Try 11th Request (Should Fail)

```bash
curl -v -X POST http://localhost:8000/compare \
  -H "Content-Type: application/json" \
  -d '{
    "input_data": "This should fail",
    "models": ["openai/gpt-3.5-turbo"],
    "browser_fingerprint": "test_fp"
  }'
```

**Expected:**
- HTTP status: `429`
- Error message about daily limit

---

## Debugging

### Check Backend Logs

Look for these log messages:

**Success:**
```
Rate limit check passed - IP: 192.168.1.100 (5/10), Fingerprint: eyJ1c... (5/10)
```

**Rate Limited:**
```
INFO: 127.0.0.1:12345 - "POST /compare HTTP/1.1" 429 Too Many Requests
```

### Common Issues

**Problem:** Rate limit not enforced

**Solutions:**
1. Check backend logs for rate limit messages
2. Verify fingerprint is being sent (check Network tab)
3. Restart backend server
4. Check that you updated the code correctly

**Problem:** Fingerprint not generated

**Solutions:**
1. Check browser console for errors
2. Verify frontend code was updated
3. Hard refresh (Ctrl+Shift+R)

**Problem:** Always getting 429 error

**Solutions:**
1. Restart backend to reset in-memory counters
2. Check if you've already hit the limit
3. Use different fingerprint for testing

---

## Advanced: Test with Multiple IPs

If you have access to multiple machines or VPN:

```bash
# From Machine 1 (or VPN location 1)
curl http://your-server/rate-limit-status
# Make 10 requests

# From Machine 2 (or VPN location 2)
curl http://your-server/rate-limit-status
# Should show 0 usage - separate IP = separate limit
```

---

## Reset for Testing

### Quick Reset (Restart Backend)

```bash
# Stop backend (Ctrl+C)
# Start it again
python -m uvicorn app.main:app --reload
```

This clears all in-memory rate limits.

### Reset Individual IP/Fingerprint

You would need to add a debug endpoint (development only):

```python
# Add to backend/app/main.py
@app.delete("/debug/reset-rate-limit/{identifier}")
async def reset_rate_limit(identifier: str):
    """Reset rate limit for specific identifier (dev only)"""
    if identifier in rate_limit_storage:
        del rate_limit_storage[identifier]
    return {"message": f"Reset rate limit for {identifier}"}
```

Then use:
```bash
curl -X DELETE http://localhost:8000/debug/reset-rate-limit/ip:127.0.0.1
```

---

## Success Criteria

✅ **Your rate limiting is working if:**

1. First comparison works normally
2. 10th comparison works
3. 11th comparison returns 429 error
4. Clearing localStorage doesn't bypass limit
5. Incognito mode doesn't bypass limit
6. Backend logs show rate limit checks
7. Different fingerprints are tracked separately
8. Status endpoint shows correct counts

❌ **Something is wrong if:**

1. Can make unlimited comparisons
2. Gets 429 on first request
3. Backend shows no rate limit logs
4. Fingerprint is undefined/null
5. Status endpoint returns error

---

## Video Testing Checklist

If you want to record a demo:

1. ☐ Show backend starting up
2. ☐ Show frontend loading
3. ☐ Open DevTools Console
4. ☐ Make first comparison (show success)
5. ☐ Show backend logs with rate limit check
6. ☐ Show usage counter in UI
7. ☐ Make 9 more comparisons (speed up video)
8. ☐ Show "10/10 used" in UI
9. ☐ Try 11th comparison (show error)
10. ☐ Show 429 in Network tab
11. ☐ Clear localStorage (show it doesn't work)
12. ☐ Open incognito (show it doesn't work)
13. ☐ Check rate-limit-status endpoint

---

## Need Help?

**Backend not starting?**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend not working?**
```bash
cd frontend
npm install
npm run dev
```

**Can't make API requests?**
- Check CORS settings in `backend/app/main.py`
- Verify API_URL in `frontend/src/App.tsx`
- Check firewall settings

