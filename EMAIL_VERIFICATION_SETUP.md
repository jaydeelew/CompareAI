# Email Verification Setup

## Overview
CompareIntel now includes email verification for new user registrations. Users must verify their email address to ensure account security and enable communication.

## How It Works

### Registration Flow
1. User registers with email and password
2. Account is created immediately (user can log in right away)
3. User receives a verification email with a unique token
4. User clicks the verification link in the email
5. Email is verified and user gets full account access

### User Experience
- **Unverified Users**: See an orange banner at the top of the page reminding them to verify their email
- **Banner Features**:
  - Dismissible (user can close it temporarily)
  - "Resend Verification Email" button
  - Auto-hides once email is verified
- **Verification Email**: Contains a clickable button that redirects to the app with a verification token
- **Verification Modal**: Appears automatically when user clicks the link, showing verification status

## Implementation Details

### Backend Components
- **Models** (`app/models.py`):
  - `is_verified`: Boolean flag for email verification status
  - `verification_token`: Unique token for verification
  - `verification_token_expires`: Token expiration (24 hours)

- **Endpoints** (`app/routers/auth.py`):
  - `POST /auth/register`: Creates user and sends verification email
  - `POST /auth/verify-email`: Verifies email with token
  - `POST /auth/resend-verification`: Resends verification email

- **Email Service** (`app/email_service.py`):
  - `send_verification_email()`: Sends formatted verification email with link
  - Uses FastMail with configurable SMTP settings

### Frontend Components
- **VerificationBanner** (`VerificationBanner.tsx`):
  - Orange banner for unverified users
  - Shows at top of page after model selection section
  - Includes "Resend Verification Email" button
  - Dismissible with X button
  - Auto-hides for verified users

- **VerifyEmail** (`VerifyEmail.tsx`):
  - Modal that handles verification flow
  - Detects token in URL parameters
  - Shows verification status (verifying/success/error)
  - Auto-closes and clears URL after success
  - Refreshes user data to update verification status

- **App Integration** (`App.tsx`):
  - Checks for `?token=xxx` in URL on load
  - Opens verification modal if token present
  - Shows VerificationBanner for authenticated unverified users

## Email Configuration

### Environment Variables (`.env` in backend)
```env
# Email Service Configuration
MAIL_USERNAME=your-smtp-username
MAIL_PASSWORD=your-smtp-password
MAIL_FROM=noreply@compareintel.com
MAIL_PORT=587
MAIL_SERVER=smtp.sendgrid.net

# Frontend URL (for verification links)
FRONTEND_URL=http://localhost:5173
```

### Development Mode
If email credentials are not configured:
- Verification email is skipped
- Token is printed to console for testing
- Users can still register and use the app

### Recommended Email Providers
1. **SendGrid** (recommended)
   - Free tier: 100 emails/day
   - Easy setup
   - Good deliverability

2. **Mailgun**
   - Free tier: 5,000 emails/month
   - Flexible API

3. **Amazon SES**
   - Pay-as-you-go
   - Very reliable
   - Requires verification

## Verification Email Template

The email includes:
- **Header**: "Welcome to CompareIntel!"
- **Body**: Instructions to verify email
- **Button**: "Verify Email Address" (prominent, clickable)
- **Fallback Link**: Plain text URL if button doesn't work
- **Footer**: Security note about link expiration
- **Branding**: Purple gradient colors matching app design

## Testing

### Manual Testing
1. Register a new account
2. Check backend console for verification token (if email not configured)
3. Construct URL: `http://localhost:5173?token=YOUR_TOKEN`
4. Open URL in browser
5. Verify that:
   - Verification modal appears
   - Shows "Verifying..." then "Success"
   - Orange banner disappears
   - User is marked as verified in database

### With Email Configured
1. Register with real email
2. Check inbox for verification email
3. Click "Verify Email Address" button
4. Verify successful verification

## Security Features

1. **Token Expiration**: Tokens expire after 24 hours
2. **One-time Use**: Token is cleared after successful verification
3. **Secure Storage**: Tokens are hashed in database
4. **Rate Limiting**: Prevent spam verification requests (to be implemented)
5. **No User Enumeration**: Resend endpoint doesn't reveal if email exists

## Future Enhancements

1. **Required Verification**: Optionally require verification before allowing comparisons
2. **Email Preferences**: Allow users to manage email settings
3. **Verification Reminders**: Send reminder if not verified after X days
4. **Social Login**: Add OAuth providers (Google, GitHub) as alternative to email
5. **Rate Limiting**: Limit verification email requests per user/IP

## Database Schema

```sql
-- Users table includes verification fields
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    verification_token VARCHAR(255),
    verification_token_expires DATETIME,
    -- ... other fields
);
```

## Troubleshooting

### Verification Email Not Received
1. Check spam folder
2. Verify email service credentials in `.env`
3. Check backend console for errors
4. Use "Resend Verification Email" button

### Token Expired
- User can request new verification email from banner
- New token is generated with fresh 24-hour expiration

### Verification Modal Not Opening
- Ensure URL has `?token=xxx` parameter
- Check browser console for errors
- Verify frontend can reach backend API

### Email Service Errors
- Check SMTP credentials
- Verify MAIL_PORT and MAIL_SERVER settings
- Check email provider API limits
- Review backend logs for specific errors

## Production Checklist

- [ ] Configure email service credentials
- [ ] Set proper FRONTEND_URL for production domain
- [ ] Test email deliverability
- [ ] Monitor email bounce rates
- [ ] Set up email sending limits/quotas
- [ ] Configure SPF/DKIM/DMARC for email domain
- [ ] Test verification flow end-to-end
- [ ] Set up email service monitoring
- [ ] Configure error alerts for email failures

## Related Files

### Backend
- `/backend/app/models.py` - Database models
- `/backend/app/routers/auth.py` - Auth endpoints
- `/backend/app/email_service.py` - Email sending logic
- `/backend/app/auth.py` - Token generation

### Frontend
- `/frontend/src/components/auth/VerificationBanner.tsx` - Banner component
- `/frontend/src/components/auth/VerifyEmail.tsx` - Verification modal
- `/frontend/src/App.tsx` - Main app integration
- `/frontend/src/contexts/AuthContext.tsx` - Auth state management

## Support

For issues or questions:
1. Check backend logs for errors
2. Review console logs in browser DevTools
3. Verify environment variables are set correctly
4. Test with development mode (no email service) first

