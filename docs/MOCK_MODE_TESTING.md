# Mock Mode Testing Feature

## Overview

The Mock Mode feature allows admin and super-admin users to test the CompareAI application without making actual API calls to OpenRouter. This significantly reduces testing costs and allows for rapid iteration during development and testing phases.

## 🎯 Key Features

- **Cost-Free Testing**: Test application behavior without incurring OpenRouter API costs
- **Instant Responses**: Mock responses are generated instantly without network latency
- **Tier Simulation**: Includes both standard and extended length responses for comprehensive testing
- **Admin-Only Access**: Feature is restricted to admin and super-admin users for security
- **Easy Toggle**: Simple one-click toggle in the admin panel to enable/disable mock mode
- **Audit Trail**: All mock mode changes are logged in the admin action log

## 🔒 Security & Access Control

Mock mode access depends on the environment:

### Development Mode

- **Admins can enable Mock mode for any user** - Perfect for testing with different user types
- Regular users can have Mock mode enabled by admins for testing purposes
- This allows comprehensive testing of the application with various user roles

### Production Mode

- **Admins can only enable Mock mode for admin and super-admin users**
- Regular users cannot have Mock mode enabled
- This ensures that only trusted administrators can use this testing feature in production

The system automatically detects the environment using the `ENVIRONMENT` environment variable.

## 📦 Installation & Setup

### 1. Run the Migration

First, add the `mock_mode_enabled` field to the database:

```bash
cd backend
python migrate_mock_mode.py
```

This migration will:

- Add the `mock_mode_enabled` boolean field to the `users` table
- Set default value to `FALSE` for all existing users
- Verify the migration was successful

### 2. Restart the Application

After running the migration, restart your backend server:

```bash
# If using Docker
docker-compose restart backend

# If running locally
cd backend
python -m uvicorn app.main:app --reload
```

## 🎮 Usage

### Enabling Mock Mode

1. Log in as an admin or super-admin user
2. Navigate to the Admin Panel
3. Find the user you want to enable mock mode for
4. Click the "🎭 Mock OFF" button
5. The button will change to "🎭 Mock ON" (green) indicating mock mode is active

**Note:** In development mode, admins can enable Mock mode for any user (including regular users). In production mode, admins can only enable Mock mode for admin and super-admin users.

### Disabling Mock Mode

1. In the Admin Panel, locate the user with mock mode enabled
2. Click the "🎭 Mock ON" button
3. The button will change to "🎭 Mock OFF" (gray) indicating mock mode is disabled

### Testing with Mock Mode

Once mock mode is enabled for your user:

1. Navigate to the main CompareAI interface
2. Select any models you want to test
3. Enter a prompt and submit
4. The system will return pre-defined mock responses instead of calling OpenRouter
5. Backend console will show: `🎭 Mock mode enabled - returning mock {tier} response for {model_id}`

## 📝 Mock Response Types

The system includes two types of mock responses:

### Standard Response (Tier: 'standard')

- **Length**: ~500-800 tokens
- **Use Case**: Testing standard-length responses
- **Content**: Comprehensive answer with multiple sections

### Extended Response (Tier: 'extended')

- **Length**: ~1200-1500 tokens
- **Use Case**: Testing extended-length responses
- **Content**: Detailed answer with extensive sections, examples, and analysis

### Brief Response (Tier: 'brief')

- **Length**: ~200-300 tokens
- **Use Case**: Testing brief responses
- **Content**: Truncated version of standard response

## 🔧 Technical Details

### Database Schema

The `mock_mode_enabled` field is added to the `users` table:

```sql
ALTER TABLE users ADD COLUMN mock_mode_enabled BOOLEAN DEFAULT FALSE;
```

### Backend Implementation

#### Model Runner (`backend/app/model_runner.py`)

- Modified `call_openrouter_streaming()` to accept `use_mock` parameter
- Modified `call_openrouter()` to accept `use_mock` parameter
- When `use_mock=True`, returns mock responses from `mock_responses.py`

#### Main API (`backend/app/main.py`)

- `/compare-stream` endpoint checks `current_user.mock_mode_enabled`
- Passes `use_mock` flag to model runner functions

#### Admin API (`backend/app/routers/admin.py`)

- New endpoint: `POST /admin/users/{user_id}/toggle-mock-mode`
- Validates user role (admin/super-admin only)
- Logs action in audit trail
- Returns updated user data

### Frontend Implementation

#### Admin Panel (`frontend/src/components/admin/AdminPanel.tsx`)

- New `toggleMockMode()` function
- Mock mode button visible only for admin/super-admin users
- Visual indicator: Green for enabled, Gray for disabled
- Tooltip shows current status

#### Type Definitions

- Updated `User` interface in `frontend/src/types/auth.ts`
- Updated `AdminUser` interface in `AdminPanel.tsx`
- Updated `UserResponse` and `AdminUserResponse` schemas in `backend/app/schemas.py`

