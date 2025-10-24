"""
Migration script to add mock_mode_enabled field to users table.

This field allows admins and super-admins to use mock model responses
for testing without making actual API calls to OpenRouter.
"""

import sys
from sqlalchemy import create_engine, text, Boolean, Column
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database URL
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ Error: DATABASE_URL not found in environment variables")
    sys.exit(1)

print(f"🔗 Connecting to database...")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)


def migrate():
    """Add mock_mode_enabled field to users table."""
    session = Session()
    
    try:
        # Check if column already exists (works for both SQLite and PostgreSQL)
        # For SQLite, we use PRAGMA table_info
        # For PostgreSQL, we use information_schema
        try:
            # Try SQLite approach first
            result = session.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'mock_mode_enabled' in columns:
                print("✅ mock_mode_enabled column already exists, skipping migration")
                return
        except Exception:
            # Try PostgreSQL approach
            result = session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='mock_mode_enabled'
            """))
            
            if result.fetchone():
                print("✅ mock_mode_enabled column already exists, skipping migration")
                return
        
        print("📝 Adding mock_mode_enabled column to users table...")
        
        # Add the new column (works for both SQLite and PostgreSQL)
        session.execute(text("""
            ALTER TABLE users 
            ADD COLUMN mock_mode_enabled BOOLEAN DEFAULT 0
        """))
        
        session.commit()
        print("✅ Successfully added mock_mode_enabled column")
        
        # Verify the migration (works for both databases)
        try:
            # Try a simple query to verify
            result = session.execute(text("SELECT mock_mode_enabled FROM users LIMIT 1"))
            result.fetchone()
            print(f"✅ Verified: mock_mode_enabled column added successfully")
        except Exception:
            print("⚠️  Warning: Could not verify column, but it may have been added successfully")
        
        print("\n🎉 Migration completed successfully!")
        print("ℹ️  Mock mode can now be enabled for admin and super-admin users via the admin panel")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Error during migration: {str(e)}")
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    print("=" * 60)
    print("CompareAI - Mock Mode Migration")
    print("=" * 60)
    print()
    
    migrate()

