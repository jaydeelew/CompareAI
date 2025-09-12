# Timeout Prevention Improvements for CompareAI

## Problem
When selecting all models (53+ models) with the "Select All" checkbox, the application frequently returns "Request timed out. Please try again." This happened because:

1. All models were processed simultaneously without limits
2. Default timeout settings were too short for large requests
3. No user feedback about expected wait times
4. Infrastructure timeouts weren't configured for long-running requests

## Solutions Implemented

### 1. Backend Improvements (`backend/app/model_runner.py`)

**Batching & Concurrency Control:**
- Added `MAX_CONCURRENT_REQUESTS = 8` to limit simultaneous API calls
- Added `BATCH_SIZE = 10` to process models in smaller groups
- Added `INDIVIDUAL_MODEL_TIMEOUT = 45` seconds per model
- Implemented `run_models_batch()` function for controlled execution
- Added proper error handling with descriptive messages

**Key Changes:**
```python
# Configuration for handling large numbers of models
MAX_CONCURRENT_REQUESTS = 8  # Limit concurrent requests
INDIVIDUAL_MODEL_TIMEOUT = 45  # Timeout per individual model
BATCH_SIZE = 10  # Process models in smaller batches
```

### 2. Frontend Improvements (`frontend/src/App.tsx`)

**Dynamic Timeout Handling:**
- Base timeout: 60 seconds
- Additional 10 seconds per 10 models selected
- Maximum timeout: 5 minutes (300 seconds)
- Better error messages with specific timeout duration

**User Experience Enhancements:**
- Warning message when selecting 30+ models
- Estimated completion time display
- "Top 5" and "Popular" quick selection buttons
- Improved loading messages with progress information
- Show model count in button text

**Key Changes:**
```javascript
// Dynamic timeout based on number of models
const baseTimeout = 60000;
const additionalTime = Math.floor(selectedModels.length / 10) * 10000;
const maxTimeout = 300000; // 5 minutes max
const dynamicTimeout = Math.min(baseTimeout + additionalTime, maxTimeout);
```

### 3. Nginx Configuration Updates

**All Nginx configs updated with:**
- `proxy_connect_timeout 10s`
- `proxy_send_timeout 300s` (5 minutes)
- `proxy_read_timeout 300s` (5 minutes)
- `proxy_buffering off` for real-time streaming

**Files Updated:**
- `nginx/nginx.conf`
- `nginx/nginx.prod.conf`
- `nginx/nginx.ssl.conf`
- `nginx/nginx.dev-ssl.conf`

### 4. Backend Server Configuration (`backend/entrypoint.sh`)

**Uvicorn & Gunicorn Timeouts:**
- Development: `--timeout-keep-alive 300`
- Production: `--timeout 300 --keep-alive 300`

### 5. API Error Handling (`backend/app/main.py`)

**Improved Error Handling:**
- Better logging for large requests
- More descriptive error messages
- Warning logs for requests with 40+ models

## Expected Performance

### Small Requests (1-10 models):
- **Time:** 30-60 seconds
- **Timeout:** 60 seconds
- **Concurrent:** Up to 8 models at once

### Medium Requests (11-30 models):
- **Time:** 1-3 minutes
- **Timeout:** 90-180 seconds
- **Processing:** 3 batches of 10 models each

### Large Requests (31+ models):
- **Time:** 3-5 minutes
- **Timeout:** 210-300 seconds (5 min max)
- **Processing:** Multiple batches with controlled concurrency
- **Warning:** User warned about expected wait time

## User Interface Improvements

1. **Quick Selection Options:**
   - "Top 5" button: Selects 5 most popular models
   - "Popular" button: Selects one model from each provider
   - Reduces likelihood of selecting all models accidentally

2. **Clear Feedback:**
   - Model count shown in selection interface
   - Warning for 30+ model selections
   - Estimated completion time displayed
   - Dynamic loading messages based on selection size

3. **Better Error Messages:**
   - Specific timeout duration in error message
   - Suggestion to select fewer models
   - Clear indication of what went wrong

## Deployment Notes

To apply these changes:

1. **Restart the application** to apply server configuration changes
2. **Clear browser cache** to ensure frontend updates are loaded
3. **Monitor logs** for any timeout warnings in backend

## Testing Recommendations

1. **Test with different model counts:**
   - 5 models (should complete in ~30 seconds)
   - 15 models (should complete in ~2 minutes)
   - 30+ models (should complete in ~3-5 minutes with warnings)

2. **Verify timeout handling:**
   - Test that warnings appear for large selections
   - Confirm estimated times are accurate
   - Check that error messages are helpful

3. **Monitor API rate limits:**
   - Watch for rate limiting errors from OpenRouter
   - Verify batching is working correctly
   - Check that concurrent request limits are respected

## Future Enhancements

1. **Progress Tracking:** Real-time progress updates during processing
2. **Model Prioritization:** Process faster/more reliable models first
3. **Caching:** Cache responses for identical inputs
4. **Streaming Results:** Display results as they complete instead of waiting for all