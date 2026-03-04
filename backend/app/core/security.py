"""
Security utilities for password hashing and JWT tokens
Uses bcrypt directly to avoid passlib compatibility issues with bcrypt>=4.0
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
import bcrypt
import os
import base64
import logging
from cryptography.fernet import Fernet

from app.core.config import settings

logger = logging.getLogger(__name__)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hashed password"""
    plain_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password
    return bcrypt.checkpw(plain_bytes, hashed_bytes)


def get_password_hash(password: str) -> str:
    """Generate bcrypt password hash"""
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token

    Args:
        data: Payload data (typically includes user_id, email, role)
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": datetime.utcnow()})

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate JWT token

    Args:
        token: JWT token string

    Returns:
        Decoded payload or None if invalid
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


# ============================================================================
# Field-level Encryption for API Keys
# ============================================================================

def get_encryption_key() -> bytes:
    """
    Get encryption key for field-level encryption (API keys, secrets)

    Returns:
        Encryption key as bytes

    Raises:
        ValueError: If FIELD_ENCRYPTION_KEY is not set
    """
    key = os.getenv("FIELD_ENCRYPTION_KEY") or settings.FIELD_ENCRYPTION_KEY
    if not key:
        raise ValueError(
            "FIELD_ENCRYPTION_KEY not set in environment. "
            "Generate with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        )
    return key.encode() if isinstance(key, str) else key


def encrypt_field(value: str) -> str:
    """
    Encrypt a string field (e.g., API key) using Fernet symmetric encryption

    Args:
        value: Plain text value to encrypt

    Returns:
        Base64-encoded encrypted value
    """
    if not value:
        return value

    try:
        fernet = Fernet(get_encryption_key())
        encrypted = fernet.encrypt(value.encode())
        return base64.urlsafe_b64encode(encrypted).decode()
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        raise RuntimeError(f"Failed to encrypt field: {str(e)}")


def decrypt_field(encrypted_value: str) -> str:
    """
    Decrypt an encrypted field

    Args:
        encrypted_value: Base64-encoded encrypted value

    Returns:
        Decrypted plain text value
    """
    if not encrypted_value:
        return encrypted_value

    try:
        fernet = Fernet(get_encryption_key())
        decoded = base64.urlsafe_b64decode(encrypted_value.encode())
        decrypted = fernet.decrypt(decoded)
        return decrypted.decode()
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        raise RuntimeError(f"Failed to decrypt field: {str(e)}")


def encrypt_llm_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Encrypt sensitive fields in LLM configuration

    Encrypts: api_key, secret_access_key, azure_api_key

    Args:
        config: LLM configuration dictionary

    Returns:
        Configuration with encrypted sensitive fields
    """
    if not config:
        return config

    encrypted_config = config.copy()
    sensitive_fields = ['api_key', 'secret_access_key', 'azure_api_key']

    for field in sensitive_fields:
        if field in encrypted_config and encrypted_config[field]:
            encrypted_config[field] = encrypt_field(encrypted_config[field])

    return encrypted_config


def decrypt_llm_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Decrypt sensitive fields in LLM configuration

    Decrypts: api_key, secret_access_key, azure_api_key

    Args:
        config: LLM configuration with encrypted fields

    Returns:
        Configuration with decrypted sensitive fields
    """
    if not config:
        return config

    decrypted_config = config.copy()
    sensitive_fields = ['api_key', 'secret_access_key', 'azure_api_key']

    for field in sensitive_fields:
        if field in decrypted_config and decrypted_config[field]:
            try:
                decrypted_config[field] = decrypt_field(decrypted_config[field])
            except Exception as e:
                logger.warning(f"Failed to decrypt {field}: {e}")
                # Keep encrypted value if decryption fails (might be plain text from migration)

    return decrypted_config


def mask_api_key(api_key: str) -> str:
    """
    Mask an API key for safe display (show first 3 and last 4 chars)

    Args:
        api_key: Full API key

    Returns:
        Masked API key like 'sk-...xyz'
    """
    if not api_key or len(api_key) < 8:
        return '***'

    return f"{api_key[:3]}...{api_key[-4:]}"
