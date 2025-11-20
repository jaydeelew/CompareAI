# Cookie-Based Authentication Implementation

This document describes the migration from localStorage-based token storage to HTTP-only cookie-based authentication for CompareAI.

## Overview

CompareAI now uses **HTTP-only cookies** for storing JWT authentication tokens instead of localStorage. This provides significant security improvements, particularly against XSS (Cross-Site Scripting) attacks.

## Security Benefits

### 1. XSS Protection
- **Before:** Tokens stored in localStorage were accessible to JavaScript, making them vulnerable to XSS attacks
- **After:** HTTP-only cookies cannot be accessed by JavaScript, preventing token theft via XSS

### 2. CSRF Protection
- Cookies use `SameSite='lax'` attribute, which prevents cookies from being sent with cross-site POST requests
- This provides built-in CSRF (Cross-Site Request Forgery) protection

### 3. Automatic Token Management
- Cookies are automatically sent with requests, eliminating the need for manual Authorization headers
- Reduces client-side code complexity

### 4. Secure by Default
- Cookies use `Secure` flag in production (HTTPS only)
- `HttpOnly` flag prevents JavaScript access
- `SameSite='lax'` provides CSRF protection

## Implementation Details

### Backend Changes

#### Cookie Utility Module (`backend/app/utils/cookies.py`)
- `set_auth_cookies()`: Sets HTTP-only cookies for access and refresh tokens
- `clear_auth_cookies()`: Clears authentication cookies on logout
- `get_token_from_cookies()`: Retrieves access token from cookies
- `get_refresh_token_from_cookies()`: Retrieves refresh token from cookies

#### Authentication Endpoints (`backend/app/routers/auth.py`)

**Login Endpoint (`POST /api/auth/login`)**
- Sets cookies in response using `set_auth_cookies()`
- Returns tokens in JSON body for backward compatibility (can be removed in future)

**Register Endpoint (`POST /api/auth/register`)**
- Sets cookies in response after successful registration
- User is automatically logged in

**Refresh Endpoint (`POST /api/auth/refresh`)**
- Accepts refresh token from cookies (preferred) or request body (backward compatibility)
- Sets new tokens in cookies

**Logout Endpoint (`POST /api/auth/logout`)**
- Clears authentication cookies using `clear_auth_cookies()`

#### Dependency Updates (`backend/app/dependencies.py`)

**`get_current_user()` and `get_current_user_required()`**
- Now check cookies first (preferred method)
- Fall back to Authorization header for backward compatibility
- This allows gradual migration without breaking existing clients

### Frontend Changes

#### AuthContext (`frontend/src/contexts/AuthContext.tsx`)

**Removed:**
- `getAccessToken()` and `getRefreshToken()` functions
- `saveTokens()` and `clearTokens()` localStorage operations
- Manual token management

**Updated:**
- All fetch requests now include `credentials: 'include'` to send cookies
- `fetchCurrentUser()` no longer requires access token parameter
- `refreshToken()` reads refresh token from cookies automatically
- `logout()` calls backend endpoint to clear cookies

#### API Interceptors (`frontend/src/services/api/interceptors.ts`)

**Updated `authInterceptor`:**
- Removed manual Authorization header injection
- Now ensures `credentials: 'include'` is set for cookie-based auth
- Cookies are automatically sent by the browser

#### API Client (`frontend/src/services/api/client.ts`)

**Removed:**
- `getToken` configuration option (no longer needed)

**Note:** The `getToken` property is still accepted for backward compatibility but is not used.

## Cookie Configuration

### Cookie Names
- `access_token`: JWT access token (30 minutes expiry)
- `refresh_token`: JWT refresh token (7 days expiry)

### Cookie Attributes
- **HttpOnly:** `true` - Prevents JavaScript access (XSS protection)
- **Secure:** `true` in production - HTTPS only
- **SameSite:** `lax` - CSRF protection
- **Path:** `/` - Available site-wide
- **Max-Age:** Matches token expiration times

## Migration Path

### Backward Compatibility
The implementation maintains backward compatibility:
- Backend accepts tokens from both cookies (preferred) and Authorization headers
- Frontend can gradually migrate without breaking changes
- Old clients using Authorization headers will continue to work

### Migration Steps

1. **Backend Deployment**
   - Deploy backend changes (cookies are set, but Authorization header still works)
   - No breaking changes for existing clients

2. **Frontend Deployment**
   - Deploy frontend changes (uses cookies, but backend still accepts headers)
   - Users automatically get cookies on next login

3. **Cleanup (Future)**
   - Remove Authorization header fallback from backend (optional)
   - Remove token response from login/register endpoints (optional)

## Testing

### Manual Testing Checklist

- [ ] Login sets cookies correctly
- [ ] Cookies are sent with subsequent requests
- [ ] Refresh token works from cookies
- [ ] Logout clears cookies
- [ ] User remains authenticated after page refresh
- [ ] Cross-origin requests work (if applicable)
- [ ] HTTPS-only cookies in production

### Browser DevTools Verification

1. **Application Tab → Cookies**
   - Verify `access_token` and `refresh_token` cookies exist
   - Check `HttpOnly`, `Secure`, and `SameSite` flags

2. **Network Tab**
   - Verify cookies are sent in request headers
   - Check `Cookie` header is present in authenticated requests

## Security Considerations

### XSS Protection
- HTTP-only cookies cannot be accessed by JavaScript
- Even if XSS vulnerability exists, tokens cannot be stolen

### CSRF Protection
- `SameSite='lax'` prevents cookies from being sent with cross-site POST requests
- For additional protection, consider implementing CSRF tokens for state-changing operations

### Token Expiration
- Access tokens expire in 30 minutes (short-lived)
- Refresh tokens expire in 7 days
- Tokens are automatically refreshed before expiration

### HTTPS Requirement
- Cookies use `Secure` flag in production
- Ensures tokens are only sent over encrypted connections

## Troubleshooting

### Cookies Not Being Set
- Verify backend is setting cookies correctly (check response headers)
- Ensure `credentials: 'include'` is set in frontend requests
- Check CORS configuration allows credentials

### Cookies Not Being Sent
- Verify `credentials: 'include'` is set in fetch requests
- Check CORS `allow_credentials=True` is set in backend
- Ensure same-origin or proper CORS configuration

### Authentication Failing
- Check browser console for errors
- Verify cookies exist in Application tab
- Check network tab for Cookie header in requests
- Verify backend is reading from cookies correctly

## Future Enhancements

### Potential Improvements
1. **CSRF Tokens:** Add explicit CSRF token validation for additional protection
2. **Token Rotation:** Implement refresh token rotation on use
3. **Token Blacklisting:** Add Redis-based token blacklisting for logout
4. **Cookie Prefixes:** Use `__Host-` or `__Secure-` prefixes for additional security

## References

- [OWASP Cookie Security](https://owasp.org/www-community/HttpOnly)
- [MDN SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [FastAPI Cookies Documentation](https://fastapi.tiangolo.com/advanced/response-cookies/)

---

**Last Updated:** January 2025  
**Version:** 1.0

