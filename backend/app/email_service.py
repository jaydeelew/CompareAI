"""
Email service for sending verification and notification emails.

This module handles all email communications including verification,
password resets, and subscription notifications.
"""

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr
import os
from typing import List

# Email configuration from environment variables
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME", ""),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", ""),
    MAIL_FROM=os.getenv("MAIL_FROM", "noreply@compareintel.com"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", "587")),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.sendgrid.net"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

# Initialize FastMail
fm = FastMail(conf)


async def send_verification_email(email: EmailStr, token: str):
    """
    Send email verification link to user.
    
    Args:
        email: User's email address
        token: Verification token
    """
    # Skip sending email if not configured (development mode)
    if not os.getenv("MAIL_USERNAME") or not os.getenv("MAIL_PASSWORD"):
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
        verification_url = f"{frontend_url}/verify-email?token={token}"
        print(f"Email service not configured - skipping verification email for {email}")
        print(f"Verification token: {token}")
        print(f"Verification URL: {verification_url}")
        return
    
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    verification_url = f"{frontend_url}/verify-email?token={token}"
    
    html = f"""
    <html>
      <head>
        <style>
          body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }}
          .container {{
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }}
          .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }}
          .content {{
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }}
          .button {{
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }}
          .footer {{
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to CompareIntel!</h1>
          </div>
          <div class="content">
            <p>Thank you for registering with CompareIntel, the AI model comparison platform.</p>
            <p>To complete your registration and start comparing AI models, please verify your email address by clicking the button below:</p>
            <div style="text-align: center;">
              <a href="{verification_url}" class="button">Verify Email Address</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">{verification_url}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account with CompareIntel, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 CompareIntel. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Verify Your CompareIntel Account",
        recipients=[email],
        body=html,
        subtype="html"
    )
    
    try:
        await fm.send_message(message)
    except Exception as e:
        print(f"Failed to send verification email to {email}: {str(e)}")
        # In production, you might want to log this or use a monitoring service
        raise


async def send_password_reset_email(email: EmailStr, token: str):
    """
    Send password reset link to user.
    
    Args:
        email: User's email address
        token: Password reset token
    """
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    reset_url = f"{frontend_url}/reset-password?token={token}"
    
    html = f"""
    <html>
      <head>
        <style>
          body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }}
          .container {{
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }}
          .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }}
          .content {{
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }}
          .button {{
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }}
          .footer {{
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }}
          .warning {{
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 12px;
            border-radius: 6px;
            margin: 15px 0;
          }}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>You requested to reset your password for your CompareIntel account.</p>
            <p>Click the button below to create a new password:</p>
            <div style="text-align: center;">
              <a href="{reset_url}" class="button">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">{reset_url}</p>
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour.
            </div>
            <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 CompareIntel. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Reset Your CompareIntel Password",
        recipients=[email],
        body=html,
        subtype="html"
    )
    
    try:
        await fm.send_message(message)
    except Exception as e:
        print(f"Failed to send password reset email to {email}: {str(e)}")
        raise


