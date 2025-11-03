# CompareAI

Compare responses from 50+ AI models side-by-side. Production-ready platform with authentication, tiered subscriptions, and comprehensive LaTeX/Markdown rendering.

**Live:** [https://compareintel.com](https://compareintel.com)

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** FastAPI (Python) + PostgreSQL/SQLite + JWT Authentication
- **AI Integration:** OpenRouter API (unified access to 50+ models)
- **Infrastructure:** Docker + Nginx + Let's Encrypt SSL
- **Deployment:** AWS EC2

## Key Features

- 50+ models from Anthropic, OpenAI, Google, Meta, Mistral, DeepSeek, Cohere, Qwen, xAI
- User authentication with email verification
- Tiered subscriptions (Free: 10/day, Starter: 25/day, Pro: 50/day + overages)
- Rate limiting (IP + browser fingerprint for anonymous, subscription-based for authenticated)
- LaTeX/KaTeX rendering for mathematical content
- Multi-turn conversations with context preservation
- Concurrent model processing (up to 12 models simultaneously)

## Quick Start

### Prerequisites

- Docker & Docker Compose
- [OpenRouter API Key](https://openrouter.ai/) (free)

### Setup

```bash
git clone https://github.com/jaydeelew/CompareAI.git
cd CompareAI

# Create environment file
cat > backend/.env << EOF
OPENROUTER_API_KEY=your_key_here
SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
DATABASE_URL=sqlite:///./compareintel.db
EOF

# Start development environment
docker compose up --build
```

**Access:** http://localhost:8080 (frontend) | http://localhost:8000 (API)

### Environment Variables

```bash
# Required
OPENROUTER_API_KEY=sk-or-...        # Get from openrouter.ai
SECRET_KEY=...                       # JWT signing key

# Optional
DATABASE_URL=sqlite:///./compareintel.db  # Or PostgreSQL for production
MAIL_USERNAME=...                    # SendGrid/SMTP for emails
MAIL_PASSWORD=...
MAIL_FROM=noreply@yourdomain.com
FRONTEND_URL=http://localhost:5173  # For email links
```

## Production Deployment

```bash
# Manual deployment
docker compose -f docker-compose.ssl.yml up -d --build

# Or use deployment scripts
./deploy-production.sh
```

**Deploy Options:**

- `docker-compose.yml` - Development (HTTP)
- `docker-compose.dev-ssl.yml` - Development (HTTPS, self-signed)
- `docker-compose.prod.yml` - Production (HTTP)
- `docker-compose.ssl.yml` - Production (HTTPS, Let's Encrypt)

See [DEV_WORKFLOW.md](DEV_WORKFLOW.md) for detailed deployment workflows.

## Architecture

**Authentication Flow:**

- JWT tokens (30min access, 7-day refresh)
- Email verification via SendGrid/SMTP
- Password reset with secure tokens
- Optional anonymous usage (IP/fingerprint tracking)

**Rate Limiting (Model-Based):**

- Anonymous (unregistered): 10 model responses/day (IP + browser fingerprint)
- Free (registered): 20 model responses/day
- Starter: 50 model responses/day + overage options (pricing TBD)
- Starter+: 100 model responses/day + overage options (pricing TBD)
- Pro: 200 model responses/day + overage options (pricing TBD)
- Pro+: 400 model responses/day + overage options (pricing TBD)

**Model Limits per Comparison:**

- Anonymous: 3 models max
- Free: 3 models max
- Starter/Starter+: 6 models max
- Pro/Pro+: 9 models max

**Support & Features:**

- Starter/Starter+: 48-hour email support, 30 days chat history
- Pro/Pro+: 24-hour priority email support, 60-90 days chat history

## Key API Endpoints

All endpoints are prefixed with `/api`:

**Authentication:**
```
POST /api/auth/register              # Create account
POST /api/auth/login                  # Get JWT tokens  
POST /api/auth/refresh                # Refresh access token
POST /api/auth/verify-email           # Verify email with token
POST /api/auth/resend-verification    # Resend verification email
POST /api/auth/forgot-password        # Request password reset
POST /api/auth/reset-password         # Reset password with token
POST /api/auth/logout                 # Logout (invalidate tokens)
GET  /api/auth/me                     # Get current user info
DELETE /api/auth/delete-account       # Delete user account
```

**Core AI Comparison:**
```
POST /api/compare                     # Compare AI models (rate limited)
POST /api/compare-stream              # Streaming comparison (SSE)
GET  /api/models                      # List all available models
GET  /api/rate-limit-status           # Check usage status
GET  /api/model-stats                 # Performance metrics
GET  /api/anonymous-mock-mode-status  # Check anonymous mock mode (dev only)
POST /api/dev/reset-rate-limit        # Reset limits (dev only)
GET  /api/conversations               # List user conversations
GET  /api/conversations/{id}          # Get conversation details
DELETE /api/conversations/{id}        # Delete conversation
```

**Admin (requires admin privileges):**
```
GET    /api/admin/stats                        # System statistics
GET    /api/admin/users                        # List all users
GET    /api/admin/users/{user_id}              # Get user details
POST   /api/admin/users                        # Create new user
PUT    /api/admin/users/{user_id}              # Update user
DELETE /api/admin/users/{user_id}              # Delete user
POST   /api/admin/users/{user_id}/toggle-active        # Toggle user active status
POST   /api/admin/users/{user_id}/reset-usage          # Reset user usage
POST   /api/admin/users/{user_id}/toggle-mock-mode     # Toggle mock mode
POST   /api/admin/users/{user_id}/change-tier          # Change subscription tier
POST   /api/admin/users/{user_id}/send-verification    # Resend verification
POST   /api/admin/users/{user_id}/reset-password       # Admin password reset
GET    /api/admin/action-logs                   # View admin action logs
GET    /api/admin/settings                      # Get app settings (dev only)
POST   /api/admin/settings/toggle-anonymous-mock-mode # Toggle anonymous mock mode (dev only)
POST   /api/admin/settings/zero-anonymous-usage        # Reset anonymous usage (dev only)
```

## Configuration

**Performance Tuning** (`backend/app/model_runner.py`):

- `MAX_CONCURRENT_REQUESTS = 9` - Parallel API calls (matches Pro tier limit)
- `INDIVIDUAL_MODEL_TIMEOUT = 120` - Seconds per model
- `BATCH_SIZE = 9` - Models per batch (optimized for Pro tier)

**Subscription Tiers** (`backend/app/rate_limiting.py`):

```python
# MODEL-BASED PRICING: daily_limit = model responses per day
SUBSCRIPTION_CONFIG = {
    "free": {"daily_limit": 20, "model_limit": 3, "overage_allowed": False},  # Registered users
    "starter": {"daily_limit": 50, "model_limit": 6, "overage_allowed": True},
    "starter_plus": {"daily_limit": 100, "model_limit": 6, "overage_allowed": True},
    "pro": {"daily_limit": 200, "model_limit": 9, "overage_allowed": True},
    "pro_plus": {"daily_limit": 400, "model_limit": 9, "overage_allowed": True}
}
# Anonymous (unregistered): 10 model responses/day, 3 models max
```

**Note:** Usage is now tracked by individual model responses, not comparisons. Each model in a comparison counts as one response toward the daily limit.

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, endpoints, CORS
│   ├── model_runner.py      # OpenRouter integration
│   ├── auth.py              # JWT, password hashing
│   ├── database.py          # SQLAlchemy setup
│   ├── models.py            # Database models
│   ├── schemas.py           # Pydantic schemas
│   ├── dependencies.py      # Auth dependencies
│   ├── rate_limiting.py     # Rate limit logic
│   ├── email_service.py     # Email sending
│   ├── mock_responses.py    # Mock responses for testing
│   └── routers/
│       ├── auth.py          # Auth endpoints
│       ├── admin.py         # Admin endpoints
│       └── api.py           # Core API endpoints (compare, models, etc.)
├── alembic/                 # Database migrations
├── create_admin_user.py    # Admin user creation script
├── requirements.txt
└── openrouter_models.json  # Model definitions

frontend/
├── src/
│   ├── App.tsx              # Main component
│   ├── main.tsx            # Entry point
│   ├── components/
│   │   ├── LatexRenderer.tsx       # LaTeX/Markdown renderer
│   │   ├── TermsOfService.tsx      # Terms of service component
│   │   ├── Footer.tsx              # Footer component
│   │   ├── auth/                   # Auth components
│   │   ├── admin/                  # Admin panel components
│   │   └── index.ts                # Component exports
│   ├── contexts/
│   │   └── AuthContext.tsx  # Auth state management
│   ├── types/
│   │   └── auth.ts          # TypeScript types
│   └── styles/              # CSS styles
└── package.json
```

## Documentation

**Core Documentation:**
- [DEV_WORKFLOW.md](docs/DEV_WORKFLOW.md) - Development & deployment guide
- [RATE_LIMITING_IMPLEMENTATION.md](docs/RATE_LIMITING_IMPLEMENTATION.md) - Rate limiting details
- [OVERAGE_PRICING_ANALYSIS.md](docs/OVERAGE_PRICING_ANALYSIS.md) - Pricing model & financials
- [CACHE_BUSTING_SETUP.md](docs/CACHE_BUSTING_SETUP.md) - Cache busting strategy

**Feature Documentation:**
- [CONTEXT_MANAGEMENT_IMPLEMENTATION.md](docs/CONTEXT_MANAGEMENT_IMPLEMENTATION.md) - Conversation context management
- [LATEX_STREAMING_FIX.md](docs/LATEX_STREAMING_FIX.md) - LaTeX rendering in streaming responses
- [TAB_STREAMING_SOLUTION.md](docs/TAB_STREAMING_SOLUTION.md) - Tab-based streaming implementation
- [STREAMING_SUMMARY.md](docs/STREAMING_SUMMARY.md) - Streaming functionality overview
- [SUPPORT_EMAIL_IMPLEMENTATION.md](docs/SUPPORT_EMAIL_IMPLEMENTATION.md) - Support email system

**Additional Resources:**
- [ENV_SETUP_GUIDE.md](docs/ENV_SETUP_GUIDE.md) - Environment setup guide
- [TESTING_CONTEXT_MANAGEMENT.md](docs/TESTING_CONTEXT_MANAGEMENT.md) - Testing guide for context management
- [STREAMING_QUICK_TEST.md](docs/STREAMING_QUICK_TEST.md) - Quick test guide for streaming
- [STREAMING_SPACES_FIX.md](docs/STREAMING_SPACES_FIX.md) - Streaming whitespace fixes
- [FEATURE_RECOMMENDATIONS.md](docs/FEATURE_RECOMMENDATIONS.md) - Future feature recommendations
- [FUTURE_OPTIMIZATIONS.md](docs/FUTURE_OPTIMIZATIONS.md) - Optimization suggestions

## Contributing

Contributions welcome! Fork, create a feature branch, and submit a PR. Follow TypeScript/FastAPI best practices and test with multiple models.

## License

MIT License - see [LICENSE](LICENSE) file.
