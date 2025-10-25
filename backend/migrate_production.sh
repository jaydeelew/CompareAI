#!/bin/bash
# Production Database Migration Script
# This script helps you migrate your production PostgreSQL database

set -e

echo "🚀 CompareAI Production Database Migration"
echo "=========================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is not set"
    echo "Please set it to your PostgreSQL connection string:"
    echo "export DATABASE_URL='postgresql://username:password@host:port/database'"
    exit 1
fi

echo "📊 Database URL: ${DATABASE_URL}"

# Check if we can connect to the database
echo "🔍 Testing database connection..."
if ! alembic current > /dev/null 2>&1; then
    echo "❌ Error: Cannot connect to database"
    echo "Please check your DATABASE_URL and ensure the database is accessible"
    exit 1
fi

echo "✅ Database connection successful"

# Show current migration status
echo "📋 Current migration status:"
alembic current

# Ask for confirmation
echo ""
echo "⚠️  This will apply database migrations to your production database."
echo "Make sure you have a backup before proceeding!"
echo ""
read -p "Do you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

# Apply migrations
echo "🔄 Applying migrations..."
alembic upgrade head

echo "✅ Migration completed successfully!"
echo ""
echo "📊 Final migration status:"
alembic current

echo ""
echo "🎉 Your production database is now up to date!"
echo "You can now deploy your application with the updated schema."
