# Frontend Authentication Setup Guide

**Date:** October 15, 2025  
**Phase 1 Complete:** ✅ Authentication UI

---

## 🎉 What's Been Implemented

### ✅ Components Created:

1. **`AuthContext`** (`frontend/src/contexts/AuthContext.tsx`)
   - Manages authentication state
   - Handles login, register, logout
   - Auto-refreshes tokens
   - Provides `useAuth()` hook

2. **`LoginForm`** (`frontend/src/components/auth/LoginForm.tsx`)
   - Email/password login
   - Error handling
   - Loading states

3. **`RegisterForm`** (`frontend/src/components/auth/RegisterForm.tsx`)
   - User registration
   - Password validation
   - Confirm password

4. **`AuthModal`** (`frontend/src/components/auth/AuthModal.tsx`)
   - Modal wrapper for login/register
   - Switch between modes
   - Close on overlay click

5. **`UserMenu`** (`frontend/src/components/auth/UserMenu.tsx`)
   - User avatar dropdown
   - Subscription tier badge
   - Usage stats display
   - Logout button

6. **`ProtectedRoute`** (`frontend/src/components/auth/ProtectedRoute.tsx`)
   - Wrapper for protected content
   - Redirects unauthenticated users

7. **TypeScript Types** (`frontend/src/types/auth.ts`)
   - User interface
   - Auth credentials
   - Context types

---

## 🚀 How to Use

### Environment Variables

Create a `.env` file in the `frontend` directory:

```env
# API Base URL (backend server)
VITE_API_BASE_URL=http://localhost:8000

# Legacy API URL (for compare endpoint)
VITE_API_URL=http://localhost:8000
```

### Using Authentication in Components

```tsx
import { useAuth } from './contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();

  if (isAuthenticated) {
    return <div>Welcome, {user.email}!</div>;
  }

  return <button onClick={() => login({ email, password })}>Login</button>;
}
```

### Protected Content

```tsx
import { ProtectedRoute } from './components/auth';

function Dashboard() {
  return (
    <ProtectedRoute>
      <div>This content requires authentication</div>
    </ProtectedRoute>
  );
}
```

### Making Authenticated API Calls

```tsx
import { useAuthHeaders } from './contexts/AuthContext';

function MyComponent() {
  const getHeaders = useAuthHeaders();

  const fetchData = async () => {
    const response = await fetch('/api/protected-endpoint', {
      headers: getHeaders(),
    });
    // ...
  };
}
```

---

## 🎨 UI Features

### Navigation Bar:
- **Not Authenticated:** Shows "Sign In" and "Sign Up" buttons
- **Authenticated:** Shows user menu with:
  - User avatar (first letter of email)
  - Subscription tier badge (Free/Starter/Pro)
  - Today's usage count
  - Monthly overage count (if any)
  - Links to Dashboard, Pricing, Settings
  - Sign Out button

### Auth Modal:
- Clean, modern design
- Smooth animations
- Form validation
- Error messages
- Switch between login/register

---

## 🔧 Technical Details

### Token Management:
- **Access tokens:** Stored in localStorage
- **Refresh tokens:** Stored in localStorage
- **Auto-refresh:** Every 14 minutes (tokens expire in 15)
- **Logout:** Clears all tokens

### API Integration:
- **Login endpoint:** `POST /auth/login`
- **Register endpoint:** `POST /auth/register`
- **User info endpoint:** `GET /auth/me`
- **Refresh endpoint:** `POST /auth/refresh`

### State Management:
- React Context API
- No external state library needed
- Automatic re-renders on auth state changes

---

## 🧪 Testing the Implementation

### 1. Start the Backend:
```bash
cd backend
python -m uvicorn app.main:app --reload
```

### 2. Start the Frontend:
```bash
cd frontend
npm run dev
```

### 3. Test Flow:
1. Click "Sign Up" in the navigation
2. Register with email/password
3. You should be logged in automatically
4. See your user menu in the top right
5. Click on the menu to see options
6. Try logging out and back in

---

## 📝 Files Created

```
frontend/
├── src/
│   ├── types/
│   │   └── auth.ts                    # TypeScript types
│   ├── contexts/
│   │   └── AuthContext.tsx            # Auth state management
│   └── components/
│       └── auth/
│           ├── index.ts               # Exports
│           ├── LoginForm.tsx          # Login form
│           ├── RegisterForm.tsx       # Register form
│           ├── AuthModal.tsx          # Modal wrapper
│           ├── AuthForms.css          # Form styles
│           ├── UserMenu.tsx           # User dropdown
│           ├── UserMenu.css           # Menu styles
│           └── ProtectedRoute.tsx     # Route protection
```

---

## 🎯 What's Working

✅ User registration  
✅ User login  
✅ Token storage  
✅ Auto token refresh  
✅ User menu display  
✅ Logout functionality  
✅ Protected routes  
✅ Error handling  
✅ Loading states  
✅ Responsive design

---

## 🚧 Next Steps (Phase 2)

### Pricing & Subscription UI:
- [ ] Create pricing page component
- [ ] Build subscription management page
- [ ] Add Stripe checkout integration
- [ ] Create upgrade modals
- [ ] Show tier comparison table

### Usage Dashboard:
- [ ] Build usage dashboard component
- [ ] Display daily/monthly usage charts
- [ ] Show overage tracking
- [ ] Add billing history
- [ ] Create usage analytics

### Overage Flow:
- [ ] Create limit warning modal
- [ ] Add overage payment flow
- [ ] Show overage charges in billing
- [ ] Add overage limit settings

---

## 💡 Tips

### Debugging:
- Check browser console for errors
- Check Network tab for API calls
- Verify backend is running on port 8000
- Check localStorage for tokens

### Common Issues:

**"Failed to fetch user"**
- Backend not running
- Wrong API URL in .env
- CORS issues

**"Token refresh failed"**
- Refresh token expired
- Backend auth endpoints not working
- Check backend logs

**Modal not appearing**
- Check z-index in CSS
- Verify modal state is updating
- Check for console errors

---

## 🎨 Customization

### Change Colors:
Edit `AuthForms.css` and `UserMenu.css` to match your brand colors.

### Change Token Expiry:
Edit `AuthContext.tsx` line with token refresh interval:
```tsx
const interval = setInterval(() => {
  refreshToken();
}, 14 * 60 * 1000); // Change this value
```

### Add Social Login:
Add buttons to `LoginForm.tsx` and implement OAuth flow.

---

## 📚 API Documentation

### Login
```
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=password123

Response:
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "user": { ... }
}
```

### Register
```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response: Same as login
```

### Get Current User
```
GET /auth/me
Authorization: Bearer <access_token>

Response:
{
  "id": 1,
  "email": "user@example.com",
  "subscription_tier": "free",
  "daily_usage_count": 5,
  ...
}
```

---

## ✅ Phase 1 Complete!

The authentication system is fully functional and ready to use. Users can now:
- Register for accounts
- Log in and out
- See their subscription tier
- Track their usage
- Access protected features

**Next:** Implement Phase 2 (Pricing & Subscription UI) when ready!

