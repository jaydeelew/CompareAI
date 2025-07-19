#!/bin/bash

echo "🚀 Starting deployment..."

# Build and start the production containers (frontend build happens inside Docker)
echo "🐳 Building and starting production containers..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

echo "✅ Deployment complete!"
echo "📊 Container status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "🌐 Your website should now be available with cache-busted assets!"
echo "   Each build will generate new hash-based filenames for JS/CSS files"
echo "   HTML files will never be cached, ensuring immediate updates"
