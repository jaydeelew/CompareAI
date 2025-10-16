# Authentication Setup Guide

This guide will help you set up and test the new authentication system for CompareAI.

## What's Been Implemented

### Backend (✅ Complete)
- **Database Models**: Users, preferences, conversations, usage logs, subscriptions
- **Authentication System**: JWT-based authentication with bcrypt password hashing
- **Email Service**: Email verification and password reset functionality
- **Hybrid Rate Limiting**: Works for both authenticated and anonymous users
- **Subscription Tiers**: Free (10/day), Pro (50/day), Pro+ (100/day)
- **Usage Tracking**: Detailed logging of all comparisons

### Frontend (📋 Pending)
- Authentication context and state management
- Login/Register UI components
- User dashboard
- Subscription management

---

## Quick Start (Development)

### 1. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Set Up Environment Variables

Copy the example environment file:
```bash
cp env.example .env
```

Edit `.env` and add your configuration:
```env
# Required
SECRET_KEY=your_generated_secret_key_here
OPENROUTER_API_KEY=your_openrouter_key

# For email (optional in development)
MAIL_PASSWORD=your_sendgrid_api_key

# Database (optional - defaults to SQLite)
DATABASE_URL=sqlite:///./compareintel.db
```

### 3. Generate a Secret Key

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output and paste it into your `.env` file as `SECRET_KEY`.

### 4. Start the Backend

```bash
cd backend
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

---

## Testing the Authentication System

### 1. Test User Registration

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234"
  }'
```

Expected response:
```json
{
  "id": 1,
  "email": "test@example.com",
  "is_verified": false,
  "subscription_tier": "free",
  "daily_usage_count": 0,
  ...
}
```

### 2. Test User Login

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234"
  }'
```

Expected response:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### 3. Test Authenticated API Call

Save the access token from step 2, then:

```bash
curl -X GET http://localhost:8000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

### 4. Test Comparison with Authentication

```bash
curl -X POST http://localhost:8000/compare \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "input_data": "What is 2+2?",
    "models": ["openai/gpt-4o"],
    "conversation_history": []
  }'
```

### 5. Check Rate Limit Status

```bash
# For authenticated user
curl -X GET http://localhost:8000/rate-limit-status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"

# For anonymous user
curl -X GET http://localhost:8000/rate-limit-status
```

---

## Database Management

### View Database (SQLite)

```bash
cd backend
sqlite3 compareintel.db

# Inside SQLite shell:
.tables
SELECT * FROM users;
SELECT * FROM usage_logs;
.quit
```

### Reset Database (Development Only)

```bash
cd backend
rm compareintel.db
# Restart the backend - tables will be recreated automatically
```

---

## API Endpoints Reference

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/refresh` | Refresh access token | No |
| POST | `/auth/verify-email` | Verify email with token | No |
| POST | `/auth/resend-verification` | Resend verification email | No |
| POST | `/auth/forgot-password` | Request password reset | No |
| POST | `/auth/reset-password` | Reset password with token | No |
| GET | `/auth/me` | Get current user info | Yes |
| POST | `/auth/logout` | Logout (client-side) | Yes |
| DELETE | `/auth/delete-account` | Delete account | Yes (verified) |

### Comparison Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/compare` | Compare AI models | Optional |
| GET | `/models` | Get available models | No |
| GET | `/model-stats` | Get model statistics | No |
| GET | `/rate-limit-status` | Get rate limit info | Optional |

---

## Subscription Tiers

### Free Tier
- **Daily Limit**: 10 comparisons
- **Cost**: $0
- **Features**:
  - All models access
  - Standard support

### Starter Tier
- **Daily Limit**: 25 comparisons
- **Cost**: $14.99/month or $149.99/year
- **Features**:
  - All models access
  - Email support
  - Usage analytics
  - Export conversations
  - 1 month conversation history

### Pro Tier
- **Daily Limit**: 50 comparisons
- **Cost**: $29.99/month or $299.99/year
- **Features**:
  - All Starter features
  - Priority processing
  - Advanced usage analytics
  - Custom model preferences
  - 3 months conversation history

### Pro+ Tier
- **Daily Limit**: 100 comparisons
- **Cost**: $49.99/month or $499.99/year
- **Features**:
  - All Pro features
  - Advanced analytics dashboard
  - Batch processing
  - Priority email support (24-hour response)
  - 6 months conversation history
  - Custom integrations

---

## Email Configuration

### SendGrid Setup (Recommended)

1. Sign up at [SendGrid.com](https://sendgrid.com)
2. Verify your sender domain
3. Create an API key
4. Add to `.env`:
   ```env
   MAIL_USERNAME=apikey
   MAIL_PASSWORD=your_sendgrid_api_key
   MAIL_FROM=noreply@compareintel.com
   MAIL_SERVER=smtp.sendgrid.net
   MAIL_PORT=587
   ```

### Testing Email Locally

For development, you can skip email setup. The verification tokens will still be generated and can be used manually.

To get a verification token:
```bash
sqlite3 compareintel.db "SELECT verification_token FROM users WHERE email='test@example.com';"
```

Then use it to verify:
```bash
curl -X POST http://localhost:8000/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_TOKEN_HERE"}'
```

---

## Production Deployment

### 1. Set Up PostgreSQL

```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb compareai

# Create user
sudo -u postgres psql
CREATE USER compareai_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE compareai TO compareai_user;
\q
```

### 2. Update Environment Variables

```env
DATABASE_URL=postgresql://compareai_user:your_secure_password@localhost:5432/compareai
ENVIRONMENT=production
FRONTEND_URL=https://compareintel.com
```

### 3. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Run with Gunicorn

```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### 5. Configure Nginx

Update your nginx configuration to allow authentication headers:

```nginx
location /api/ {
    proxy_pass http://localhost:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Allow authentication headers
    proxy_pass_request_headers on;
}
```

---

## Troubleshooting

### "Module not found" errors

```bash
cd backend
pip install -r requirements.txt
```

### Database connection errors

Check your `DATABASE_URL` in `.env` and ensure:
- SQLite: File path is correct and writable
- PostgreSQL: Database exists and credentials are correct

### Email not sending

- Verify SendGrid API key is correct
- Check SendGrid dashboard for sending stats
- Ensure sender email is verified in SendGrid

### JWT token errors

- Ensure `SECRET_KEY` is set in `.env`
- Check that token hasn't expired (access tokens last 30 minutes)
- Use refresh token to get new access token

---

## Next Steps

1. ✅ **Backend Complete** - All authentication and rate limiting working
2. 📋 **Frontend Integration** - Create React components for auth
3. 📋 **Payment Integration** - Add Stripe for paid subscriptions
4. 📋 **User Dashboard** - Build analytics and usage tracking UI
5. 📋 **Testing** - Comprehensive testing of all flows

---

## Support

For issues or questions:
1. Check the implementation plan: `USER_AUTHENTICATION_IMPLEMENTATION_PLAN.md`
2. Review API documentation above
3. Check backend logs: `backend.log`

---

## Security Notes

- **Never commit `.env` file** - It's in `.gitignore`
- **Use strong SECRET_KEY in production** - Generate with `secrets.token_urlsafe(32)`
- **Enable HTTPS in production** - Required for secure authentication
- **Rotate secret keys periodically** - Best practice for security
- **Use environment-specific configs** - Different keys for dev/prod

