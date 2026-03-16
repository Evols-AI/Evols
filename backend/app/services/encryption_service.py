"""
Encryption Service
Handles encryption/decryption of sensitive content for data retention
Uses AES-256-GCM for authenticated encryption
"""

import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from typing import Tuple, Optional
from loguru import logger


class EncryptionService:
    """
    Service for encrypting and decrypting content

    Uses AES-256-GCM for authenticated encryption with randomly generated keys.
    Keys are derived from a master secret using PBKDF2.
    """

    def __init__(self, master_secret: Optional[str] = None):
        """
        Initialize encryption service

        Args:
            master_secret: Master secret for key derivation. If None, uses ENCRYPTION_MASTER_SECRET from env
        """
        self.master_secret = master_secret or os.getenv('ENCRYPTION_MASTER_SECRET')

        if not self.master_secret:
            logger.warning("[EncryptionService] No master secret configured. Encryption will not be available.")
        else:
            # Convert to bytes
            self.master_secret_bytes = self.master_secret.encode('utf-8')

    def _derive_key(self, key_id: str, salt: bytes) -> bytes:
        """
        Derive encryption key from master secret and key_id using PBKDF2

        Args:
            key_id: Unique identifier for this key
            salt: Random salt for key derivation

        Returns:
            32-byte encryption key
        """
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,  # 256 bits
            salt=salt,
            iterations=100000,
        )
        key = kdf.derive(self.master_secret_bytes + key_id.encode('utf-8'))
        return key

    def encrypt_content(self, content: str, key_id: str) -> Tuple[bytes, bytes, bytes]:
        """
        Encrypt content using AES-256-GCM

        Args:
            content: Text content to encrypt
            key_id: Unique identifier for this encryption operation

        Returns:
            Tuple of (encrypted_data, nonce, salt)

        Raises:
            ValueError: If master secret not configured
        """
        if not self.master_secret:
            raise ValueError("Encryption not available - master secret not configured")

        try:
            # Generate random salt and nonce
            salt = os.urandom(16)
            nonce = os.urandom(12)  # 96 bits for GCM

            # Derive key
            key = self._derive_key(key_id, salt)

            # Encrypt
            aesgcm = AESGCM(key)
            content_bytes = content.encode('utf-8')
            encrypted_data = aesgcm.encrypt(nonce, content_bytes, None)

            return encrypted_data, nonce, salt

        except Exception as e:
            logger.error(f"[EncryptionService] Encryption failed: {e}")
            raise ValueError(f"Encryption failed: {e}")

    def decrypt_content(self, encrypted_data: bytes, nonce: bytes, salt: bytes, key_id: str) -> str:
        """
        Decrypt content using AES-256-GCM

        Args:
            encrypted_data: Encrypted content
            nonce: Nonce used during encryption
            salt: Salt used for key derivation
            key_id: Key identifier used during encryption

        Returns:
            Decrypted text content

        Raises:
            ValueError: If decryption fails or master secret not configured
        """
        if not self.master_secret:
            raise ValueError("Decryption not available - master secret not configured")

        try:
            # Derive same key
            key = self._derive_key(key_id, salt)

            # Decrypt
            aesgcm = AESGCM(key)
            decrypted_bytes = aesgcm.decrypt(nonce, encrypted_data, None)

            return decrypted_bytes.decode('utf-8')

        except Exception as e:
            logger.error(f"[EncryptionService] Decryption failed: {e}")
            raise ValueError(f"Decryption failed: {e}")

    def pack_encrypted_blob(self, encrypted_data: bytes, nonce: bytes, salt: bytes) -> bytes:
        """
        Pack encrypted data, nonce, and salt into single blob for storage

        Format: [salt (16 bytes)][nonce (12 bytes)][encrypted_data]

        Args:
            encrypted_data: Encrypted content
            nonce: Nonce used during encryption
            salt: Salt used for key derivation

        Returns:
            Packed binary blob
        """
        return salt + nonce + encrypted_data

    def unpack_encrypted_blob(self, blob: bytes) -> Tuple[bytes, bytes, bytes]:
        """
        Unpack encrypted blob into components

        Args:
            blob: Packed binary blob

        Returns:
            Tuple of (encrypted_data, nonce, salt)
        """
        if len(blob) < 28:  # 16 (salt) + 12 (nonce)
            raise ValueError("Invalid encrypted blob - too short")

        salt = blob[:16]
        nonce = blob[16:28]
        encrypted_data = blob[28:]

        return encrypted_data, nonce, salt


def encrypt_text(content: str, key_id: str, master_secret: Optional[str] = None) -> bytes:
    """
    Helper function to encrypt text content

    Args:
        content: Text to encrypt
        key_id: Unique identifier for this encryption
        master_secret: Optional master secret (uses env if not provided)

    Returns:
        Packed encrypted blob ready for database storage
    """
    service = EncryptionService(master_secret)
    encrypted_data, nonce, salt = service.encrypt_content(content, key_id)
    return service.pack_encrypted_blob(encrypted_data, nonce, salt)


def decrypt_text(encrypted_blob: bytes, key_id: str, master_secret: Optional[str] = None) -> str:
    """
    Helper function to decrypt text content

    Args:
        encrypted_blob: Packed encrypted blob from database
        key_id: Key identifier used during encryption
        master_secret: Optional master secret (uses env if not provided)

    Returns:
        Decrypted text content
    """
    service = EncryptionService(master_secret)
    encrypted_data, nonce, salt = service.unpack_encrypted_blob(encrypted_blob)
    return service.decrypt_content(encrypted_data, nonce, salt, key_id)
