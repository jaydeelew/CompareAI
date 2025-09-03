#!/bin/bash

# SSL Setup Script for CompareAI
# This script sets up SSL certificates using Let's Encrypt

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔒 CompareAI SSL Setup Script${NC}"
echo "This script will set up SSL certificates for your domain using Let's Encrypt"
echo ""

# Check if domain is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Domain name is required${NC}"
    echo "Usage: $0 <domain-name> [email]"
    echo "Example: $0 compareintel.com jaydeelew@gmail.com"
    exit 1
fi

DOMAIN=$1
EMAIL=${2:-"jaydeelew@gmail.com"}

echo -e "${YELLOW}🌐 Domain: $DOMAIN${NC}"
echo -e "${YELLOW}📧 Email: $EMAIL${NC}"
echo ""

# Confirm before proceeding
read -p "Continue with SSL setup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "SSL setup cancelled."
    exit 1
fi

echo -e "${GREEN}📦 Installing Certbot...${NC}"
# Install certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

echo -e "${GREEN}🔐 Obtaining SSL certificate...${NC}"
# Obtain SSL certificate
sudo certbot certonly --nginx \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ SSL certificate obtained successfully!${NC}"
else
    echo -e "${RED}❌ Failed to obtain SSL certificate${NC}"
    exit 1
fi

echo -e "${GREEN}📝 Updating nginx configuration...${NC}"
# Update the nginx SSL config with the actual domain (if still using placeholder)
if grep -q "your-domain.com" ./nginx/nginx.ssl.conf; then
    sed -i "s/your-domain.com/$DOMAIN/g" ./nginx/nginx.ssl.conf
fi

echo -e "${GREEN}🔄 Setting up certificate auto-renewal...${NC}"
# Set up automatic renewal
sudo crontab -l 2>/dev/null | grep -v certbot | sudo tee /tmp/crontab.tmp > /dev/null
echo "0 12 * * * /usr/bin/certbot renew --quiet && docker-compose -f docker-compose.prod.yml restart nginx" | sudo tee -a /tmp/crontab.tmp > /dev/null
sudo crontab /tmp/crontab.tmp
sudo rm /tmp/crontab.tmp

echo -e "${GREEN}🐳 Updating Docker configuration...${NC}"
# Create SSL-enabled docker-compose file
cat > docker-compose.ssl.yml << EOF
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      args:
        ENVIRONMENT: production
    environment:
      - PYTHONPATH=/app
    env_file:
      - ./backend/.env
    networks:
      - compareai-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: build
      args:
        - VITE_API_URL=/api
    volumes:
      - ./frontend/dist:/app/dist
    depends_on:
      - backend
    networks:
      - compareai-network
    command: npm run build

  nginx:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: prod
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.ssl.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/lib/letsencrypt:/var/lib/letsencrypt:ro
    depends_on:
      - backend
      - frontend
    networks:
      - compareai-network

networks:
  compareai-network:
    driver: bridge
EOF

echo ""
echo -e "${GREEN}🎉 SSL setup completed successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update your DNS to point $DOMAIN to this server's IP address"
echo "2. Deploy with SSL: docker-compose -f docker-compose.ssl.yml up -d"
echo "3. Test your secure site: https://$DOMAIN"
echo ""
echo -e "${GREEN}📋 Security features enabled:${NC}"
echo "✅ SSL/TLS encryption (HTTPS)"
echo "✅ HTTP to HTTPS redirect"
echo "✅ Security headers (HSTS, CSP, etc.)"
echo "✅ Rate limiting on API endpoints"
echo "✅ Automatic certificate renewal"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "- Test your SSL setup at: https://www.ssllabs.com/ssltest/"
echo "- Monitor certificate expiry: sudo certbot certificates"
echo "- Manual renewal: sudo certbot renew"
