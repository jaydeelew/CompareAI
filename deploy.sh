#!/bin/bash

echo "🚀 Starting SSL deployment..."

# Check if SSL certificates exist
if [ -d "/etc/letsencrypt/live/compareintel.com" ]; then
    echo "🔒 SSL certificates found - deploying with HTTPS"
    COMPOSE_FILE="docker-compose.ssl.yml"
else
    echo "⚠️  SSL certificates not found - deploying with HTTP"
    echo "   Run './setup-compareintel-ssl.sh' to set up SSL certificates"
    COMPOSE_FILE="docker-compose.prod.yml"
fi

# Build and start the production containers
echo "🐳 Building and starting production containers..."
docker compose -f $COMPOSE_FILE down
docker compose -f $COMPOSE_FILE build --no-cache
docker compose -f $COMPOSE_FILE up -d

echo "✅ Deployment complete!"
echo "📊 Container status:"
docker compose -f $COMPOSE_FILE ps

echo ""
if [ "$COMPOSE_FILE" = "docker-compose.ssl.yml" ]; then
    echo "🌐 Your secure website is available at: https://compareintel.com"
    echo "🔒 SSL/HTTPS enabled with Let's Encrypt certificates"
else
    echo "🌐 Your website is available at: http://compareintel.com"
    echo "⚠️  Consider setting up SSL with: ./setup-compareintel-ssl.sh"
fi
echo "   Each build generates new hash-based filenames for JS/CSS files"
echo "   HTML files are never cached, ensuring immediate updates"
