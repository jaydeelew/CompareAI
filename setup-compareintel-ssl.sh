#!/bin/bash

# CompareIntel.com SSL Setup
# Pre-configured script for compareintel.com

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔒 Setting up SSL for CompareIntel.com${NC}"
echo -e "${YELLOW}🌐 Domain: compareintel.com${NC}"
echo -e "${YELLOW}📧 Email: jaydeelew@gmail.com${NC}"
echo ""

# Confirm before proceeding
read -p "Continue with SSL setup for compareintel.com? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "SSL setup cancelled."
    exit 1
fi

# Run the main SSL setup script
./setup-ssl.sh compareintel.com jaydeelew@gmail.com

echo ""
echo -e "${GREEN}✅ CompareIntel.com SSL setup complete!${NC}"
echo ""
echo -e "${YELLOW}🚀 Quick deployment commands:${NC}"
echo "# Deploy with SSL:"
echo "docker-compose -f docker-compose.ssl.yml up -d"
echo ""
echo "# Test your secure site:"
echo "curl -I https://compareintel.com"
echo ""
echo -e "${GREEN}🔗 Your secure website will be available at:${NC}"
echo "https://compareintel.com"
echo "https://www.compareintel.com"
