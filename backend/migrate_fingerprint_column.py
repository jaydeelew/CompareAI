"""
Database migration script to update browser_fingerprint column size.
This script modifies the browser_fingerprint column from VARCHAR(500) to VARCHAR(64)
since we now store SHA-256 hashes instead of raw fingerprint data.
"""

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text, inspect
from app.database import DATABASE_URL

print(f"Migrating database: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)

# Determine database type
is_sqlite = "sqlite" in DATABASE_URL.lower()
is_postgres = "postgresql" in DATABASE_URL.lower()

with engine.connect() as conn:
    # Check if usage_logs table exists
    inspector = inspect(engine)
    if "usage_logs" not in inspector.get_table_names():
        print("Table 'usage_logs' does not exist. No migration needed.")
        sys.exit(0)

    # Check if browser_fingerprint column exists
    columns = {col["name"]: col for col in inspector.get_columns("usage_logs")}

    if "browser_fingerprint" not in columns:
        print("Column 'browser_fingerprint' does not exist. No migration needed.")
        sys.exit(0)

    print("Column 'browser_fingerprint' found. Checking size...")

    try:
        if is_sqlite:
            # SQLite doesn't support ALTER COLUMN, so we need to recreate the table
            # However, since SQLite doesn't enforce VARCHAR length, we can skip this
            print("SQLite detected: VARCHAR length is not enforced, no migration needed.")
            print("Note: The app code now generates SHA-256 hashes (64 chars) instead of full fingerprints.")

        elif is_postgres:
            # PostgreSQL supports ALTER COLUMN
            print("PostgreSQL detected: Updating column type...")
            conn.execute(
                text(
                    """
                ALTER TABLE usage_logs 
                ALTER COLUMN browser_fingerprint TYPE VARCHAR(64)
            """
                )
            )
            conn.commit()
            print("✓ Successfully updated browser_fingerprint column to VARCHAR(64)")

        else:
            print("Unknown database type. Please manually alter the browser_fingerprint column to VARCHAR(64).")
            sys.exit(1)

    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        sys.exit(1)

print("\nMigration completed successfully!")
print("The browser_fingerprint column is now configured for SHA-256 hashes (64 characters).")
