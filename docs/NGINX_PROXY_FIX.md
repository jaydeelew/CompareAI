# Nginx Proxy Configuration Fix

## Problem
Production build was returning 404 errors for API endpoints:
- `/api/models` → 404
- `/api/rate-limit-status` → 404

## Root Cause
The nginx configuration had a URL rewrite rule that was stripping the `/api` prefix before proxying to the backend:

```nginx
# OLD (BROKEN) Configuration
location /api/ {
    rewrite ^/api/(.*)$ /$1 break;  # This removes /api prefix
    proxy_pass http://backend:8000;
}
```

**Problem Flow:**
1. Frontend requests: `/api/models`
2. Nginx rewrites to: `/models`
3. Proxies to backend: `http://backend:8000/models`
4. Backend expects: `http://backend:8000/api/models` (router mounted at `/api` prefix)
5. Result: **404 Not Found**

## Solution
Removed the rewrite rule and properly configured the proxy_pass directive to preserve the `/api` path:

```nginx
# NEW (FIXED) Configuration
location /api/ {
    proxy_pass http://backend:8000/api/;  # Preserves /api prefix
}
```

**Fixed Flow:**
1. Frontend requests: `/api/models`
2. Nginx proxies to: `http://backend:8000/api/models`
3. Backend receives at correct route: `/api/models`
4. Result: **✅ Success**

## Files Updated

All nginx configuration files have been updated with the fix:

1. **`nginx/nginx.conf`** - Development (Docker)
2. **`nginx/nginx.dev-ssl.conf`** - Development with SSL
3. **`nginx/nginx.prod.conf`** - Production (Docker)
4. **`nginx/nginx.ssl.conf`** - Production with SSL

## Additional Improvements

Added proper SSE (Server-Sent Events) streaming configuration to all files:

```nginx
# Critical settings for Server-Sent Events (SSE) streaming
proxy_buffering off;                    # Disable nginx buffering
proxy_cache off;                        # Disable caching
proxy_set_header Connection '';         # Clear connection header for HTTP/1.1
proxy_http_version 1.1;                 # Use HTTP/1.1 for streaming
chunked_transfer_encoding on;           # Enable chunked transfer encoding

# Additional SSE optimizations
proxy_request_buffering off;            # Don't buffer request body
tcp_nodelay on;                         # Disable Nagle's algorithm for low latency
tcp_nopush off;                         # Send data immediately
```

Increased timeouts for AI model operations:
```nginx
proxy_connect_timeout 15s;
proxy_send_timeout 480s;    # 8 minutes
proxy_read_timeout 480s;    # 8 minutes
```

## Testing

To test the fix:

1. **Rebuild production containers:**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml build --no-cache nginx
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Verify API endpoints:**
   ```bash
   # Should return 200 OK with model list
   curl http://localhost:8080/api/models
   
   # Should return 200 OK with rate limit status
   curl http://localhost:8080/api/rate-limit-status
   ```

3. **Check frontend console:**
   - Should see successful API calls
   - No more 404 errors

## Why This Matters

- **Correct routing**: API calls reach the right endpoints
- **Consistent behavior**: Development and production work the same way
- **SSE streaming**: Real-time streaming responses work properly
- **Better performance**: Optimized proxy settings for AI workloads

## Backend Route Structure

For reference, the backend FastAPI routes are mounted at `/api` prefix in `backend/app/main.py`:

```python
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(api.router, prefix="/api")
```

So the correct URLs are:
- `/api/models` ✅
- `/api/rate-limit-status` ✅
- `/api/compare` ✅
- `/api/compare-stream` ✅
- `/api/auth/*` ✅
- `/api/admin/*` ✅

NOT:
- `/models` ❌
- `/rate-limit-status` ❌

