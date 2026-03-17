"""
Email Service
Send transactional emails for invites, verification, etc.
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails"""

    @staticmethod
    def _send_email(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None):
        """
        Send an email using SMTP

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text fallback (optional)
        """
        # Check if SMTP is configured
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning(f"SMTP not configured. Email would be sent to {to_email}: {subject}")
            logger.info(f"Email body:\n{html_body}")
            return

        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.EMAIL_FROM
            msg["To"] = to_email

            # Add text and HTML parts
            if text_body:
                msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            # Send email
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

            logger.info(f"Email sent successfully to {to_email}")

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            raise

    @staticmethod
    def send_verification_email(to_email: str, verification_token: str, tenant_name: Optional[str] = None):
        """
        Send email verification link

        Args:
            to_email: User's email address
            verification_token: Verification token
            tenant_name: Name of tenant being created (optional)
        """
        verify_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={verification_token}"

        subject = "Verify your email - Evols"

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #4F46E5;">Welcome to Evols!</h2>

                <p>Thank you for signing up{f" to create <strong>{tenant_name}</strong>" if tenant_name else ""}.</p>

                <p>Please verify your email address by clicking the button below:</p>

                <div style="margin: 30px 0;">
                    <a href="{verify_url}"
                       style="background-color: #4F46E5; color: white; padding: 12px 30px;
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Verify Email Address
                    </a>
                </div>

                <p style="color: #666; font-size: 14px;">
                    Or copy and paste this link into your browser:<br>
                    <a href="{verify_url}">{verify_url}</a>
                </p>

                <p style="color: #666; font-size: 14px;">
                    This link will expire in 24 hours.
                </p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

                <p style="color: #999; font-size: 12px;">
                    If you didn't create an account, you can safely ignore this email.
                </p>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        Welcome to Evols!

        Thank you for signing up{f" to create {tenant_name}" if tenant_name else ""}.

        Please verify your email address by visiting:
        {verify_url}

        This link will expire in 24 hours.

        If you didn't create an account, you can safely ignore this email.
        """

        EmailService._send_email(to_email, subject, html_body, text_body)

    @staticmethod
    def send_invite_email(
        to_email: str,
        tenant_name: str,
        inviter_name: str,
        invite_token: str,
        role: str,
        message: Optional[str] = None
    ):
        """
        Send tenant invitation email

        Args:
            to_email: Invitee's email address
            tenant_name: Name of the tenant
            inviter_name: Name of person who sent invite
            invite_token: Invite token
            role: Role being invited as (USER or TENANT_ADMIN)
            message: Optional personal message from inviter
        """
        invite_url = f"{settings.FRONTEND_URL}/auth/register?invite={invite_token}"

        role_display = "Administrator" if role == "TENANT_ADMIN" else "Member"
        subject = f"{inviter_name} invited you to join {tenant_name} on Evols"

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #4F46E5;">You've been invited to {tenant_name}</h2>

                <p><strong>{inviter_name}</strong> has invited you to join <strong>{tenant_name}</strong>
                   as a <strong>{role_display}</strong> on Evols.</p>

                {f'<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;"><p style="margin: 0; font-style: italic;">"{message}"</p></div>' if message else ''}

                <p>Click the button below to accept the invitation:</p>

                <div style="margin: 30px 0;">
                    <a href="{invite_url}"
                       style="background-color: #4F46E5; color: white; padding: 12px 30px;
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Accept Invitation
                    </a>
                </div>

                <p style="color: #666; font-size: 14px;">
                    Or copy and paste this link into your browser:<br>
                    <a href="{invite_url}">{invite_url}</a>
                </p>

                <p style="color: #666; font-size: 14px;">
                    This invitation will expire in 7 days.
                </p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

                <p style="color: #999; font-size: 12px;">
                    If you weren't expecting this invitation, you can safely ignore this email.
                </p>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        You've been invited to {tenant_name}

        {inviter_name} has invited you to join {tenant_name} as a {role_display} on Evols.

        {f'Personal message: "{message}"' if message else ''}

        Click here to accept the invitation:
        {invite_url}

        This invitation will expire in 7 days.

        If you weren't expecting this invitation, you can safely ignore this email.
        """

        EmailService._send_email(to_email, subject, html_body, text_body)

    @staticmethod
    def send_welcome_email(to_email: str, tenant_name: str, is_first_user: bool = False):
        """
        Send welcome email after successful registration

        Args:
            to_email: User's email address
            tenant_name: Name of the tenant
            is_first_user: Whether this is the first user (tenant admin)
        """
        login_url = f"{settings.FRONTEND_URL}/auth/login"

        subject = f"Welcome to {tenant_name} on Evols!"

        role_text = "administrator" if is_first_user else "member"
        setup_text = """
        <h3>Getting Started</h3>
        <ul>
            <li>Upload your customer feedback and data</li>
            <li>Create AI Skills to assist with common PM tasks</li>
            <li>Generate personas from your customer data</li>
            <li>Invite your team members</li>
        </ul>
        """ if is_first_user else """
        <p>Your team administrator can help you get started with Evols.</p>
        """

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #4F46E5;">Welcome to Evols!</h2>

                <p>Your account has been created successfully as a {role_text} of <strong>{tenant_name}</strong>.</p>

                {setup_text}

                <div style="margin: 30px 0;">
                    <a href="{login_url}"
                       style="background-color: #4F46E5; color: white; padding: 12px 30px;
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Go to Dashboard
                    </a>
                </div>

                <p style="color: #666; font-size: 14px;">
                    Need help? Check out our documentation or contact support.
                </p>
            </div>
        </body>
        </html>
        """

        EmailService._send_email(to_email, subject, html_body)
