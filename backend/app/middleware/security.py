"""
Security middleware for adding security headers and CSP.
Provides defense-in-depth against various web security vulnerabilities.
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.

    Adds headers to protect against:
    - XSS attacks
    - Clickjacking
    - MIME type sniffing
    - Content type injection
    - Information disclosure
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Content Security Policy (CSP) - Strict policy to prevent XSS
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  # Needed for Next.js development
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",  # Needed for styled-components, Tailwind and Google Fonts
            "img-src 'self' data: blob:",  # Allow data URIs for images
            "font-src 'self' data: https://fonts.gstatic.com", # Allow Google Fonts
            "connect-src 'self' ws: wss:",  # WebSocket connections for dev server
            "media-src 'self'",
            "object-src 'none'",  # Disable plugins
            "frame-src 'none'",   # Prevent embedding in frames
            "base-uri 'self'",    # Restrict base tag
            "form-action 'self'", # Restrict form submissions
            "upgrade-insecure-requests",  # Automatically upgrade HTTP to HTTPS
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

        # X-Content-Type-Options: Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # X-Frame-Options: Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # X-XSS-Protection: Enable built-in XSS protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer-Policy: Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions-Policy: Control browser features
        permissions_policies = [
            "geolocation=()",
            "microphone=()",
            "camera=()",
            "payment=()",
            "accelerometer=()",
            "gyroscope=()",
            "magnetometer=()",
            "usb=()"
        ]
        response.headers["Permissions-Policy"] = ", ".join(permissions_policies)

        # Strict-Transport-Security: Enforce HTTPS (only add in production)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # X-Permitted-Cross-Domain-Policies: Control Adobe Flash cross-domain requests
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

        # Cache-Control for API responses to prevent sensitive data caching
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        # Server header removal (security through obscurity)
        if "server" in response.headers:
            del response.headers["server"]

        return response


class SecurityValidationMiddleware(BaseHTTPMiddleware):
    """
    Additional security validation middleware.
    Performs request-level security checks.
    """

    # Suspicious patterns that might indicate malicious requests
    SUSPICIOUS_PATTERNS = [
        "<script",
        "javascript:",
        "data:text/html",
        "vbscript:",
        "onload=",
        "onerror=",
        "onclick=",
        "eval(",
        "setTimeout(",
        "setInterval(",
        "document.cookie",
        "document.domain",
        "window.location",
        "alert(",
        "confirm(",
        "prompt(",
    ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check request body for suspicious patterns (for POST/PUT requests)
        if request.method in ["POST", "PUT", "PATCH"]:
            # Read request body once and check for suspicious patterns
            try:
                body = await request.body()
                if body:
                    body_str = body.decode('utf-8', errors='ignore')

                    # Check for suspicious patterns
                    for pattern in self.SUSPICIOUS_PATTERNS:
                        if pattern.lower() in body_str.lower():
                            from loguru import logger
                            logger.warning(f"[SECURITY] Suspicious pattern '{pattern}' detected in request to {request.url.path}")
                            # Log but don't block - let application-level validation handle it
                            break
            except Exception:
                # If we can't read the body, continue (might be multipart/form-data or other format)
                pass

        # Check query parameters for suspicious patterns
        if request.url.query:
            query_str = str(request.url.query)
            for pattern in self.SUSPICIOUS_PATTERNS:
                if pattern.lower() in query_str.lower():
                    from loguru import logger
                    logger.warning(f"[SECURITY] Suspicious pattern '{pattern}' detected in query params for {request.url.path}")
                    break

        response = await call_next(request)
        return response