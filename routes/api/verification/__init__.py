"""
Verification API routes for the Proof of Humanity application.
"""

from .routes import verification_bp as bp, create_verification_request, get_verification_requests, get_verification_status

__all__ = ['bp', 'create_verification_request', 'get_verification_requests', 'get_verification_status'] 