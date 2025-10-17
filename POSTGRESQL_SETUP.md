# PostgreSQL Setup Guide for EC2 Production

This guide walks you through setting up PostgreSQL on your EC2 instance for production use.

## Step 1: Install PostgreSQL on EC2

SSH into your EC2 server:

```bash
ssh your-ec2-server
```

Install PostgreSQL:

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Check if it's running
sudo systemctl status postgresql

# Enable it to start on boot
sudo systemctl enable postgresql
```

## Step 2: Create Database and User

Switch to the postgres user and open PostgreSQL:

```bash
sudo -u postgres psql
```

In the PostgreSQL prompt (`postgres=#`), run these commands:

```sql
-- Create the database
CREATE DATABASE compareintel;

-- Create a user with a strong password
-- IMPORTANT: Change 'YOUR_SECURE_PASSWORD_HERE' to a real strong password!
CREATE USER compareintel_user WITH PASSWORD 'YOUR_SECURE_PASSWORD_HERE';

-- Grant privileges on the database
GRANT ALL PRIVILEGES ON DATABASE compareintel TO compareintel_user;

-- Connect to the database to set schema permissions
\c compareintel

-- Grant schema privileges (required for PostgreSQL 15+)
GRANT ALL ON SCHEMA public TO compareintel_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO compareintel_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO compareintel_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO compareintel_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO compareintel_user;

-- Verify the setup
\l  -- List all databases (you should see compareintel)
\du -- List all users (you should see compareintel_user)

-- Exit PostgreSQL
\q
```

## Step 3: Configure PostgreSQL for Local Connections

By default, PostgreSQL only accepts connections from localhost, which is perfect for our setup.

Verify the configuration:

```bash
# Check if PostgreSQL is listening on localhost
sudo netstat -tulpn | grep 5432
```

You should see PostgreSQL listening on `127.0.0.1:5432`.

## Step 4: Update Backend Environment Variables

Edit your backend `.env` file on EC2:

```bash
cd ~/CompareAI/backend
nano .env
```

Add or update the `DATABASE_URL` to use PostgreSQL:

```bash
# Database Configuration
DATABASE_URL=postgresql://compareintel_user:YOUR_SECURE_PASSWORD_HERE@localhost:5432/compareintel

# Other existing variables...
SECRET_KEY=your_production_secret_key
MAIL_USERNAME=apikey
MAIL_PASSWORD=SG.your_sendgrid_api_key
MAIL_FROM=noreply@compareintel.com
FRONTEND_URL=https://compareintel.com
```

**Important:** Replace `YOUR_SECURE_PASSWORD_HERE` with the actual password you created in Step 2!

## Step 5: Rebuild and Restart Backend

```bash
cd ~/CompareAI

# Pull latest code changes
git pull

# Stop containers
docker compose -f docker-compose.ssl.yml down

# Rebuild and start
docker compose -f docker-compose.ssl.yml up -d --build

# Watch logs to verify successful startup
docker compose -f docker-compose.ssl.yml logs -f backend
```

Look for these success messages:
```
Database tables initialized successfully
[INFO] Application startup complete.
```

## Step 6: Verify Database Connection

Check that tables were created:

```bash
sudo -u postgres psql -d compareintel -c "\dt"
```

You should see tables like: `users`, `conversations`, `conversation_messages`

## Troubleshooting

### Connection Refused Error

If you see "connection refused":

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Authentication Failed Error

If you see "password authentication failed":

1. Double-check your password in the `.env` file
2. Reset the user password:

```bash
sudo -u postgres psql -c "ALTER USER compareintel_user WITH PASSWORD 'new_password';"
```

### Permission Denied Errors

If you see "permission denied for schema public":

```bash
sudo -u postgres psql -d compareintel
```

Then run:

```sql
GRANT ALL ON SCHEMA public TO compareintel_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO compareintel_user;
```

## Backup and Maintenance

### Create a Backup

```bash
sudo -u postgres pg_dump compareintel > compareintel_backup_$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
sudo -u postgres psql compareintel < compareintel_backup_20251017.sql
```

### View Database Size

```bash
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('compareintel'));"
```

## Migration to AWS RDS (Future)

When you're ready to migrate to AWS RDS:

1. Create an RDS PostgreSQL instance in AWS
2. Export your data: `pg_dump compareintel > export.sql`
3. Import to RDS: `psql -h your-rds-endpoint.amazonaws.com -U admin -d compareintel < export.sql`
4. Update `DATABASE_URL` in `.env` to point to RDS endpoint
5. Restart backend containers

## Benefits of PostgreSQL vs SQLite

✅ Handles concurrent connections properly (no race conditions)  
✅ Better performance with multiple Gunicorn workers  
✅ ACID compliance for data integrity  
✅ Better for production workloads  
✅ Easy to migrate to AWS RDS later  
✅ Supports advanced features (indexes, full-text search, etc.)

## Security Notes

- PostgreSQL user password should be strong and unique
- Database is only accessible from localhost (secure by default)
- Regularly backup your database
- Consider encrypting backups before storing them
- When migrating to RDS, use SSL/TLS for connections

