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
# One-command SSL setup (AWS EC2)
./setup-ssl.sh yourdomain.com your@email.com

# Or manual deployment
docker compose -f docker-compose.ssl.yml up -d --build
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
- Starter: 150 model responses/day + overage options (pricing TBD)
- Pro: 450 model responses/day + overage options (pricing TBD)

**Model Limits per Comparison:**

- Anonymous: 3 models max
- Free: 3 models max
- Starter: 6 models max
- Pro: 9 models max

## Key API Endpoints

```
POST /auth/register              # Create account
POST /auth/login                 # Get JWT tokens
POST /auth/verify-email          # Verify email with token
POST /compare                    # Compare AI models (rate limited)
GET  /models                     # List all available models
GET  /rate-limit-status          # Check usage status
GET  /model-stats                # Performance metrics
```

## Configuration

**Performance Tuning** (`backend/app/model_runner.py`):

- `MAX_CONCURRENT_REQUESTS = 12` - Parallel API calls
- `INDIVIDUAL_MODEL_TIMEOUT = 120` - Seconds per model
- `BATCH_SIZE = 12` - Models per batch

**Subscription Tiers** (`backend/app/rate_limiting.py`):

```python
# MODEL-BASED PRICING: daily_limit = model responses per day
SUBSCRIPTION_CONFIG = {
    "free": {"daily_limit": 20, "model_limit": 3, "overage_allowed": False},  # Registered users
    "starter": {"daily_limit": 150, "model_limit": 6, "overage_allowed": True},
    "pro": {"daily_limit": 450, "model_limit": 9, "overage_allowed": True}
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
│   └── routers/
│       └── auth.py          # Auth endpoints
└── requirements.txt

frontend/
├── src/
│   ├── App.tsx              # Main component
│   ├── components/
│   │   ├── LatexRenderer.tsx       # LaTeX/Markdown renderer
│   │   └── auth/                   # Auth components
│   ├── contexts/
│   │   └── AuthContext.tsx  # Auth state management
│   └── types/
│       └── auth.ts          # TypeScript types
└── package.json
```

## Documentation

- [DEV_WORKFLOW.md](DEV_WORKFLOW.md) - Development & deployment guide
- [RATE_LIMITING_IMPLEMENTATION.md](RATE_LIMITING_IMPLEMENTATION.md) - Rate limiting details
- [OVERAGE_PRICING_ANALYSIS.md](OVERAGE_PRICING_ANALYSIS.md) - Pricing model & financials
- [CACHE_BUSTING_SETUP.md](CACHE_BUSTING_SETUP.md) - Cache busting strategy

## Contributing

Contributions welcome! Fork, create a feature branch, and submit a PR. Follow TypeScript/FastAPI best practices and test with multiple models.

## License

MIT License - see [LICENSE](LICENSE) file.
