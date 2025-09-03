# CompareAI Development Workflow

## Complete Development to Production Pipeline

### SSL Setup Overview

**Important:** SSL certificates must be set up on your AWS EC2 server where `compareintel.com` points, not on your local development machine.

**Three environments:**
1. **Local Development:** HTTP or HTTPS with self-signed certs
2. **Local Production Testing:** HTTP (for testing build process)
3. **AWS Production:** HTTPS with Let's Encrypt certificates

### 1. Make Code Changes
Edit frontend or backend code as needed.

### 2. (Optional) Install New Dependencies
If you add new packages:
- `docker compose build frontend` (for npm packages)
- `docker compose build backend` (for pip packages)

### 3. Test Changes Locally (Development)

**Choose based on what you're developing:**

```bash
# Option A: HTTP development (use 90% of the time)
docker compose up
# Access at http://localhost
# ✅ Faster startup, no SSL complexity
# ✅ Good for: UI work, API development, general features

# Option B: HTTPS development (use when testing SSL features)
./create-dev-ssl.sh  # Run once to create self-signed certs
docker compose -f docker-compose.dev-ssl.yml up
# Access at https://localhost (accept browser warning)
# ✅ Matches production SSL behavior
# ✅ Good for: Testing before deployment, SSL-dependent features

# Hot reloading works in both modes
# Stop services when done testing
docker compose down
```

**When to use HTTPS development:**
- Testing Service Workers, Geolocation, Camera/microphone access
- Before major deployments to production
- Testing payment integrations or OAuth
- Debugging SSL-related issues

### 4. Commit and Push Changes
```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Description of your changes"

# Push to origin
git push origin master
```

### 5. Test Production Build Locally
```bash
# Clean Docker cache if you encounter build errors
docker system prune -a

# Build and run production services (without SSL for local testing)
docker compose -f docker-compose.prod.yml up -d --build

# If build fails with snapshot errors, rebuild with no cache:
# docker compose -f docker-compose.prod.yml build --no-cache
# docker compose -f docker-compose.prod.yml up -d

# If you get 502 Bad Gateway, check service status and logs:
# docker compose -f docker-compose.prod.yml ps
# docker compose -f docker-compose.prod.yml logs

# Test if the website is accessible:
# curl -I http://localhost

# Access the production build at http://localhost
# Test all functionality to ensure production build works correctly

# View production logs if needed
docker compose -f docker-compose.prod.yml logs -f

# Stop production services
docker compose -f docker-compose.prod.yml down
```

**Note:** Local production testing uses HTTP. The actual AWS deployment will use HTTPS with SSL.

### 6. Deploy to AWS EC2

#### First Time: Set Up SSL on Production Server (One-time setup)
```bash
# SSH into your EC2 instance
ssh -i CompareAI.pem ubuntu@54.163.207.252

# Navigate to your project directory
cd /path/to/CompareAI

# Pull latest changes (to get SSL setup files)
git pull origin master

# ONE-TIME: Set up SSL certificates (only run this once)
./setup-compareintel-ssl.sh

# Deploy with SSL
docker compose -f docker-compose.ssl.yml up -d --build
```

#### Regular Deployments (After SSL is set up)
```bash
# SSH into your EC2 instance
ssh -i CompareAI.pem ubuntu@54.163.207.252

# Navigate to your project directory
cd /path/to/CompareAI

# Pull latest changes
git pull origin master

# Stop current production services
docker compose -f docker-compose.ssl.yml down

# Build and start updated production services WITH SSL
docker compose -f docker-compose.ssl.yml up -d --build

# Verify services are running
docker compose -f docker-compose.ssl.yml ps

# Check logs if needed
docker compose -f docker-compose.ssl.yml logs -f
```

### 7. Verify Production Deployment
- Access your live site at **https://compareintel.com** (SSL enabled)
- Verify the padlock icon shows in the browser
- Monitor logs for any errors
- Test key functionality

## Quick Reference Commands

**Development:**
```bash
# HTTP development (faster)
docker compose up              
docker compose down            

# HTTPS development (matches production)
./create-dev-ssl.sh            # One-time setup
docker compose -f docker-compose.dev-ssl.yml up
docker compose -f docker-compose.dev-ssl.yml down
```

**Production Testing (Local):**
```bash
docker compose -f docker-compose.prod.yml up -d --build    # HTTP testing
docker compose -f docker-compose.prod.yml down
```

**Production Deployment (AWS EC2):**
```bash
# First time setup (one-time)
./setup-compareintel-ssl.sh   # Sets up SSL certificates

# Regular deployments
docker compose -f docker-compose.ssl.yml up -d --build     # HTTPS production
docker compose -f docker-compose.ssl.yml down
```

**Git:**
```bash
git add .
git commit -m "Your message"
git push origin master
```

**EC2 Deployment (Option 1 - manual):**
```bash
git pull origin master
docker compose -f docker-compose.ssl.yml down
docker compose -f docker-compose.ssl.yml up -d --build
```

**EC2 Deployment (Option 2 - Automated Script):**
```bash
git pull origin master
./deploy.sh  # You'll need to update this script to use docker-compose.ssl.yml
```

## Workflow Summary
This workflow ensures you:
1. Test changes locally in development mode (HTTP or HTTPS as needed)
2. Commit and push your changes to version control
3. Test the production build locally before deploying (HTTP)
4. Deploy confidently to your EC2 instance with SSL-enabled production build (HTTPS)

**Your Three Docker Compose Files:**
- `docker-compose.yml` - Local development (HTTP, hot reload)
- `docker-compose.prod.yml` - Local production testing (HTTP, no SSL complexity)
- `docker-compose.ssl.yml` - AWS production deployment (HTTPS, trusted certificates)

**Cache Busting**: Your builds now automatically generate unique filenames (e.g., `index.abc123.js`) so users always get the latest version without needing to clear their browser cache.

## Notes
- Always test production builds locally before deploying to EC2
- Monitor logs after deployment to catch any issues
- Keep your EC2 key file secure and properly configured
- Ensure your EC2 security groups allow necessary traffic
