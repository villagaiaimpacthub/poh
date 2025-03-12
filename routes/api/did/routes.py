"""
DID (Decentralized Identifier) API route handlers for the Proof of Humanity application.
"""

from flask import Blueprint, request, jsonify, current_app, g
import json
from utils.security import require_auth, verify_token, generate_csrf_token
import logging
from functools import wraps
import jwt
from models.database import Database

did_bp = Blueprint('did', __name__)

# Initialize database
db = Database()

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No authorization header'}), 401
        
        try:
            token = auth_header.split(' ')[1]
            payload = jwt.decode(token, 'test_secret_key', algorithms=['HS256'])
            g.user = payload
            return f(*args, **kwargs)
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return jsonify({'error': 'Invalid or expired token'}), 401
        except IndexError:
            return jsonify({'error': 'Invalid authorization header format'}), 401
    return decorated

@did_bp.route('/document/<did_id>', methods=['GET'])
def get_did_document(did_id):
    """
    Get a DID document by ID.
    Public endpoint.
    """
    # Mock DID document for testing
    document = {
        '@context': ['https://www.w3.org/ns/did/v1'],
        'id': did_id,
        'created': '2024-03-12T17:39:09Z',
        'updated': '2024-03-12T17:39:09Z',
        'verificationMethod': [{
            'id': f'{did_id}#key-1',
            'type': 'Ed25519VerificationKey2020',
            'controller': did_id,
            'publicKeyMultibase': 'z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
        }],
        'authentication': [f'{did_id}#key-1'],
        'service': []
    }
    return jsonify(document), 200

@did_bp.route('/document', methods=['POST'])
@require_auth
def create_did_document():
    """
    Create or update a DID document.
    Requires authentication.
    """
    data = request.get_json()
    
    # Validate request
    if not data or 'publicKey' not in data:
        return jsonify({"error": "Invalid request data"}), 400
    
    # Get current user from auth token
    user_id = g.user.get('sub')
    
    # Create new DID document
    did_document = {
        "@context": "https://www.w3.org/ns/did/v1",
        "id": f"did:poh:{user_id}",
        "created": "2023-01-01T12:00:00Z",
        "updated": "2023-01-01T12:00:00Z",
        "verificationMethod": [
            {
                "id": f"did:poh:{user_id}#keys-1",
                "type": "Ed25519VerificationKey2018",
                "controller": f"did:poh:{user_id}",
                "publicKeyBase58": data['publicKey']
            }
        ],
        "authentication": [
            f"did:poh:{user_id}#keys-1"
        ],
        "service": data.get('service', [])
    }
    
    return jsonify(did_document), 201

@did_bp.route('/resolve/<did>', methods=['GET'])
def resolve_did(did):
    """
    Resolve a DID to get its DID document.
    Public endpoint.
    """
    # Check DID format
    if not did.startswith('did:poh:'):
        return jsonify({"error": "Invalid DID format"}), 400
    
    did_id = did.split(':')[2]
    
    # Mock DID document
    did_document = {
        "@context": "https://www.w3.org/ns/did/v1",
        "id": did,
        "created": "2023-01-01T12:00:00Z",
        "updated": "2023-01-01T12:00:00Z",
        "verificationMethod": [
            {
                "id": f"{did}#keys-1",
                "type": "Ed25519VerificationKey2018",
                "controller": did,
                "publicKeyBase58": "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGH"
            }
        ],
        "authentication": [
            f"{did}#keys-1"
        ],
        "service": [
            {
                "id": f"{did}#profile",
                "type": "ProofOfHumanityProfile",
                "serviceEndpoint": f"https://poh.io/profile/{did_id}"
            }
        ]
    }
    
    return jsonify({"didDocument": did_document}), 200

@did_bp.route('/document/<did_id>', methods=['PUT'])
@require_auth
def update_did_document(did_id):
    """Update a DID document."""
    data = request.get_json()
    
    if not data or 'publicKey' not in data:
        return jsonify({'error': 'Missing publicKey'}), 400
        
    # Mock successful document update
    return jsonify({'message': 'DID document updated successfully'}), 200 