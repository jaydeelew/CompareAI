# Anonymous Mock Mode Banner Fix

## Issue

The banner was not appearing for anonymous users because the frontend was trying to fetch the anonymous mock mode setting from `/api/admin/settings`, which requires authentication.

## Solution

Created a new public endpoint `/api/anonymous-mock-mode-status` that:
- Does not require authentication
- Only works in development mode
- Returns the anonymous mock mode status

## Changes Made

### Backend (`backend/app/routers/api.py`)

Added new endpoint:
```python
@router.get("/anonymous-mock-mode-status")
async def get_anonymous_mock_mode_status(db: Session = Depends(get_db)):
    """
    Public endpoint to check if anonymous mock mode is enabled.
    Only returns status in development environment.
    """
```

This endpoint:
- Is publicly accessible (no authentication required)
- Only returns status in development mode
- Returns `{"anonymous_mock_mode_enabled": False, "is_development": False}` in production

### Frontend (`frontend/src/App.tsx`)

Updated the fetch call to use the new endpoint:
```typescript
const response = await fetch(`${API_URL}/anonymous-mock-mode-status`);
```

## Testing

1. Start the backend server in development mode
2. Log in as admin
3. Go to Admin Panel
4. Enable "Anonymous Mock ON"
5. Log out or use incognito window
6. You should see the green banner: "🎭 Anonymous Mock Mode Active - Using test responses instead of real API calls (Dev Mode)"

## Security

- The endpoint is only available in development mode
- In production, it returns `anonymous_mock_mode_enabled: false`
- No sensitive data is exposed
- The banner only appears in development mode in the frontend

