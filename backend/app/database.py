"""
Database configuration and session management for CompareAI.

This module sets up SQLAlchemy with PostgreSQL support and provides
database session management for the FastAPI application.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from pathlib import Path

# Import configuration
from .config import settings

# Database URL from configuration
# Format: postgresql://username:password@host:port/database
# Handle both running from project root and backend directory

# Determine the correct database path for SQLite fallback
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
project_root = os.path.dirname(backend_dir)

# Determine working directory to choose correct relative path
# Database is now stored in backend/data/ directory for clean project structure
cwd = os.getcwd()
if cwd.endswith(os.sep + "backend") or cwd.endswith("/backend"):
    # Running from backend directory
    default_db_path = "sqlite:///./data/compareintel.db"
else:
    # Running from project root or other location
    default_db_path = "sqlite:///./backend/data/compareintel.db"

# Use database URL from settings, with fallback to default SQLite path
# Only use default if settings still has the old default path
old_default = "sqlite:///./compareintel.db"
DATABASE_URL = settings.database_url if settings.database_url != old_default else default_db_path

# Create SQLAlchemy engine
# For PostgreSQL in production, add connection pooling settings
engine = create_engine(
    DATABASE_URL,
    # Uncomment these for PostgreSQL production settings:
    # pool_size=10,
    # max_overflow=20,
    # pool_pre_ping=True,  # Verify connections before using them
    echo=False,  # Set to True for SQL query logging during development
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all models
Base = declarative_base()


def get_db():
    """
    Dependency function for FastAPI to get database session.

    Usage:
        @app.get("/endpoint")
        def endpoint(db: Session = Depends(get_db)):
            # Use db here
            pass

    Yields:
        Session: Database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database tables.
    This creates all tables defined in models.
    """
    from app import models  # Import models to register them

    Base.metadata.create_all(bind=engine)


def drop_db():
    """
    Drop all database tables.
    WARNING: This will delete all data!
    Only use in development/testing.
    """
    from app import models  # Import models to register them

    Base.metadata.drop_all(bind=engine)
