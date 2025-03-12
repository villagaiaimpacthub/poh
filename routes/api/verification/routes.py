"""
Verification API route handlers for the Proof of Humanity application.
"""

from flask import Blueprint, request, jsonify, current_app, g
import json
from utils.security import require_auth, verify_token, generate_csrf_token
import logging
from datetime import datetime
from functools import wraps
import jwt
from models.database import Database

verification_bp = Blueprint('verification', __name__)

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

@verification_bp.route('/request', methods=['POST'])
@require_auth
def create_verification_request():
    """
    Create a new verification request.
    Requires authentication.
    """
    data = request.get_json()
    
    if not data or 'request_type' not in data:
        return jsonify({'error': 'Missing request_type'}), 400
        
    # Mock successful request creation
    return jsonify({
        'request_id': 'vr123',
        'status': 'pending',
        'created_at': '2024-03-12T17:39:09Z'
    }), 201

@verification_bp.route('/requests', methods=['GET'])
@require_auth
def get_verification_requests():
    """
    Get all verification requests for the authenticated user.
    Requires authentication.
    """
    # Mock verification requests
    requests = [
        {
            'id': 'vr123',
            'type': 'identity',
            'status': 'pending',
            'created_at': '2024-03-12T17:39:09Z'
        },
        {
            'id': 'vr124',
            'type': 'address',
            'status': 'completed',
            'created_at': '2024-03-12T17:39:09Z'
        }
    ]
    return jsonify({'requests': requests}), 200

@verification_bp.route('/status/<request_id>', methods=['GET'])
@require_auth
def get_verification_status(request_id):
    """
    Get the status of a verification request.
    Requires authentication.
    """
    # Get current user from auth token
    user_id = g.user.get('sub')
    
    # Mock verification request
    verification_request = {
        "id": int(request_id),
        "user_id": user_id,
        "verification_type": "biometric",
        "status": "pending",
        "created_at": "2023-01-01T12:00:00.000Z",
        "updated_at": "2023-01-01T12:00:00.000Z"
    }
    
    return jsonify(verification_request), 200 