"""
DID (Decentralized Identifier) API routes for the Proof of Humanity application.
"""

from .routes import did_bp as bp, get_did_document, create_did_document, resolve_did

__all__ = ['bp', 'get_did_document', 'create_did_document', 'resolve_did'] 