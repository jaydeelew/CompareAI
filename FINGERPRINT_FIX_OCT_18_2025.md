# Browser Fingerprint Database Error Fix - October 18, 2025

## Problem

Users were encountering a 500 error when submitting model comparisons:

```
Error processing request: (psycopg2.errors.StringDataRightTruncation)
value too long for type character varying(500)
[SQL: INSERT INTO usage_logs (...browser_fingerprint...) VALUES (...)]
```

The browser fingerprint was 5438 characters long, exceeding the VARCHAR(500) database column limit.

## Root Cause

The `generateBrowserFingerprint()` function in the frontend was storing the raw browser fingerprint data, which included:

- User agent string
- Language
- Platform
- Screen resolution
- Timezone
- **Canvas data URL** (this was the main culprit - 4000+ characters)
- Color depth
- Hardware concurrency

When Base64 encoded, this resulted in a 5000+ character string that exceeded the database's VARCHAR(500) column limit.

## Solution

### Frontend Changes

**File:** `/home/dan_wsl/jaydeelew/CompareAI/frontend/src/App.tsx`

1. **Added SHA-256 hashing function** (lines 50-57):

   - Converts the full fingerprint data to a 64-character hash
   - Uses the Web Crypto API for secure hashing

2. **Updated `generateBrowserFingerprint()` function** (lines 59-84):

   - Now returns a SHA-256 hash instead of the raw Base64 string
   - Moved function outside the component to avoid React Hook dependency warnings
   - The hash is deterministic - same browser always generates the same fingerprint

3. **Updated useEffect to handle async fingerprint generation** (lines 645-711):
   - Created `initFingerprint()` async function
   - Properly handles the promise returned by `generateBrowserFingerprint()`

### Backend Changes

**File:** `/home/dan_wsl/jaydeelew/CompareAI/backend/app/models.py`

Updated the `UsageLog` model (line 144):

```python
browser_fingerprint = Column(String(64))  # SHA-256 hash of browser fingerprint
```

Changed from `String(500)` to `String(64)` since SHA-256 hashes are always 64 characters in hexadecimal format.

### Database Migration

**File:** `/home/dan_wsl/jaydeelew/CompareAI/backend/migrate_fingerprint_column.py`

Created a migration script that:

- Detects the database type (SQLite vs PostgreSQL)
- For SQLite: No changes needed (VARCHAR length not enforced)
- For PostgreSQL: Alters the column to VARCHAR(64)

**Migration executed successfully** on October 18, 2025 for the SQLite development database.

## Benefits

1. **Fixed the 500 error** - Fingerprints now fit within database constraints
2. **Improved privacy** - Only the hash is stored, not the raw browser data
3. **Better performance** - Smaller data size (64 chars vs 5000+ chars)
4. **Consistent behavior** - Same browser always generates the same hash
5. **Security** - Uses Web Crypto API (SHA-256) for hashing

## Testing

After deployment, test by:

1. Opening the CompareIntel website
2. Selecting 1-2 models
3. Entering a prompt
4. Clicking "Compare"
5. Verifying that the comparison completes successfully without a 500 error

## Deployment Instructions

### For Production (with Docker):

```bash
cd /home/dan_wsl/jaydeelew/CompareAI

# Pull latest changes (if on server)
git pull origin master

# Stop current services
docker compose -f docker-compose.ssl.yml down

# Run database migration (if using PostgreSQL)
docker compose -f docker-compose.ssl.yml run --rm backend python migrate_fingerprint_column.py

# Rebuild and start services
docker compose -f docker-compose.ssl.yml up -d --build

# Verify deployment
docker compose -f docker-compose.ssl.yml ps
docker compose -f docker-compose.ssl.yml logs -f backend
```

### For Development:

```bash
cd /home/dan_wsl/jaydeelew/CompareAI

# Activate virtual environment
source venv/bin/activate

# Run migration
cd backend
python migrate_fingerprint_column.py

# Rebuild frontend
cd ../frontend
npm run build

# Restart services as needed
```

## Files Modified

1. `/frontend/src/App.tsx` - Fingerprint hashing implementation
2. `/backend/app/models.py` - Database column size update
3. `/backend/migrate_fingerprint_column.py` - New migration script (created)

## Rollback Plan

If issues occur:

1. The migration script is non-destructive (only changes column size)
2. Existing fingerprint data remains intact
3. To rollback, revert the commits and restore the previous column size

## Additional Notes

- The Prism.js error mentioned in the console is unrelated and non-critical (syntax highlighting)
- Browser fingerprints remain unique and consistent per browser/device
- No user action required - the fix is transparent to users
