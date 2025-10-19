#!/usr/bin/env python3
"""
Database migration script to add admin features to existing CompareAI database.

This script adds:
- Admin role fields to User model
- AdminActionLog table for audit trails
- Updates existing users with default values

Run this script after updating the models but before starting the application.
"""

import os
import sys
import sqlite3
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
from app.models import User, AdminActionLog
from sqlalchemy import text, inspect


def get_database_url():
    """Get database URL from environment or default to SQLite."""
    return os.getenv("DATABASE_URL", "sqlite:///./compareintel.db")


def is_sqlite():
    """Check if we're using SQLite database."""
    db_url = get_database_url()
    return db_url.startswith("sqlite")


def migrate_sqlite():
    """Migrate SQLite database."""
    db_url = get_database_url()
    db_path = db_url.replace("sqlite:///", "")

    print(f"Migrating SQLite database: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if admin columns already exist
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]

        # Add admin role columns if they don't exist
        if "role" not in columns:
            print("Adding 'role' column to users table...")
            cursor.execute("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user'")

        if "is_admin" not in columns:
            print("Adding 'is_admin' column to users table...")
            cursor.execute("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0")

        if "admin_permissions" not in columns:
            print("Adding 'admin_permissions' column to users table...")
            cursor.execute("ALTER TABLE users ADD COLUMN admin_permissions TEXT")

        # Create admin_action_logs table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_action_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_user_id INTEGER NOT NULL,
                target_user_id INTEGER,
                action_type VARCHAR(100) NOT NULL,
                action_description TEXT NOT NULL,
                details TEXT,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_user_id) REFERENCES users (id),
                FOREIGN KEY (target_user_id) REFERENCES users (id)
            )
        """
        )

        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_user_id ON admin_action_logs(admin_user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_admin_action_logs_target_user_id ON admin_action_logs(target_user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at ON admin_action_logs(created_at)")

        conn.commit()
        print("SQLite migration completed successfully!")

    except Exception as e:
        print(f"Error during SQLite migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


def migrate_postgresql():
    """Migrate PostgreSQL database."""
    print("Migrating PostgreSQL database...")

    with engine.connect() as conn:
        try:
            # Start transaction
            trans = conn.begin()

            # Check if admin columns exist
            inspector = inspect(engine)
            columns = [col["name"] for col in inspector.get_columns("users")]

            # Add admin role columns if they don't exist
            if "role" not in columns:
                print("Adding 'role' column to users table...")
                conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user'"))

            if "is_admin" not in columns:
                print("Adding 'is_admin' column to users table...")
                conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE"))

            if "admin_permissions" not in columns:
                print("Adding 'admin_permissions' column to users table...")
                conn.execute(text("ALTER TABLE users ADD COLUMN admin_permissions TEXT"))

            # Create admin_action_logs table
            conn.execute(
                text(
                    """
                CREATE TABLE IF NOT EXISTS admin_action_logs (
                    id SERIAL PRIMARY KEY,
                    admin_user_id INTEGER NOT NULL,
                    target_user_id INTEGER,
                    action_type VARCHAR(100) NOT NULL,
                    action_description TEXT NOT NULL,
                    details TEXT,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (admin_user_id) REFERENCES users (id),
                    FOREIGN KEY (target_user_id) REFERENCES users (id)
                )
            """
                )
            )

            # Create indexes
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_user_id ON admin_action_logs(admin_user_id)"))
            conn.execute(
                text("CREATE INDEX IF NOT EXISTS idx_admin_action_logs_target_user_id ON admin_action_logs(target_user_id)")
            )
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at ON admin_action_logs(created_at)"))

            trans.commit()
            print("PostgreSQL migration completed successfully!")

        except Exception as e:
            print(f"Error during PostgreSQL migration: {e}")
            trans.rollback()
            raise


def update_existing_users():
    """Update existing users with default admin values."""
    print("Updating existing users with default admin values...")

    with engine.connect() as conn:
        try:
            trans = conn.begin()

            # Update users who don't have role set (should be all existing users)
            if is_sqlite():
                conn.execute(text("UPDATE users SET role = 'user', is_admin = 0 WHERE role IS NULL"))
            else:
                conn.execute(text("UPDATE users SET role = 'user', is_admin = FALSE WHERE role IS NULL"))

            trans.commit()
            print("Existing users updated successfully!")

        except Exception as e:
            print(f"Error updating existing users: {e}")
            trans.rollback()
            raise


def create_super_admin():
    """Create a super admin user if none exists."""
    print("Checking for super admin users...")

    with engine.connect() as conn:
        try:
            # Check if any super admin exists
            result = conn.execute(text("SELECT COUNT(*) FROM users WHERE role = 'super_admin'"))
            super_admin_count = result.scalar()

            if super_admin_count == 0:
                print("No super admin found. You can create one manually:")
                print("1. Register a normal user account")
                print("2. Update the user in the database:")
                print("   UPDATE users SET role = 'super_admin', is_admin = TRUE WHERE email = 'your_email@example.com';")
                print("3. Or use the admin API after creating the first admin user")
            else:
                print(f"Found {super_admin_count} super admin user(s)")

        except Exception as e:
            print(f"Error checking for super admin: {e}")


def main():
    """Main migration function."""
    print("CompareAI Admin Migration Script")
    print("=" * 40)

    try:
        # Check database type and migrate accordingly
        if is_sqlite():
            migrate_sqlite()
        else:
            migrate_postgresql()

        # Update existing users
        update_existing_users()

        # Check for super admin
        create_super_admin()

        print("\nMigration completed successfully!")
        print("\nNext steps:")
        print("1. Restart your application")
        print("2. Create your first admin user:")
        print("   - Register normally, then update role in database")
        print("   - Or use the admin API endpoints")
        print("3. Access admin features at /admin/* endpoints")

    except Exception as e:
        print(f"\nMigration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
