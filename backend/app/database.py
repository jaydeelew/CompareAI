"""
Database configuration and session management for CompareAI.

This module sets up SQLAlchemy with PostgreSQL support and provides
database session management for the FastAPI application.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database URL from environment variable
# Format: postgresql://username:password@host:port/database
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./compareintel.db"  # Fallback to SQLite for development
)

# Create SQLAlchemy engine
# For PostgreSQL in production, add connection pooling settings
engine = create_engine(
    DATABASE_URL,
    # Uncomment these for PostgreSQL production settings:
    # pool_size=10,
    # max_overflow=20,
    # pool_pre_ping=True,  # Verify connections before using them
    echo=False  # Set to True for SQL query logging during development
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

