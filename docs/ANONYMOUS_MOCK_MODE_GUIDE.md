# Anonymous User Mock Mode Feature

## Overview

The Anonymous User Mock Mode feature allows admins to enable mock responses for all anonymous (unregistered) users from the AdminPanel. This provides a cost-effective way to test the application's anonymous user experience without making real API calls to OpenRouter.

**⚠️ Development Only**: This feature is only available in development environment. It is automatically disabled in production.

## Features

- **Global Setting**: Single toggle affects all anonymous users
- **Cost-Free Testing**: Test anonymous user flows without API costs
- **Admin Control**: Only admins can enable/disable this setting
- **Instant Responses**: Mock responses return immediately
- **Audit Trail**: All changes are logged in the admin action log

## How to Use

### Enabling Anonymous Mock Mode

1. Log in as an admin user
2. Navigate to the Admin Panel
3. Scroll to the "Application Settings" section
4. Click the "🎭 Anonymous Mock OFF" button
5. The button will change to "🎭 Anonymous Mock ON" (green) indicating the setting is active

### Disabling Anonymous Mock Mode

1. In the Admin Panel, locate the "Application Settings" section
2. Click the "🎭 Anonymous Mock ON" button
3. The button will change to "🎭 Anonymous Mock OFF" (gray) indicating the setting is disabled

### Testing with Anonymous Mock Mode

Once anonymous mock mode is enabled:

1. Log out or use an incognito window
2. Navigate to the main CompareAI interface (as an anonymous user)
3. Select any models you want to test
4. Enter a prompt and submit
5. The system will return pre-defined mock responses instead of calling OpenRouter
6. Backend console will show: `🎭 Anonymous mock mode active (global setting)`

## Technical Details

### Database Schema

The `app_settings` table stores global application settings:

```sql
CREATE TABLE app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    anonymous_mock_mode_enabled BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### Backend Implementation

#### Models (`backend/app/models.py`)

```python
class AppSettings(Base):
    """Global application settings managed by admins."""
    
    __tablename__ = "app_settings"
    
    id = Column(Integer, primary_key=True, default=1)
    anonymous_mock_mode_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
```

#### Endpoints (`backend/app/routers/admin.py`)

- `GET /api/admin/settings` - Get current app settings
- `POST /api/admin/settings/toggle-anonymous-mock-mode` - Toggle anonymous mock mode

The toggle endpoint:
- Requires admin privileges
- Automatically creates default settings if none exist
- Logs all changes in the admin action log
- Returns the new state after toggling

#### Request Handling (`backend/app/routers/api.py`)

When processing anonymous requests in `/compare-stream`:

```python
if not current_user:
    # Check if global anonymous mock mode is enabled
    settings = db.query(AppSettings).first()
    if settings and settings.anonymous_mock_mode_enabled:
        use_mock = True
        print(f"🎭 Anonymous mock mode active (global setting)")
```

### Frontend Implementation

#### AdminPanel (`frontend/src/components/admin/AdminPanel.tsx`)

The AdminPanel displays an "Application Settings" section with:
- A toggle button for anonymous mock mode
- Visual indicators (ON/OFF state)
- Descriptive text explaining the current state

State management:
- Loads app settings on panel initialization
- Refreshes settings after toggling
- Shows error messages if operations fail

## Migration

Run the migration script to create the app_settings table:

```bash
cd backend
python migrate_app_settings.py
```

This will:
1. Create the `app_settings` table if it doesn't exist
2. Add the `anonymous_mock_mode_enabled` column
3. Insert default settings (anonymous_mock_mode_enabled = False)

## Differences from User Mock Mode

| Feature | User Mock Mode | Anonymous Mock Mode |
|---------|---------------|---------------------|
| Scope | Individual user | All anonymous users |
| Control | Per-user toggle in user list | Global toggle in app settings |
| Setting | Stored in `users` table | Stored in `app_settings` table |
| Use Case | Test specific user experience | Test anonymous user experience |
| Access Level | Admin/Super-Admin users only (in production) | Any user (anonymous) |

## Environment Restrictions

**Development Only Feature**: Anonymous mock mode is only available when `ENVIRONMENT=development`:

- **Frontend**: The toggle button only appears in development mode
- **Backend**: API returns 403 error if attempting to toggle in production
- **Request Processing**: Anonymous requests ignore the mock setting in production

This ensures the feature cannot be accidentally enabled in production environments.

## Security Considerations

- Only admin users can toggle anonymous mock mode
- Only available in development environment
- All changes are logged in the admin action log
- Setting is ignored for anonymous users in production
- Anonymous mock mode applies globally and affects all unregistered users

## Troubleshooting

### Mock Mode Not Working for Anonymous Users

1. Check that `app_settings` table exists in database
2. Verify `anonymous_mock_mode_enabled` is set to `1` (true)
3. Check backend console for mock mode activation messages
4. Ensure you're actually logged out (not just using a different tab)

### Button Not Showing in Admin Panel

1. Verify you're logged in as an admin user
2. Check that app settings loaded successfully (console errors)
3. Refresh the admin panel
4. Check database connection

### Settings Not Persisting

1. Check database permissions
2. Verify migration completed successfully
3. Check backend logs for commit errors

## Future Enhancements

Potential additions to the anonymous mock mode system:
- Per-anonymous-identifier mock mode (IP/fingerprint based)
- Time-limited mock mode (auto-disable after X hours)
- Mock response customization per use case
- Statistics on anonymous user activity under mock mode
