"""
Migration script to add AppSettings table for global application settings.

Run this once to add the app_settings table to your database.
This allows admins to control global settings like anonymous mock mode.
"""

import sqlite3
import os
import sys
from pathlib import Path

# Determine the correct database path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)

# Check for database files in different locations
# Database is now stored in backend/data/ directory for clean project structure
db_paths = [
    os.path.join(current_dir, "data", "compareintel.db"),  # New location: backend/data/
    os.path.join(current_dir, "compareintel.db"),  # Old location: backend/ (for migration)
    os.path.join(backend_dir, "backend", "data", "compareintel.db"),
    os.path.join(os.getcwd(), "backend", "data", "compareintel.db"),
    os.path.join(os.getcwd(), "backend", "compareintel.db"),  # Old location fallback
    "compareintel.db",
    os.path.join(os.getcwd(), "compareintel.db"),
]

db_path = None
for path in db_paths:
    if os.path.exists(path):
        db_path = path
        break

if not db_path:
    # If no database exists, use the first likely path
    db_path = db_paths[0]
    print(f"No existing database found, will create at: {db_path}")

print(f"Using database: {db_path}")

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if app_settings table already exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='app_settings'
    """)
    
    table_exists = cursor.fetchone() is not None
    
    if table_exists:
        print("✅ app_settings table already exists")
        
        # Check if anonymous_mock_mode_enabled column exists
        cursor.execute("PRAGMA table_info(app_settings)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'anonymous_mock_mode_enabled' not in columns:
            print("Adding anonymous_mock_mode_enabled column...")
            cursor.execute("""
                ALTER TABLE app_settings 
                ADD COLUMN anonymous_mock_mode_enabled BOOLEAN DEFAULT 0
            """)
            print("✅ Added anonymous_mock_mode_enabled column")
        else:
            print("✅ anonymous_mock_mode_enabled column already exists")
    else:
        # Create the app_settings table
        print("Creating app_settings table...")
        cursor.execute("""
            CREATE TABLE app_settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                anonymous_mock_mode_enabled BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert default settings row
        cursor.execute("""
            INSERT INTO app_settings (id, anonymous_mock_mode_enabled) 
            VALUES (1, 0)
        """)
        
        print("✅ Created app_settings table with default settings")
    
    conn.commit()
    print("✅ Migration completed successfully!")
    
except Exception as e:
    print(f"❌ Error during migration: {e}")
    conn.rollback()
    raise
finally:
    conn.close()
