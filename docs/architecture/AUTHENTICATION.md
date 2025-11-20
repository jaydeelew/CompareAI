# Authentication & Authorization

Complete guide to CompareIntel's authentication and authorization system.

## Overview

CompareIntel uses JWT (JSON Web Tokens) for stateless authentication. The system supports:
- User registration and email verification
- Password-based authentication
- Token refresh mechanism
- Role-based access control (RBAC)
- Anonymous user support with IP/fingerprint tracking

## Authentication Flow

### 1. Registration Flow

```
User → POST /api/auth/register
  ↓
Backend creates user with hashed password
  ↓
Generates email verification token
  ↓
Sends verification email (background task)
  ↓
Returns access_token + refresh_token
  ↓
User can immediately use the app (email verification optional)
```

### 2. Login Flow

```
User → POST /api/auth/login (email + password)
  ↓
Backend verifies password hash
  ↓
Checks if account is active
  ↓
Generates new access_token + refresh_token
  ↓
Returns tokens + user data
```

### 3. Token Refresh Flow

```
Client detects access_token expired (401)
  ↓
Client → POST /api/auth/refresh (refresh_token)
  ↓
Backend validates refresh_token
  ↓
Generates new access_token
  ↓
Returns new access_token
```

### 4. Protected Endpoint Access

```
Client → GET /api/auth/me
  ↓
Includes: Authorization: Bearer <access_token>
  ↓
Backend validates JWT signature
  ↓
Checks expiration
  ↓
Extracts user_id from token
  ↓
Loads user from database
  ↓
Returns user data
```

## JWT Token Structure

### Access Token

**Expiration:** 30 minutes  
**Algorithm:** HS256  
**Claims:**
```json
{
  "sub": "123",  // User ID
  "exp": 1705312800,  // Expiration timestamp
  "type": "access"
}
```

### Refresh Token

**Expiration:** 7 days  
**Algorithm:** HS256  
**Claims:**
```json
{
  "sub": "123",  // User ID
  "exp": 1705917600,  // Expiration timestamp
  "type": "refresh"
}
```

## Password Security

### Hashing Algorithm

- **Algorithm:** bcrypt
- **Rounds:** 12
- **Salt:** Auto-generated per password

### Password Requirements

- Minimum 8 characters
- At least one digit
- At least one uppercase letter
- At least one lowercase letter
- At least one special character: `!@#$%^&*()_+-=[]{};':"\\|,.<>/?`

### Password Reset Flow

```
User → POST /api/auth/forgot-password (email)
  ↓
Backend generates reset token
  ↓
Saves token + expiration (1 hour) to database
  ↓
Sends reset email with token
  ↓
User clicks link → Frontend extracts token
  ↓
User → POST /api/auth/reset-password (token + new_password)
  ↓
Backend validates token + expiration
  ↓
Hashes new password
  ↓
Updates user password
  ↓
Invalidates reset token
```

## Email Verification

### Verification Flow

```
User registers → Verification token generated
  ↓
Token expires in 24 hours
  ↓
Email sent with verification link
  ↓
User clicks link → Frontend extracts token
  ↓
User → POST /api/auth/verify-email (token)
  ↓
Backend validates token + expiration
  ↓
Marks user as verified
  ↓
Invalidates verification token
```

### Resending Verification

Users can request a new verification email:
```
POST /api/auth/resend-verification
{
  "email": "user@example.com"
}
```

## Authorization & Roles

### Role Hierarchy

1. **user** (default)
   - Can use comparison features
   - Limited by subscription tier
   - Can manage own account

2. **moderator**
   - All user permissions
   - Can view user reports
   - Can moderate content

3. **admin**
   - All moderator permissions
   - Can manage users
   - Can view admin dashboard
   - Can change subscription tiers
   - Can reset usage

4. **super_admin**
   - All admin permissions
   - Can manage admins
   - Can access system settings
   - Can toggle mock mode

### Permission Checks

**Dependency Injection:**
```python
from ..dependencies import get_current_user, get_current_admin_user

# Optional authentication
@router.get("/endpoint")
async def endpoint(current_user: Optional[User] = Depends(get_current_user)):
    if current_user:
        # Authenticated user
    else:
        # Anonymous user

# Required authentication
@router.get("/protected")
async def protected(current_user: User = Depends(get_current_user_required)):
    # User is guaranteed to be authenticated

# Admin only
@router.get("/admin")
async def admin(current_user: User = Depends(get_current_admin_user)):
    # User is guaranteed to be admin
```

