"""Add credits-based system fields

Revision ID: add_credits_system_fields
Revises: 6fcc8e51aa91
Create Date: 2025-01-27 12:00:00.000000

This migration adds fields for the credits-based system:
- User model: credit tracking fields (monthly_credits_allocated, credits_used_this_period, etc.)
- UsageLog model: token and credit tracking fields (input_tokens, output_tokens, credits_used, etc.)
- CreditTransaction model: new table for tracking all credit transactions
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_credits_system_fields'
down_revision = '6fcc8e51aa91'
branch_labels = None
depends_on = None


def upgrade():
    """Add credits-based system fields and tables."""
    
    # Add credit tracking fields to users table
    op.add_column('users', sa.Column('monthly_credits_allocated', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('credits_used_this_period', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('total_credits_used', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('billing_period_start', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('billing_period_end', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('credits_reset_at', sa.DateTime(), nullable=True))
    
    # Add token and credit tracking fields to usage_logs table
    op.add_column('usage_logs', sa.Column('input_tokens', sa.Integer(), nullable=True))
    op.add_column('usage_logs', sa.Column('output_tokens', sa.Integer(), nullable=True))
    op.add_column('usage_logs', sa.Column('total_tokens', sa.Integer(), nullable=True))
    op.add_column('usage_logs', sa.Column('effective_tokens', sa.Integer(), nullable=True))
    op.add_column('usage_logs', sa.Column('credits_used', sa.DECIMAL(10, 4), nullable=True))
    op.add_column('usage_logs', sa.Column('actual_cost', sa.DECIMAL(10, 4), nullable=True))
    
    # Create credit_transactions table
    op.create_table(
        'credit_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('transaction_type', sa.String(length=50), nullable=False),
        sa.Column('credits_amount', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('related_usage_log_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['related_usage_log_id'], ['usage_logs.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_credit_transactions_user_id'), 'credit_transactions', ['user_id'], unique=False)
    op.create_index(op.f('ix_credit_transactions_related_usage_log_id'), 'credit_transactions', ['related_usage_log_id'], unique=False)
    op.create_index(op.f('ix_credit_transactions_created_at'), 'credit_transactions', ['created_at'], unique=False)
    
    # Set default values for existing users based on their tier
    # This will be handled by application logic, but we set defaults here
    op.execute("""
        UPDATE users 
        SET monthly_credits_allocated = CASE
            WHEN subscription_tier = 'anonymous' THEN 50
            WHEN subscription_tier = 'free' THEN 100
            WHEN subscription_tier = 'starter' THEN 1200
            WHEN subscription_tier = 'starter_plus' THEN 2500
            WHEN subscription_tier = 'pro' THEN 5000
            WHEN subscription_tier = 'pro_plus' THEN 10000
            ELSE 0
        END
        WHERE monthly_credits_allocated IS NULL
    """)


def downgrade():
    """Remove credits-based system fields and tables."""
    
    # Drop credit_transactions table
    op.drop_index(op.f('ix_credit_transactions_created_at'), table_name='credit_transactions')
    op.drop_index(op.f('ix_credit_transactions_related_usage_log_id'), table_name='credit_transactions')
    op.drop_index(op.f('ix_credit_transactions_user_id'), table_name='credit_transactions')
    op.drop_table('credit_transactions')
    
    # Remove fields from usage_logs table
    op.drop_column('usage_logs', 'actual_cost')
    op.drop_column('usage_logs', 'credits_used')
    op.drop_column('usage_logs', 'effective_tokens')
    op.drop_column('usage_logs', 'total_tokens')
    op.drop_column('usage_logs', 'output_tokens')
    op.drop_column('usage_logs', 'input_tokens')
    
    # Remove fields from users table
    op.drop_column('users', 'credits_reset_at')
    op.drop_column('users', 'billing_period_end')
    op.drop_column('users', 'billing_period_start')
    op.drop_column('users', 'total_credits_used')
    op.drop_column('users', 'credits_used_this_period')
    op.drop_column('users', 'monthly_credits_allocated')

