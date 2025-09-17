# CompareAI Development Workflow


**Important:** SSL certificates must be set up on your AWS EC2 server where `compareintel.com` points, not on your local development machine.

## Four Development Environments
1. **Local Development (HTTP):** Fast development with hot reload
2. **Local Development (HTTPS):** Development with self-signed SSL certificates using nginx
3. **Local Production Testing:** HTTP build testing (no SSL complexity)
4. **AWS Production:** HTTPS with Let's Encrypt certificates

---

## Environment 1: Local Development (HTTP)
**Use 90% of the time for regular development**

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
- **URL:** http://localhost:8080
- **Features:** Hot reload, fast startup, no SSL complexity
- **File:** `docker-compose.yml`

---

## Environment 2: Local Development (HTTPS)
**Use when testing SSL-dependent features**

### When to Use
- Testing Service Workers, Geolocation, Camera/microphone access
- Before major deployments to production
- Testing payment integrations or OAuth
- Debugging SSL-related issues
- Testing features that require HTTPS

### Commands
```bash
# One-time setup: Create self-signed certificates
./create-dev-ssl.sh

# Start HTTPS development environment
docker compose -f docker-compose.dev-ssl.yml up

# Stop HTTPS development environment
docker compose -f docker-compose.dev-ssl.yml down
```

> 🔒 **SSL Issues?** For detailed SSL troubleshooting and security configuration, see [SECURITY_SETUP.md](SECURITY_SETUP.md#troubleshooting)

### Access
- **URL:** https://localhost (accept browser security warning)
- **Features:** Hot reload, matches production SSL behavior
- **File:** `docker-compose.dev-ssl.yml`

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
# Clean Docker cache if encountering build errors
docker system prune -a

# Build and start production services locally
docker compose -f docker-compose.prod.yml up -d --build

# If build fails, rebuild with no cache
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# Check service status and logs
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f

# Test website accessibility
curl -I http://localhost:8080

# Stop production testing
docker compose -f docker-compose.prod.yml down
```

### Access
- **URL:** http://localhost:8080
- **Features:** Production build, optimized assets, no SSL complexity
- **File:** `docker-compose.prod.yml`

---

## Environment 4: AWS Production (HTTPS)
**Live production deployment with SSL certificates**

### First Time Setup (One-time only)
```bash
# SSH into your EC2 instance
ssh -i CompareAI.pem ubuntu@54.163.207.252

# Navigate to your project directory
cd /path/to/CompareAI

# Pull latest changes
git pull origin master

# ONE-TIME: Set up SSL certificates for both domains
./setup-compareintel-ssl.sh

# Deploy with SSL
docker compose -f docker-compose.ssl.yml up -d --build
```

> 🔒 **Detailed SSL Setup:** For comprehensive production SSL configuration, see [Production SSL Implementation](SECURITY_SETUP.md#production-ssl-implementation) in SECURITY_SETUP.md

### Regular Deployments
```bash
# SSH into your EC2 instance
ssh -i CompareAI.pem ubuntu@54.163.207.252

# Navigate to your project directory
cd /path/to/CompareAI

# Pull latest changes
git pull origin master

# Stop current production services
docker compose -f docker-compose.ssl.yml down

# Deploy updated production services with SSL
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

> 🔍 **Need troubleshooting help?** See [SSL Troubleshooting](SECURITY_SETUP.md#troubleshooting) and [SSL Monitoring](SECURITY_SETUP.md#monitoring-ssl-health) in SECURITY_SETUP.md

---

## Development Workflow Steps

### 1. Make Code Changes
Edit frontend or backend code as needed.

### 2. Test Locally
Choose the appropriate environment:
- **Environment 1** (HTTP) for most development
- **Environment 2** (HTTPS) for SSL-dependent features

### 3. Commit and Push Changes
```bash
git add .
git commit -m "Description of your changes"
git push origin master
```

### 4. Test Production Build
Use **Environment 3** to test production build locally:
```bash
docker compose -f docker-compose.prod.yml up -d --build
# Test at http://localhost:8080
docker compose -f docker-compose.prod.yml down
```

### 5. Deploy to Production
Use **Environment 4** to deploy to AWS with SSL.

---

## Quick Reference

### Environment Commands
```bash
# Environment 1: Local Development (HTTP)
docker compose up
docker compose down

# Environment 2: Local Development (HTTPS) 
./create-dev-ssl.sh                                    # One-time setup
docker compose -f docker-compose.dev-ssl.yml up
docker compose -f docker-compose.dev-ssl.yml down

# Environment 3: Local Production Testing (HTTP)
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml down

# Environment 4: AWS Production (HTTPS)
./setup-compareintel-ssl.sh                           # One-time setup
docker compose -f docker-compose.ssl.yml up -d --build
docker compose -f docker-compose.ssl.yml down
```

### Git Commands
```bash
git add .
git commit -m "Your message"
git push origin master
```

### Automated Deployment Script
```bash
# On EC2 (after git pull)
./deploy.sh  # Update this script to use docker-compose.ssl.yml
```

---

## Environment Summary

| Environment | File | URL | Purpose | SSL |
|-------------|------|-----|---------|-----|
| **1. Local Dev (HTTP)** | `docker-compose.yml` | http://localhost:8080 | Daily development, hot reload | None |
| **2. Local Dev (HTTPS)** | `docker-compose.dev-ssl.yml` | https://localhost | SSL feature testing, hot reload | Self-signed |
| **3. Local Prod Test** | `docker-compose.prod.yml` | http://localhost:8080 | Production build testing | None |
| **4. AWS Production** | `docker-compose.ssl.yml` | https://compareintel.com | Live production site | Let's Encrypt |

**Your Four Docker Compose Files:**
- `docker-compose.yml` - Local development (HTTP, hot reload)
- `docker-compose.dev-ssl.yml` - Local development (HTTPS with self-signed certs, hot reload)
- `docker-compose.prod.yml` - Local production testing (HTTP, no SSL complexity)
- `docker-compose.ssl.yml` - AWS production deployment (HTTPS, trusted certificates)

**Cache Busting**: Your builds automatically generate unique filenames (e.g., `index.abc123.js`) so users always get the latest version without clearing browser cache.

## Notes
- Always test production builds locally (Environment 3) before deploying to EC2
- Monitor logs after deployment to catch any issues
- Keep your EC2 key file secure and properly configured
- Ensure your EC2 security groups allow necessary traffic
