#!/bin/bash

# CompareAI Production Deployment Script
# This script handles database migrations, dependency checks, and deployment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/ubuntu/CompareAI"
BACKUP_DIR="/home/ubuntu/backups"
LOG_FILE="/home/ubuntu/compareai-deploy.log"

# Function to log messages
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}" | tee -a "$LOG_FILE"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if service is running
service_running() {
    docker compose -f docker-compose.ssl.yml ps --services --filter "status=running" | grep -q "$1"
}

# Function to backup database
backup_database() {
    log "Creating database backup..."
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    # Find the database file
    DB_FILE=$(find "$PROJECT_DIR" -name "*.db" -type f | head -1)
    
    if [ -z "$DB_FILE" ]; then
        log_warning "No database file found, skipping backup"
        return 0
    fi
    
    BACKUP_FILE="$BACKUP_DIR/compareai-backup-$(date +%Y%m%d-%H%M%S).db"
    cp "$DB_FILE" "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        log_success "Database backed up to: $BACKUP_FILE"
    else
        log_error "Failed to backup database"
        exit 1
    fi
}

# Function to check system requirements
check_system_requirements() {
    log "Checking system requirements..."
    
    # Check if running as root or with sudo
    if [ "$EUID" -eq 0 ]; then
        log_warning "Running as root. Consider using a non-root user with sudo privileges."
    fi
    
    # Check Docker
    if ! command_exists docker; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check available disk space (at least 2GB)
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
    if [ "$AVAILABLE_SPACE" -lt 2097152 ]; then  # 2GB in KB
        log_warning "Low disk space detected. At least 2GB recommended."
    fi
    
    # Check memory (at least 1GB)
    TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
    if [ "$TOTAL_MEM" -lt 1024 ]; then
        log_warning "Low memory detected. At least 1GB RAM recommended."
    fi
    
    log_success "System requirements check completed"
}

