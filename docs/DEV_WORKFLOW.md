# CompareAI Development Workflow

**Important:** SSL certificates must be set up on your AWS EC2 server where `compareintel.com` points, not on your local development machine.

## Four Development Environments

1. **Local Development (HTTP):** Fast development with hot reload
2. **Local Development (HTTPS):** Development with self-signed SSL certificates with hot reload
3. **Local Production Testing:** HTTP build testing (no SSL complexity)
4. **AWS Production:** HTTPS with Let's Encrypt certificates

---

## Environment 1: Local Development (HTTP)

### Option A: Local (No Docker) - Recommended for Daily Development

**When to use:** UI work, API development, most feature development, fastest iteration

```bash
# Terminal 1 - Backend
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev

# Check if running:
Backend: Visit http://localhost:8000/docs (should show API documentation)
Frontend: Visit http://localhost:5173 (should show the app)

# Stop servers:
# Option 1: Press Ctrl+C in each terminal (if you have the terminals open)
# Option 2: Kill by port number (if terminals are closed)
lsof -ti:8000 | xargs kill -9  # Kill backend
lsof -ti:5173 | xargs kill -9  # Kill frontend
```

**Access:** http://localhost:5173  
**Features:** Fastest startup (~3s), instant hot reload, direct API connection

### Option B: Docker with Nginx - For Integration Testing

**When to use:** Before commits, testing nginx routing, verifying production-like behavior

```bash
# Start all services
docker compose up

# Stop services
docker compose down
```

**Access:** http://localhost:8080 (nginx proxy)  
**Backend API Docs:** http://localhost:8000/docs  
**Features:** Production-like architecture, nginx handles `/api/*` routing to backend

---

## Environment 2: Local Development (HTTPS)

**Use when testing SSL-dependent features**

### When to Use

- Testing Service Workers, Geolocation, Camera/microphone access
- Before major deployments to production
- Testing payment integrations or OAuth
- Debugging SSL-related issues
- Testing features that require HTTPS (e.g. Screenshot functionality)

### Commands

```bash
# One-time setup: Create self-signed certificates
./create-dev-ssl.sh

# Start HTTPS development environment
docker compose -f docker-compose.dev-ssl.yml up

# Stop HTTPS development environment
docker compose -f docker-compose.dev-ssl.yml down
```

### Access

- **URL:** https://localhost (accept browser security warning)
- **Features:** Hot reload, matches production SSL behavior

---

## Environment 3: Local Production Testing (HTTP)

**Use to test production builds before deployment**

### When to Use

- Testing production build process locally
- Verifying optimized builds work correctly
- Final testing before AWS deployment
- Debugging production build issues

### Commands

```bash
# Build and start production services locally
docker compose -f docker-compose.prod.yml up -d --build

# Clean Docker cache if encountering build errors
docker system prune -a

# If build fails, rebuild with no cache
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# Check service status and logs
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f

# Stop production testing
docker compose -f docker-compose.prod.yml down
```

### Access

- **URL:** http://localhost:8080
- **Features:** Production build, optimized assets, no SSL complexity

---

## Environment 4: AWS Production (HTTPS)

**Live production deployment with SSL certificates**

```bash
# SSH into your EC2 instance
ssh -i CompareAI.pem ubuntu@44.212.141.149

# ONE-TIME: Set up SSL certificates for both domains
./setup-compareintel-ssl.sh

cd CompareAI

# Pull latest changes
git pull origin master

# Stop current production services
docker compose -f docker-compose.ssl.yml down

# Deploy with SSL
docker compose -f docker-compose.ssl.yml up -d --build

# Verify deployment
docker compose -f docker-compose.ssl.yml ps
docker compose -f docker-compose.ssl.yml logs -f

```

### Access & Verification

- **Primary URL:** https://compareintel.com
- **Secondary URL:** https://www.compareintel.com
- **Features:** Production build, Let's Encrypt SSL, optimized performance
- **File:** `docker-compose.ssl.yml`

**Post-deployment checklist:**

- ✅ Verify padlock icon shows in browser for both URLs
- ✅ Test key functionality
- ✅ Monitor logs for any errors

---

**Cache Busting**: Your builds automatically generate unique filenames (e.g., `index.abc123.js`) so users always get the latest version without clearing browser cache.
