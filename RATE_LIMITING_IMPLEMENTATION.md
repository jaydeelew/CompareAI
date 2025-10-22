# Rate Limiting Implementation Guide

## Overview

This document describes the **multi-layer anti-abuse system** implemented to prevent users from exceeding daily limits. The system uses **model-based pricing** where each AI model response counts individually toward the daily limit.

**Updated October 22, 2025:** Switched from comparison-based to model-based rate limiting. All tiers now support up to 9 models per comparison.

## Architecture

### Three-Layer Defense System

1. **Backend IP-Based Rate Limiting** ⭐ (Primary - Cannot be bypassed)

   - Tracks requests by client IP address
   - Enforced on the backend before any processing
   - Most effective layer

2. **Browser Fingerprint Tracking** (Secondary - Harder to bypass)

   - Generates unique fingerprint from browser characteristics
   - Hashed using SHA-256 (64 characters) for privacy and database efficiency
   - Sent with each request to backend
   - Catches users with dynamic IPs or VPN switching

3. **localStorage Tracking** (UX Only - Easy to bypass)
   - Provides immediate visual feedback for honest users
   - Shows usage count in the UI
   - Already implemented

## What Was Changed

### Backend Changes (`backend/app/main.py`)

1. **Rate Limiting Configuration (Model-Based)**

   ```python
   # MODEL-BASED PRICING: daily_limit = model responses per day
   SUBSCRIPTION_CONFIG = {
       "free": {"daily_limit": 20, "model_limit": 9, "overage_allowed": False},  # Registered users
       "starter": {"daily_limit": 150, "model_limit": 9, "overage_allowed": True},
       "pro": {"daily_limit": 450, "model_limit": 9, "overage_allowed": True}
   }
   # Anonymous (unregistered) users: 10 model responses/day
   ```

2. **Helper Functions (Model-Based)**

   - `get_client_ip(request)`: Extracts IP from request (handles proxies)
   - `check_rate_limit(identifier)`: Checks if identifier exceeded limit
   - `increment_usage(identifier, count)`: Increments usage by number of models used
   - `check_user_rate_limit(user, db)`: Checks authenticated user's model response limit
   - `increment_user_usage(user, db, count)`: Increments user's usage by model count

3. **Updated `/compare` Endpoint (Model-Based)**

   - Enforces uniform 9 model limit per comparison (all tiers)
   - Calculates model responses needed for the request
   - Checks if user has enough model responses remaining
   - Returns 429 error if limit would be exceeded
   - Increments counters by number of models used (not just +1)
   - Tracks overage model responses for paid tiers

4. **Added New Endpoint**

   - `GET /rate-limit-status`: Check current usage status
   - Useful for debugging and user transparency

5. **Updated `CompareRequest` Model**
   - Added optional `browser_fingerprint` field

### Frontend Changes (`frontend/src/App.tsx`)

1. **Browser Fingerprint Generation with Hashing** ✨ _Updated Oct 18, 2025_

   - Generates fingerprint on component mount
   - Uses canvas rendering + browser properties
   - **Hashes fingerprint using SHA-256** (64 characters)
   - Improves privacy (only hash stored, not raw data)
   - Prevents database overflow errors (was 5000+ chars, now 64)
   - Stored in state for reuse

2. **Updated API Calls**
   - Sends hashed `browser_fingerprint` with `/compare` requests
   - Better error handling for 429 (rate limit) errors

### Backend Database Changes (`backend/app/models.py`) ✨ _Updated Oct 18, 2025_

**UsageLog Model:**

- Updated `browser_fingerprint` column from `String(500)` to `String(64)`
- Optimized for SHA-256 hash storage
- Prevents database overflow errors that were occurring with raw fingerprint data

**Migration Script:**

- Added `backend/migrate_fingerprint_column.py` to update existing databases
- Automatically detects SQLite vs PostgreSQL
- Safe, non-destructive migration

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
4. Backend checks rate limits (MODEL-BASED):
   - Calculate models needed (e.g., 3 models selected = 3 model responses)
   - Check: current usage + models needed ≤ daily limit?
   - For anonymous (unregistered): IP count + models ≤ 10? ✓
   - For authenticated free: usage + models ≤ 20? ✓
   - For authenticated paid: usage + models ≤ tier limit? ✓
   ↓
5. If limit would be exceeded:
   → Return 429 error with specific message
   → Shows how many model responses available vs. needed
   → User sees error message
   ↓
6. If check passes:
   → Increment counter by number of models (not +1)
   → Process comparison
   → Return results
```

### Identifier Format

- IP addresses: `ip:192.168.1.1`
- Fingerprints: `fp:a3f5e8c9d1b2...` (SHA-256 hash, 64 chars)

This prevents collisions between IP and fingerprint tracking.

**Note:** As of October 18, 2025, fingerprints are now SHA-256 hashes instead of Base64-encoded JSON strings. This provides better privacy and prevents database overflow issues.

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

### 2. Run Database Migration ✨ _Required as of Oct 18, 2025_

```bash
# If running locally with virtual environment
cd backend
python migrate_fingerprint_column.py

# If using Docker
docker-compose run --rm backend python migrate_fingerprint_column.py
```

This updates the `browser_fingerprint` column to support SHA-256 hashes.

### 3. Restart Backend

```bash
# If running locally
python backend/app/main.py