# Function to check SSL certificates
check_ssl_certificates() {
    log "Checking SSL certificates..."
    
    if [ ! -d "/etc/letsencrypt/live/compareintel.com" ]; then
        log_error "SSL certificates not found. Please run setup-compareintel-ssl.sh first."
        exit 1
    fi
    
    # Check certificate expiration
    CERT_EXPIRY=$(openssl x509 -in /etc/letsencrypt/live/compareintel.com/fullchain.pem -noout -enddate | cut -d= -f2)
    CERT_EXPIRY_EPOCH=$(date -d "$CERT_EXPIRY" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( (CERT_EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))
    
    if [ "$DAYS_UNTIL_EXPIRY" -lt 30 ]; then
        log_warning "SSL certificate expires in $DAYS_UNTIL_EXPIRY days. Consider renewing."
    else
        log_success "SSL certificate is valid for $DAYS_UNTIL_EXPIRY more days"
    fi
}

# Function to apply database migrations
apply_database_migrations() {
    log "Applying database migrations..."
    
    # Check if we need to apply the admin_action_logs migration
    DB_FILE=$(find "$PROJECT_DIR" -name "*.db" -type f | head -1)
    
    if [ -z "$DB_FILE" ]; then
        log_warning "No database file found, skipping migrations"
        return 0
    fi
    
    # Check if the migration is needed
    ADMIN_USER_ID_NULLABLE=$(sqlite3 "$DB_FILE" "PRAGMA table_info(admin_action_logs);" | grep "admin_user_id" | grep -c "NOT NULL" || true)
    
    if [ "$ADMIN_USER_ID_NULLABLE" -gt 0 ]; then
        log "Applying admin_action_logs migration..."
        
        # Create backup before migration
        backup_database
        
        # Apply the migration
        sqlite3 "$DB_FILE" <<EOF
-- Create new table with nullable admin_user_id
CREATE TABLE admin_action_logs_new (
    id INTEGER NOT NULL, 
    admin_user_id INTEGER, 
    target_user_id INTEGER, 
    action_type VARCHAR(100) NOT NULL, 
    action_description TEXT NOT NULL, 
    details TEXT, 
    ip_address VARCHAR(45), 
    user_agent TEXT, 
    created_at DATETIME, 
    PRIMARY KEY (id), 
    FOREIGN KEY(admin_user_id) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(target_user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Copy data from old table
INSERT INTO admin_action_logs_new SELECT * FROM admin_action_logs;

-- Drop old table and rename new one
DROP TABLE admin_action_logs;
ALTER TABLE admin_action_logs_new RENAME TO admin_action_logs;

-- Recreate indexes
CREATE INDEX ix_admin_action_logs_admin_user_id ON admin_action_logs (admin_user_id);
CREATE INDEX ix_admin_action_logs_created_at ON admin_action_logs (created_at);
CREATE INDEX ix_admin_action_logs_target_user_id ON admin_action_logs (target_user_id);
CREATE INDEX ix_admin_action_logs_id ON admin_action_logs (id);
EOF
        
        if [ $? -eq 0 ]; then
            log_success "Database migration applied successfully"
        else
            log_error "Database migration failed"
            exit 1
        fi
    else
        log_success "Database migration not needed (already applied)"
    fi
}

# Function to pull latest code
pull_latest_code() {
    log "Pulling latest code from repository..."
    
    cd "$PROJECT_DIR"
    
    # Check if we're in a git repository
    if [ ! -d ".git" ]; then
        log_error "Not in a git repository. Please ensure you're in the CompareAI project directory."
        exit 1
    fi
    
    # Pull latest changes
    git fetch origin
    git pull origin master
    
    if [ $? -eq 0 ]; then
        log_success "Code updated successfully"
    else
        log_error "Failed to pull latest code"
        exit 1
    fi
}

# Function to build and deploy
build_and_deploy() {
    log "Building and deploying application..."
    
    cd "$PROJECT_DIR"
    
    # Stop existing services
    log "Stopping existing services..."
    docker compose -f docker-compose.ssl.yml down
    
    # Clean up old images to free space
    log "Cleaning up old Docker images..."
    docker image prune -f
    
    # Build and start services
    log "Building and starting services..."
    docker compose -f docker-compose.ssl.yml up -d --build
    
    if [ $? -eq 0 ]; then
        log_success "Services started successfully"
    else
        log_error "Failed to start services"
        exit 1
    fi
}

# Function to verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Wait for services to start
    sleep 10
    
    # Check if services are running
    if service_running "backend" && service_running "frontend" && service_running "nginx"; then
        log_success "All services are running"
    else
        log_error "Some services failed to start"
        docker compose -f docker-compose.ssl.yml ps
        exit 1
    fi
    
    # Test backend health
    log "Testing backend health..."
    if curl -f -s http://localhost:8000/health >/dev/null; then
        log_success "Backend is healthy"
    else
        log_error "Backend health check failed"
        exit 1
    fi
    
    # Test frontend
    log "Testing frontend..."
    if curl -f -s http://localhost:80 >/dev/null; then
        log_success "Frontend is accessible"
    else
        log_error "Frontend is not accessible"
        exit 1
    fi
    
    # Test HTTPS
    log "Testing HTTPS..."
    if curl -f -s -k https://localhost:443 >/dev/null; then
        log_success "HTTPS is working"
    else
        log_warning "HTTPS test failed (this might be normal if testing locally)"
    fi
}

# Function to show deployment status
show_status() {
    log "Deployment Status:"
    echo ""
    echo "Services:"
    docker compose -f docker-compose.ssl.yml ps
    echo ""
    echo "Recent logs:"
    docker compose -f docker-compose.ssl.yml logs --tail=20
    echo ""
    echo "Disk usage:"
    df -h /
    echo ""
    echo "Memory usage:"
    free -h
}

# Function to rollback deployment
rollback_deployment() {
    log_warning "Rolling back deployment..."
    
    cd "$PROJECT_DIR"
    
    # Stop current services
    docker compose -f docker-compose.ssl.yml down
    
    # Restore database from backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/compareai-backup-*.db 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        DB_FILE=$(find "$PROJECT_DIR" -name "*.db" -type f | head -1)
        if [ -n "$DB_FILE" ]; then
            cp "$LATEST_BACKUP" "$DB_FILE"
            log_success "Database restored from backup"
        fi
    fi
    
    # Start previous version (if available)
    docker compose -f docker-compose.ssl.yml up -d
    
    log_warning "Rollback completed. Please check the application status."
}

# Main deployment function
main() {
    log "Starting CompareAI Production Deployment..."
    echo "=========================================="
    
    # Parse command line arguments
    case "${1:-deploy}" in
        "check")
            check_system_requirements
            check_ssl_certificates
            log_success "System check completed"
            ;;
        "migrate")
            backup_database
            apply_database_migrations
            log_success "Database migration completed"
            ;;
        "deploy")
            check_system_requirements
            check_ssl_certificates
            backup_database
            apply_database_migrations
            pull_latest_code
            build_and_deploy
            verify_deployment
            show_status
            log_success "Deployment completed successfully!"
            ;;
        "rollback")
            rollback_deployment
            ;;
        "status")
            show_status
            ;;
        *)
            echo "Usage: $0 {check|migrate|deploy|rollback|status}"
            echo ""
            echo "Commands:"
            echo "  check    - Check system requirements and SSL certificates"
            echo "  migrate  - Apply database migrations only"
            echo "  deploy   - Full deployment (default)"
            echo "  rollback - Rollback to previous version"
            echo "  status   - Show current deployment status"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
