#!/bin/bash

# Self-Signed Certificate Setup for Development
# This creates self-signed certificates for local development

set -e

echo "🔒 Creating self-signed SSL certificates for development..."

# Create certificates directory
mkdir -p ./nginx/ssl

# Generate private key
openssl genrsa -out ./nginx/ssl/server.key 2048

# Generate certificate signing request
openssl req -new -key ./nginx/ssl/server.key -out ./nginx/ssl/server.csr -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Generate self-signed certificate
openssl x509 -req -days 365 -in ./nginx/ssl/server.csr -signkey ./nginx/ssl/server.key -out ./nginx/ssl/server.crt

# Clean up CSR file
rm ./nginx/ssl/server.csr

echo "✅ Self-signed certificates created in ./nginx/ssl/"
echo ""
echo "⚠️  Note: These are self-signed certificates for development only."
echo "   Browsers will show a security warning that you'll need to accept."
echo ""
echo "To use these certificates:"
echo "1. Run: docker-compose -f docker-compose.dev-ssl.yml up -d"
echo "2. Visit: https://localhost (accept the browser warning)"
