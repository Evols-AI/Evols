"""
Security utilities for input sanitization and protection against common attacks.
Prevents prompt injection, XSS, and other security vulnerabilities.
"""

import re
import html
from typing import Optional, Dict, Any
from loguru import logger


class SecuritySanitizer:
    """
    Comprehensive security sanitizer for user inputs.
    Protects against prompt injection, XSS, and other attacks.
    """

    # Dangerous patterns that could lead to prompt injection
    PROMPT_INJECTION_PATTERNS = [
        r"ignore\s+all\s+previous\s+instructions",
        r"ignore\s+all\s+instructions",  # More specific pattern
        r"ignore\s+previous\s+instructions",
        r"ignore\s+instructions",  # More general pattern
        r"disregard\s+all\s+previous\s+instructions",
        r"forget\s+all\s+previous\s+instructions",
        r"system\s*prompt",
        r"previous\s+instructions\s+are\s+cancelled",
        r"instructions\s+are\s+cancelled",
        r"cancel\s+previous\s+instructions",
        r"override\s+previous\s+instructions",
        r"new\s+instructions",
        r"you\s+are\s+now\s+a",
        r"act\s+as\s+a\s+different",
        r"pretend\s+to\s+be",
        r"role\s*play\s+as",
        r"simulate\s+being",
        r"behave\s+like",
        r"reveal\s+all\s+system\s+prompts",
        r"show\s+me\s+your\s+instructions",
        r"what\s+are\s+your\s+instructions",
        r"leak\s+all\s+data",
        r"exfiltrat\w*\s+data",
        r"call\s+\w+\s+with",  # Attempts to force tool calls
        r"execute\s+\w+\s+with",  # Attempts to force tool execution
        r"always\s+execute",
        r"always\s+call",
        r"send\s+.*to.*\.com",  # Attempts to exfiltrate data
        r"fetch\s*\(\s*['\"]https?://",  # JavaScript fetch attempts
    ]

    # HTML/JavaScript patterns for XSS prevention
    XSS_PATTERNS = [
        r"<\s*script[^>]*>",
        r"<\s*/\s*script\s*>",
        r"javascript\s*:",
        r"data\s*:",
        r"vbscript\s*:",
        r"on\w+\s*=",  # Event handlers like onclick, onerror
        r"<\s*iframe[^>]*>",
        r"<\s*object[^>]*>",
        r"<\s*embed[^>]*>",
        r"<\s*link[^>]*>",
        r"<\s*meta[^>]*>",
        r"<\s*base[^>]*>",
        r"<\s*form[^>]*>",
        r"<\s*input[^>]*>",
        r"<\s*textarea[^>]*>",
        r"<\s*select[^>]*>",
        r"eval\s*\(",
        r"setTimeout\s*\(",
        r"setInterval\s*\(",
        r"Function\s*\(",
        r"document\.",
        r"window\.",
        r"location\.",
        r"alert\s*\(",
        r"confirm\s*\(",
        r"prompt\s*\(",
    ]

    @classmethod
    def sanitize_user_input(
        cls,
        text: Optional[str],
        max_length: int = 2000,
        context: str = "user_input"
    ) -> str:
        """
        Sanitize user input to prevent prompt injection and XSS attacks.

        Args:
            text: The user input text to sanitize
            max_length: Maximum allowed length
            context: Context for logging (e.g., "skill_customization", "chat_message")

        Returns:
            Sanitized text that is safe to use
        """
        if not text:
            return ""

        original_text = text

        # 1. Truncate to maximum length
        if len(text) > max_length:
            logger.warning(f"[Security] Truncating {context} input from {len(text)} to {max_length} chars")
            text = text[:max_length]

        # 2. HTML escape to prevent XSS
        text = html.escape(text)

        # 3. Detect and neutralize prompt injection patterns
        for pattern in cls.PROMPT_INJECTION_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                logger.error(f"[Security] Detected prompt injection pattern in {context}: {pattern}")
                # Replace entire matched text with safe placeholder
                text = re.sub(pattern, "[CONTENT_BLOCKED_FOR_SECURITY]", text, flags=re.IGNORECASE)

        # 4. Detect and neutralize XSS patterns
        for pattern in cls.XSS_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                logger.error(f"[Security] Detected XSS pattern in {context}: {pattern}")
                # Replace entire matched text with safe placeholder
                text = re.sub(pattern, "[CONTENT_BLOCKED_FOR_SECURITY]", text, flags=re.IGNORECASE)

        # 5. Log if input was modified
        if text != original_text:
            logger.warning(f"[Security] Sanitized {context} input (length: {len(original_text)} -> {len(text)})")

        return text

    @classmethod
    def sanitize_skill_customization(cls, customization_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize skill customization data specifically.

        Args:
            customization_data: Dictionary containing customization fields

        Returns:
            Sanitized customization data
        """
        sanitized = {}

        # Sanitize each field with appropriate limits
        field_limits = {
            'custom_context': 1000,
            'custom_instructions': 1500,
            'output_format_preferences': 500
        }

        for field, value in customization_data.items():
            if field in field_limits and isinstance(value, str):
                max_length = field_limits[field]
                sanitized[field] = cls.sanitize_user_input(
                    value,
                    max_length=max_length,
                    context=f"skill_customization.{field}"
                )
            else:
                sanitized[field] = value

        return sanitized

    @classmethod
    def sanitize_tool_arguments(cls, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize tool arguments to prevent malicious data injection.

        Args:
            tool_name: Name of the tool being called
            arguments: Tool arguments dictionary

        Returns:
            Sanitized arguments dictionary
        """
        sanitized = {}

        for key, value in arguments.items():
            if isinstance(value, str):
                # Sanitize string values with context
                sanitized[key] = cls.sanitize_user_input(
                    value,
                    max_length=1000,  # Reasonable limit for tool parameters
                    context=f"tool_argument.{tool_name}.{key}"
                )
            elif isinstance(value, list):
                # Recursively sanitize list elements
                sanitized[key] = [
                    cls.sanitize_user_input(item, max_length=1000, context=f"tool_argument.{tool_name}.{key}[{i}]")
                    if isinstance(item, str) else item
                    for i, item in enumerate(value[:50])  # Limit list size to prevent abuse
                ]
            elif isinstance(value, dict):
                # Recursively sanitize dictionary values
                sanitized[key] = {
                    dict_key: cls.sanitize_user_input(dict_value, max_length=1000, context=f"tool_argument.{tool_name}.{key}.{dict_key}")
                    if isinstance(dict_value, str) else dict_value
                    for dict_key, dict_value in list(value.items())[:20]  # Limit dict size
                }
            else:
                # Keep primitive types as-is (int, float, bool, None)
                sanitized[key] = value

        return sanitized

    @classmethod
    def is_potentially_malicious(cls, text: str) -> bool:
        """
        Check if text contains potentially malicious patterns.

        Args:
            text: Text to analyze

        Returns:
            True if text appears malicious, False otherwise
        """
        if not text:
            return False

        # Check for prompt injection patterns
        for pattern in cls.PROMPT_INJECTION_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return True

        # Check for XSS patterns
        for pattern in cls.XSS_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return True

        return False


# Convenience functions for common use cases
def sanitize_user_input(text: str, max_length: int = 2000, context: str = "user_input") -> str:
    """Convenience function for basic input sanitization."""
    return SecuritySanitizer.sanitize_user_input(text, max_length, context)


def sanitize_skill_customization(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function for skill customization sanitization."""
    return SecuritySanitizer.sanitize_skill_customization(data)


def sanitize_tool_arguments(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function for tool argument sanitization."""
    return SecuritySanitizer.sanitize_tool_arguments(tool_name, arguments)