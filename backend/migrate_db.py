"""
Database migration script to add overage tracking columns
"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'compareintel.db')

print(f"Migrating database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if columns exist
cursor.execute("PRAGMA table_info(users)")
columns = [col[1] for col in cursor.fetchall()]

migrations_applied = []

# Add monthly_overage_count if it doesn't exist
if 'monthly_overage_count' not in columns:
    print("Adding monthly_overage_count column...")
    cursor.execute("ALTER TABLE users ADD COLUMN monthly_overage_count INTEGER DEFAULT 0")
    migrations_applied.append("monthly_overage_count")

# Add overage_reset_date if it doesn't exist
if 'overage_reset_date' not in columns:
    print("Adding overage_reset_date column...")
    cursor.execute("ALTER TABLE users ADD COLUMN overage_reset_date DATE DEFAULT (date('now'))")
    migrations_applied.append("overage_reset_date")

# Check usage_logs table
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='usage_logs'")
if cursor.fetchone():
    cursor.execute("PRAGMA table_info(usage_logs)")
    usage_columns = [col[1] for col in cursor.fetchall()]
    
    # Add is_overage if it doesn't exist
    if 'is_overage' not in usage_columns:
        print("Adding is_overage column to usage_logs...")
        cursor.execute("ALTER TABLE usage_logs ADD COLUMN is_overage BOOLEAN DEFAULT 0")
        migrations_applied.append("usage_logs.is_overage")
    
    # Add overage_charge if it doesn't exist
    if 'overage_charge' not in usage_columns:
        print("Adding overage_charge column to usage_logs...")
        cursor.execute("ALTER TABLE usage_logs ADD COLUMN overage_charge DECIMAL(10, 4) DEFAULT 0")
        migrations_applied.append("usage_logs.overage_charge")

conn.commit()
conn.close()

if migrations_applied:
    print(f"\n✅ Migration complete! Applied: {', '.join(migrations_applied)}")
else:
    print("\n✅ Database is up to date. No migrations needed.")

