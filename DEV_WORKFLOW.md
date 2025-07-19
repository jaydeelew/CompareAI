# CompareAI Development Workflow

## Complete Development to Production Pipeline

### 1. Make Code Changes
Edit your frontend or backend code as needed.

### 2. (Optional) Install New Dependencies
If you add new packages:
- `docker-compose build frontend` (for npm packages)
- `docker-compose build backend` (for pip packages)

### 3. Test Changes Locally (Development)
```bash
# Start all services
docker-compose up

# Access the app at http://localhost
# Hot reloading - code changes automatically reload without rebuilding

# Stop services when done testing
docker-compose down
```

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

# Build and run production services
docker-compose -f docker-compose.prod.yml up -d --build

# If build fails with snapshot errors, rebuild with no cache:
# docker-compose -f docker-compose.prod.yml build --no-cache
# docker-compose -f docker-compose.prod.yml up -d

# If you get 502 Bad Gateway, check service status and logs:
# docker-compose -f docker-compose.prod.yml ps
# docker-compose -f docker-compose.prod.yml logs

# Test if the website is accessible:
# curl -I http://localhost

# Access the production build at http://localhost
# Test all functionality to ensure production build works correctly

# View production logs if needed
docker-compose -f docker-compose.prod.yml logs -f

# Stop production services
docker-compose -f docker-compose.prod.yml down
```

### 6. Deploy to AWS EC2
SSH into your AWS EC2 instance and pull the latest changes:

```bash
# SSH into your EC2 instance
ssh -i CompareAI.pem ec2-user@your-ec2-ip

# Navigate to your project directory
cd /path/to/CompareAI

# Pull latest changes
git pull origin master

# Stop current production services
docker-compose -f docker-compose.prod.yml down

# Build and start updated production services
docker-compose -f docker-compose.prod.yml up -d --build

# Verify services are running
docker-compose -f docker-compose.prod.yml ps

# Check logs if needed
docker-compose -f docker-compose.prod.yml logs -f
```

### 7. Verify Production Deployment
- Access your live site to ensure everything is working
- Monitor logs for any errors
- Test key functionality

## Quick Reference Commands

**Development:**
```bash
docker-compose up              # Start dev services
docker-compose down            # Stop dev services
```

**Production Testing:**
```bash
docker-compose -f docker-compose.prod.yml up -d --build    # Start prod build
docker-compose -f docker-compose.prod.yml down             # Stop prod build
```

**Git:**
```bash
git add .
git commit -m "Your message"
git push origin master
```

**EC2 Deployment:**
```bash
git pull origin master
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

## Workflow Summary
This workflow ensures you:
1. Test changes locally in development mode
2. Commit and push your changes to version control
3. Test the production build locally before deploying
4. Deploy confidently to your EC2 instance with the tested production build

## Notes
- Always test production builds locally before deploying to EC2
- Monitor logs after deployment to catch any issues
- Keep your EC2 key file secure and properly configured
- Ensure your EC2 security groups allow necessary traffic