# If using Docker
docker-compose restart backend
```

### 4. Rebuild Frontend (if needed)

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

### Test 2: Reach the Limit (Model-Based)

**Anonymous User (Unregistered):**
1. Make 3 comparisons using 3 models each (3 × 3 = 9 model responses)
2. On the next attempt with 2+ models:
   - Should see error: "Daily limit of 10 model responses exceeded..."
   - Frontend shows red error message
   - Backend returns 429 status code
   - Encouraged to register for 20 model responses/day

**Free Tier User (Registered):**
1. Make 6 comparisons using 3 models each (6 × 3 = 18 model responses)
2. Alternatively, make 2 comparisons using 9 models each (2 × 9 = 18 model responses)
3. On the next attempt with 3+ models:
   - Should see error about exceeding 20 model responses
   - Message shows exactly how many responses available vs. needed
   - Encouraged to upgrade to Starter

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

# Response example (model-based):
{
  "ip_address": "192.168.1.100",
  "ip_usage_count": 7,  # model responses used
  "max_daily_limit": 10,  # for anonymous (unregistered) users
  "remaining": 3,  # model responses remaining
  "is_limited": false
}

# Authenticated free user example:
{
  "daily_usage": 15,  # model responses used today
  "daily_limit": 20,  # for free registered tier
  "remaining_usage": 5,  # model responses remaining
  "subscription_tier": "free",
  "model_limit": 9  # max models per comparison (uniform)
}
```

## Model-Based Pricing Benefits ✨ _New as of Oct 22, 2025_

**Why Model-Based Instead of Comparison-Based?**

1. **Fair Usage:** Users pay/consume based on actual AI usage
   - 1 model comparison = 1 model response
   - 9 model comparison = 9 model responses
   - No penalty for efficient usage patterns

2. **Flexible Optimization:** Users can choose model count based on needs
   - Quick test: Use 1 model (1 response)
   - Focused comparison: Use 3 models (3 responses)
   - Comprehensive analysis: Use 9 models (9 responses)

3. **Uniform Capabilities:** All tiers have same model access
   - Free, Starter, and Pro can all use up to 9 models per comparison
   - Only difference is daily capacity (30/150/450 model responses)
   - No artificial feature restrictions

4. **Better Cost Alignment:** 
   - Our cost: $0.0166 per model response
   - Model-based tracking directly reflects our costs
   - More predictable profitability
   - Fairer overage pricing (when implemented)

**Example Scenarios:**

- **Anonymous User:** 3 comparisons × 3 models = 9 responses (within 10/day limit)
- **Free Registered User:** 6 comparisons × 3 models = 18 responses (within 20/day limit)
- **Efficient Starter User:** 50 comparisons × 3 models = 150 responses (fits Starter tier)
- **Power Pro User:** 50 comparisons × 9 models = 450 responses (needs Pro tier)
- **Variable User:** Mix of 1-9 models per comparison based on task complexity

## Security Considerations

### Privacy Improvements ✨ _As of Oct 18, 2025_

**SHA-256 Hashing:**

- Browser fingerprints are now hashed before storage
- Only the hash (64 chars) is stored in the database and logs
- Raw browser data never leaves the client's browser
- Impossible to reverse-engineer the original fingerprint from the hash
- Same browser always produces the same hash (deterministic)

### What This Prevents

✅ **Casual abuse**: Regular users can't exceed limits without effort  
✅ **Browser-based bypass**: Clearing localStorage doesn't help  
✅ **Incognito mode**: Still tracked by IP  
✅ **Multiple browsers**: Same IP = shared limit  
✅ **Automated scripts**: Must spoof both IP and fingerprint
✅ **Model response abuse**: Each model used counts individually
✅ **Registration incentive**: 2x capacity encourages account creation

### What This Does NOT Prevent

⚠️ **VPN switching**: New IP = fresh limit (10 model responses for anonymous)  
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

### Change Model Response Limits

Edit `backend/app/rate_limiting.py`:

```python
# Adjust limits for each tier
SUBSCRIPTION_CONFIG = {
    "free": {"daily_limit": 20, "model_limit": 9, "overage_allowed": False},  # Registered users
    "starter": {"daily_limit": 150, "model_limit": 9, "overage_allowed": True},
    "pro": {"daily_limit": 450, "model_limit": 9, "overage_allowed": True}
}
```

For anonymous (unregistered) users, update in `check_anonymous_rate_limit()`:
```python
is_allowed = current_count < 10  # Change 10 to your desired limit
```

### Change Daily Limit (Legacy Documentation)

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
- ✅ Tracks by both IP and browser fingerprint (hashed for privacy)
- ✅ Shows clear error messages
- ✅ Easy to configure and monitor
- ✅ Privacy-focused (only hashes stored, not raw data) ✨

**This is NOT bulletproof, but it's:**

- Good enough for freemium models
- Better than localStorage alone
- Balances security with user experience
- Easy to upgrade to user accounts later

For most use cases, this level of protection is sufficient!

---

## October 2025 Update: Enhanced Privacy & Reliability

**What Changed:**

- Browser fingerprints are now hashed with SHA-256 before storage
- Database column optimized from VARCHAR(500) to VARCHAR(64)
- Fixed database overflow errors (fingerprints were 5000+ chars, now 64)
- Enhanced user privacy (raw fingerprint data never stored)
- Migration script added for seamless database updates

**Action Required:**
If you're updating from a previous version, run the migration script:

```bash
cd backend
python migrate_fingerprint_column.py
```

See `DEPLOYMENT_NEEDED.md` for detailed deployment instructions.