## 🧪 Testing Scenarios

### Scenario 1: Test Different Response Lengths

1. Enable mock mode
2. Submit a comparison with "Standard" tier
3. Verify you receive ~500-800 token responses
4. Switch to "Extended" tier
5. Verify you receive ~1200-1500 token responses

### Scenario 2: Test Multiple Models

1. Enable mock mode
2. Select 5-9 different models
3. Submit a comparison
4. Verify all models return mock responses
5. Verify streaming behavior works correctly

### Scenario 3: Test UI Behavior

1. Enable mock mode
2. Test various UI features:
   - Model selection
   - Response rendering
   - Markdown formatting
   - Code block highlighting
   - Follow-up conversations

### Scenario 4: Test Error Handling

1. Enable mock mode
2. Verify no actual API errors occur
3. Test application behavior with "failed" models (if implemented)

## 📊 Monitoring & Logging

When mock mode is active, the backend logs include:

```
🎭 Mock mode active for user {email}
🎭 Mock mode enabled - returning mock {tier} response for {model_id}
```

All mock mode toggles are logged in the `admin_action_logs` table with:

- `action_type`: "toggle_mock_mode"
- `action_description`: "Enabled/Disabled mock mode for user {email}"
- `details`: JSON with previous and new state
- IP address and user agent

## 🚫 Limitations

1. **Admin/Super-Admin Only**: Cannot be enabled for regular users or moderators
2. **Same Response Content**: All models return the same mock content (though this could be extended)
3. **No Real API Testing**: Mock mode doesn't test actual API connectivity or model-specific behavior
4. **Usage Tracking**: Mock responses still count toward usage limits (consider adjusting this if needed)

## 🔮 Future Enhancements

Potential improvements to consider:

1. **Model-Specific Mocks**: Different mock responses for different model types
2. **Configurable Responses**: Allow admins to upload custom mock responses
3. **Response Timing**: Simulate realistic API response delays
4. **Error Simulation**: Option to simulate API errors for error handling testing
5. **Usage Exemption**: Option to not count mock responses toward usage limits
6. **Mock Response Library**: Collection of different response types (technical, creative, etc.)

## 🐛 Troubleshooting

### Mock Mode Button Not Appearing

- Verify the user has `admin` or `super_admin` role
- Check browser console for JavaScript errors
- Refresh the admin panel

### Mock Mode Not Working

- Verify the migration was run successfully
- Check backend logs for mock mode activation messages
- Verify user's `mock_mode_enabled` field is `TRUE` in database
- Restart the backend server

### Cannot Enable Mock Mode

- Error: "Mock mode can only be enabled for admin/super-admin users"
  - Solution: User must have `admin` or `super_admin` role
- Error: "Authentication required"
  - Solution: Log in again with admin credentials

### Migration Failed

- Check database connection
- Verify you have database write permissions
- Check if column already exists: `SELECT mock_mode_enabled FROM users LIMIT 1;`

## 📚 Related Files

### Backend

- `/backend/app/models.py` - User model with `mock_mode_enabled` field
- `/backend/app/mock_responses.py` - Mock response content
- `/backend/app/model_runner.py` - Model execution with mock support
- `/backend/app/main.py` - Main API with mock mode check
- `/backend/app/routers/admin.py` - Admin endpoint for toggling mock mode
- `/backend/app/schemas.py` - API schemas with mock mode field
- `/backend/migrate_mock_mode.py` - Database migration script

### Frontend

- `/frontend/src/components/admin/AdminPanel.tsx` - Admin UI with toggle button
- `/frontend/src/components/admin/AdminPanel.css` - Styling for mock mode button
- `/frontend/src/types/auth.ts` - User type definitions

## ✅ Checklist for Deployment

Before deploying to production:

- [ ] Run migration script on production database
- [ ] Restart production backend servers
- [ ] Clear frontend build cache
- [ ] Test mock mode in production environment
- [ ] Verify only admins can access the feature
- [ ] Check audit logs are working
- [ ] Document for team members
- [ ] Add monitoring for mock mode usage

## 🎓 Best Practices

1. **Always Disable in Production**: Mock mode should primarily be used in development/staging
2. **Test Thoroughly**: Use mock mode to test edge cases and UI behavior
3. **Monitor Usage**: Regularly check admin logs to see who's using mock mode
4. **Document Tests**: Keep track of what scenarios you've tested with mock mode
5. **Update Mock Content**: Periodically review and update mock responses to reflect realistic outputs

## 📞 Support

For issues or questions about mock mode:

1. Check this documentation
2. Review backend logs for error messages
3. Check admin action logs for audit trail
4. Verify user roles and permissions

---

**Last Updated**: October 2025  
**Version**: 1.0.0  
**Author**: CompareAI Development Team