async def send_subscription_confirmation_email(email: EmailStr, tier: str, period: str, amount: float):
    """
    Send subscription confirmation email.
    
    Args:
        email: User's email address
        tier: Subscription tier (starter, pro)
        period: Subscription period (monthly, yearly)
        amount: Amount paid
    """
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    dashboard_url = f"{frontend_url}/dashboard"
    
    tier_display = tier.replace('_', ' ').title()
    period_display = "Monthly" if period == "monthly" else "Yearly"
    
    # Get tier benefits
    benefits = {
        "starter": [
            "25 daily comparisons",
            "All models access",
            "Email support",
            "Usage analytics",
            "1 month conversation history"
        ],
        "pro": [
            "50 daily comparisons",
            "Priority processing",
            "Email support",
            "Usage analytics",
            "Export conversations",
            "3 months conversation history"
        ],
    }
    
    benefits_html = "".join([f"<li>{benefit}</li>" for benefit in benefits.get(tier, [])])
    
    html = f"""
    <html>
      <head>
        <style>
          body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }}
          .container {{
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }}
          .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }}
          .content {{
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }}
          .button {{
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }}
          .subscription-box {{
            background: white;
            border: 2px solid #667eea;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }}
          .benefits {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }}
          .benefits ul {{
            list-style: none;
            padding: 0;
          }}
          .benefits li {{
            padding: 8px 0;
            padding-left: 25px;
            position: relative;
          }}
          .benefits li:before {{
            content: "✓";
            position: absolute;
            left: 0;
            color: #667eea;
            font-weight: bold;
          }}
          .footer {{
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Subscription Confirmed!</h1>
          </div>
          <div class="content">
            <p>Thank you for upgrading to CompareIntel <strong>{tier_display}</strong>!</p>
            
            <div class="subscription-box">
              <h3 style="margin-top: 0;">Subscription Details</h3>
              <p><strong>Plan:</strong> {tier_display}</p>
              <p><strong>Billing:</strong> {period_display}</p>
              <p><strong>Amount:</strong> ${amount:.2f}</p>
            </div>
            
            <div class="benefits">
              <h3>Your {tier_display} Benefits</h3>
              <ul>
                {benefits_html}
              </ul>
            </div>
            
            <p>Your subscription is now active and you have full access to all {tier_display} features.</p>
            
            <div style="text-align: center;">
              <a href="{dashboard_url}" class="button">Go to Dashboard</a>
            </div>
            
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              You can manage your subscription and billing from your account dashboard at any time.
            </p>
          </div>
          <div class="footer">
            <p>&copy; 2025 CompareIntel. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
    """
    
    message = MessageSchema(
        subject=f"Subscription Confirmed - CompareIntel {tier_display}",
        recipients=[email],
        body=html,
        subtype="html"
    )
    
    try:
        await fm.send_message(message)
    except Exception as e:
        print(f"Failed to send subscription confirmation email to {email}: {str(e)}")
        # Don't raise exception here - subscription is already confirmed
        pass


async def send_usage_limit_warning_email(email: EmailStr, usage_count: int, daily_limit: int, tier: str):
    """
    Send warning email when user is approaching their daily limit.
    
    Args:
        email: User's email address
        usage_count: Current usage count
        daily_limit: Daily limit for their tier
        tier: Current subscription tier
    """
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    upgrade_url = f"{frontend_url}/subscription"
    
    percentage_used = (usage_count / daily_limit) * 100
    
    html = f"""
    <html>
      <head>
        <style>
          body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }}
          .container {{
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }}
          .header {{
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }}
          .content {{
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }}
          .button {{
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }}
          .usage-bar {{
            background: #e0e0e0;
            border-radius: 10px;
            height: 30px;
            position: relative;
            margin: 20px 0;
          }}
          .usage-fill {{
            background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
            height: 100%;
            border-radius: 10px;
            width: {percentage_used}%;
          }}
          .footer {{
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Usage Limit Warning</h1>
          </div>
          <div class="content">
            <p>You've used <strong>{usage_count}</strong> out of <strong>{daily_limit}</strong> daily comparisons ({percentage_used:.0f}%).</p>
            
            <div class="usage-bar">
              <div class="usage-fill"></div>
            </div>
            
            <p>You're approaching your daily limit. To continue using CompareIntel without interruption, consider upgrading your plan.</p>
            
            {'''
            <div style="text-align: center;">
              <a href="''' + upgrade_url + '''" class="button">Upgrade Your Plan</a>
            </div>
            '''}
            
            <p style="margin-top: 20px; color: #666; font-size: 14px;">
              Your daily limit resets at midnight UTC.
            </p>
          </div>
          <div class="footer">
            <p>&copy; 2025 CompareIntel. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
    """
    
    message = MessageSchema(
        subject="CompareIntel Usage Warning",
        recipients=[email],
        body=html,
        subtype="html"
    )
    
    try:
        await fm.send_message(message)
    except Exception as e:
        print(f"Failed to send usage warning email to {email}: {str(e)}")
        # Don't raise exception - this is just a notification
        pass

