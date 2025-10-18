#!/bin/bash
# Deployment script for the browser fingerprint fix
# Run this on the production server (AWS EC2)

set -e  # Exit on any error

echo "=================================="
echo "Browser Fingerprint Fix Deployment"
echo "=================================="
echo ""

# Check if we're on the production server
if [ ! -d "/home/ubuntu/CompareAI" ]; then
    echo "⚠️  This script should be run on the production server"
    echo "   Current directory: $(pwd)"
    echo ""
    echo "   To deploy:"
    echo "   1. SSH into your AWS EC2 server"
    echo "   2. cd /home/ubuntu/CompareAI (or wherever the repo is)"
    echo "   3. Run: ./deploy-fingerprint-fix.sh"
    exit 1
fi

cd /home/ubuntu/CompareAI

echo "Step 1: Pulling latest changes from git..."
git pull origin master

echo ""
echo "Step 2: Stopping current services..."
docker compose -f docker-compose.ssl.yml down

echo ""
echo "Step 3: Running database migration..."
# Build the backend image first to ensure we have the latest code
docker compose -f docker-compose.ssl.yml build backend

# Run the migration
docker compose -f docker-compose.ssl.yml run --rm backend python migrate_fingerprint_column.py

echo ""
echo "Step 4: Building and starting services..."
docker compose -f docker-compose.ssl.yml up -d --build

echo ""
echo "Step 5: Verifying deployment..."
sleep 3
docker compose -f docker-compose.ssl.yml ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Please verify the fix by:"
echo "1. Opening https://compareintel.com"
echo "2. Selecting 1-2 models"
echo "3. Entering a prompt and clicking Compare"
echo "4. Verifying the comparison completes without a 500 error"
echo ""
echo "To view logs:"
echo "  docker compose -f docker-compose.ssl.yml logs -f backend"
echo ""

