# CompareAI Development Workflow

**Important:** SSL certificates must be set up on your AWS EC2 server where `compareintel.com` points, not on your local development machine.

## Four Development Environments

1. **Local Development (HTTP):** Fast development with hot reload
2. **Local Development (HTTPS):** Development with self-signed SSL certificates with hot reload
3. **Local Production Testing:** HTTP build testing (no SSL complexity)
4. **AWS Production:** HTTPS with Let's Encrypt certificates

---

## Environment 1: Local Development (HTTP)

### When to Use

- General UI work and styling
- API development and testing
- Most feature development
- When you need fastest startup times

### Commands

```bash
# Start development environment
docker compose up

# Install new dependencies (if needed)
docker compose build frontend  # for npm packages
docker compose build backend   # for pip packages

# Stop development environment
docker compose down
```

### Access

- **URL:** http://localhost:5173 (recommended for development)
- **Alternative:** http://localhost:8080 (through nginx proxy)
- **Features:** Hot reload, fast startup, Vite proxy for API calls

### Development Notes

- **Vite Proxy:** API calls to `/api/*` are automatically proxied to the backend container
- **Fast Development:** Access via port 5173 for fastest development experience
- **Production Testing:** Use port 8080 to test nginx routing behavior

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
ssh -i CompareAI.pem ubuntu@54.163.207.252

cd CompareAI

# Pull latest changes
git pull origin master

# ONE-TIME: Set up SSL certificates for both domains
./setup-compareintel-ssl.sh

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