## Anonymous Users

Anonymous (unregistered) users can use CompareIntel with limitations:

### Rate Limiting

- **Daily Limit:** 10 model responses
- **Model Limit:** 3 models per comparison
- **Tracking:** IP address + browser fingerprint

### Browser Fingerprinting

The frontend generates a unique fingerprint based on:
- User agent
- Screen resolution
- Timezone
- Language
- Canvas fingerprint
- WebGL fingerprint

This fingerprint is hashed (SHA-256) and sent with requests for anonymous rate limiting.

### Anonymous Mock Mode

In development, anonymous users can use mock mode (bypasses API calls):
```
GET /api/anonymous-mock-mode-status
```

## Token Management Best Practices

### Client-Side Storage

**Recommended:** Store tokens in memory or secure HTTP-only cookies

**Not Recommended:** localStorage (XSS vulnerability)

### Token Refresh Strategy

```javascript
// Intercept 401 responses
if (response.status === 401) {
  // Try to refresh token
  const refreshToken = getRefreshToken();
  const newAccessToken = await refreshAccessToken(refreshToken);
  
  // Retry original request with new token
  return retryRequest(originalRequest, newAccessToken);
}
```

### Automatic Refresh

Refresh access token before expiration:
```javascript
// Refresh 5 minutes before expiration
const tokenExpiry = getTokenExpiry(accessToken);
const refreshTime = tokenExpiry - 5 * 60 * 1000; // 5 minutes

setTimeout(() => {
  refreshAccessToken();
}, refreshTime);
```

## Security Considerations

### 1. Token Theft Prevention

- Use HTTPS in production
- Implement token rotation
- Monitor for suspicious activity
- Invalidate tokens on logout

### 2. Password Security

- Never log passwords
- Use strong hashing (bcrypt)
- Enforce password requirements
- Implement rate limiting on login attempts

### 3. Email Verification

- Verify email ownership
- Limit verification attempts
- Expire tokens quickly (24 hours)
- Use secure token generation

### 4. Rate Limiting

- Limit login attempts per IP
- Limit password reset requests
- Limit email verification requests
- Track suspicious patterns

## Error Handling

### Common Authentication Errors

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Unauthorized | Invalid or expired token |
| 401 | Invalid credentials | Wrong email/password |
| 403 | Forbidden | Insufficient permissions |
| 400 | Email already registered | Email exists |
| 400 | Invalid token | Verification/reset token invalid |
| 400 | Token expired | Verification/reset token expired |

### Error Response Format

```json
{
  "detail": "Invalid or expired token"
}
```

## Implementation Examples

### Python (Backend)

```python
from ..auth import create_access_token, verify_password
from ..dependencies import get_current_user

@router.post("/login")
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    
    if not user.is_active:
        raise HTTPException(403, "Account is inactive")
    
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user
    }
```

### JavaScript (Frontend)

```javascript
// Login
async function login(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  const data = await response.json();
  
  // Store tokens (use secure storage)
  setAccessToken(data.access_token);
  setRefreshToken(data.refresh_token);
  
  return data;
}

// Authenticated request
async function getCurrentUser() {
  const token = getAccessToken();
  
  const response = await fetch('/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.status === 401) {
    // Token expired, try refresh
    await refreshToken();
    return getCurrentUser(); // Retry
  }
  
  return response.json();
}

// Token refresh
async function refreshToken() {
  const refreshToken = getRefreshToken();
  
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  
  if (!response.ok) {
    // Refresh failed, logout user
    logout();
    throw new Error('Session expired');
  }
  
  const data = await response.json();
  setAccessToken(data.access_token);
}
```

## Testing Authentication

### Test User Creation

```python
# Create test user
user = User(
    email="test@example.com",
    password_hash=get_password_hash("TestPass123!"),
    is_verified=True,
    is_active=True,
    subscription_tier="pro"
)
db.add(user)
db.commit()
```

### Test Token Generation

```python
from ..auth import create_access_token

token = create_access_token({"sub": str(user.id)})

# Use in tests
headers = {"Authorization": f"Bearer {token}"}
response = client.get("/api/auth/me", headers=headers)
```

---

**Last Updated:** January 2025  
**Security Version:** 1.0

