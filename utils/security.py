"""
Security utilities for the Proof of Humanity application.
"""

import hashlib
import os
import base64
import hmac
import secrets
import functools
import time
import json
from typing import Tuple, Optional, Dict, Any, Callable
from flask import request, jsonify, current_app, g

def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """
    Hash a password using PBKDF2 with HMAC-SHA256.
    
    Args:
        password: The password to hash
        salt: Optional salt to use. If None, a new salt is generated.
        
    Returns:
        A tuple containing (hash, salt)
    """
    if salt is None:
        salt = secrets.token_hex(16)  # 16 bytes = 128 bits
    
    # Use PBKDF2 with HMAC-SHA256
    key = hashlib.pbkdf2_hmac(
        'sha256',  # The hash algorithm
        password.encode('utf-8'),  # Convert the password to bytes
        salt.encode('utf-8'),  # Convert the salt to bytes
        100000,  # 100,000 iterations (recommended minimum)
        dklen=32  # 32 bytes = 256 bits
    )
    
    # Convert binary hash to hex string
    hash_str = key.hex()
    
    return hash_str, salt

def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """
    Verify a password against a stored hash and salt.
    
    Args:
        password: The password to verify
        stored_hash: The stored hash to compare against
        salt: The salt used when creating the stored hash
        
    Returns:
        True if the password matches, False otherwise
    """
    # Hash the provided password with the stored salt
    calculated_hash, _ = hash_password(password, salt)
    
    # Compare in constant time to prevent timing attacks
    return hmac.compare_digest(calculated_hash, stored_hash)

def generate_token(length: int = 32) -> str:
    """
    Generate a secure random token.
    
    Args:
        length: The length of the token in bytes
        
    Returns:
        A URL-safe base64-encoded token
    """
    token_bytes = os.urandom(length)
    return base64.urlsafe_b64encode(token_bytes).decode('utf-8')

def generate_session_id() -> str:
    """
    Generate a unique session ID.
    
    Returns:
        A secure random session ID
    """
    return secrets.token_hex(16)  # 16 bytes = 32 hex characters

def create_jwt(payload: Dict[str, Any], secret_key: str, expires_in: int = 86400) -> str:
    """
    Create a JWT token.
    
    Args:
        payload: Dictionary containing the JWT payload
        secret_key: Secret key to sign the token
        expires_in: Token expiry time in seconds (default: 24 hours)
        
    Returns:
        A signed JWT token
    """
    # Add expiration time to payload
    iat = int(time.time())
    exp = iat + expires_in
    payload.update({"iat": iat, "exp": exp})
    
    # Create header
    header = {"alg": "HS256", "typ": "JWT"}
    
    # Encode header and payload
    header_json = json.dumps(header, separators=(",", ":")).encode()
    header_b64 = base64.urlsafe_b64encode(header_json).decode().rstrip("=")
    
    payload_json = json.dumps(payload, separators=(",", ":")).encode()
    payload_b64 = base64.urlsafe_b64encode(payload_json).decode().rstrip("=")
    
    # Create signature
    to_sign = f"{header_b64}.{payload_b64}".encode()
    signature = hmac.new(secret_key.encode(), to_sign, hashlib.sha256).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    
    # Combine into token
    jwt_token = f"{header_b64}.{payload_b64}.{signature_b64}"
    
    return jwt_token

def verify_token(token: str, secret_key: str) -> Optional[Dict[str, Any]]:
    """
    Verify a JWT token.
    
    Args:
        token: The JWT token to verify
        secret_key: Secret key used to sign the token
        
    Returns:
        The decoded payload if the token is valid, None otherwise
    """
    try:
        # Split token into parts
        parts = token.split(".")
        if len(parts) != 3:
            return None
        
        header_b64, payload_b64, signature_b64 = parts
        
        # Verify signature
        to_verify = f"{header_b64}.{payload_b64}".encode()
        signature = base64.urlsafe_b64decode(signature_b64 + "=" * (4 - len(signature_b64) % 4))
        expected_signature = hmac.new(secret_key.encode(), to_verify, hashlib.sha256).digest()
        
        if not hmac.compare_digest(signature, expected_signature):
            return None
        
        # Decode payload
        payload_json = base64.urlsafe_b64decode(payload_b64 + "=" * (4 - len(payload_b64) % 4))
        payload = json.loads(payload_json)
        
        # Check expiration
        if "exp" in payload and int(time.time()) > payload["exp"]:
            return None
        
        return payload
    except Exception:
        return None

def generate_csrf_token() -> str:
    """
    Generate a CSRF token.
    
    Returns:
        A secure random CSRF token
    """
    return secrets.token_hex(32)

def require_auth(f: Callable) -> Callable:
    """
    Decorator to require authentication for an endpoint.
    
    Args:
        f: The function to decorate
        
    Returns:
        The decorated function
    """
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Authentication required"}), 401
        
        token = auth_header.split('Bearer ')[1]
        secret_key = current_app.config.get('SECRET_KEY', 'default-secret-key')
        payload = verify_token(token, secret_key)
        
        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Store user info in g for later use
        g.user = payload
        
        return f(*args, **kwargs)
    
    return decorated 