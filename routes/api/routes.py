"""
Main API routes for the Proof of Humanity application.
"""

from flask import Blueprint, jsonify, request
from flask_cors import CORS
from routes.api.family.routes import family_bp
from routes.api.verification.routes import verification_bp
from routes.api.did.routes import did_bp

api_bp = Blueprint('api', __name__)

# Register sub-blueprints
api_bp.register_blueprint(family_bp)
api_bp.register_blueprint(verification_bp)
api_bp.register_blueprint(did_bp)

# Enable CORS for all API routes
CORS(api_bp, resources={r"/api/*": {"origins": "*"}})

@api_bp.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint.
    """
    return jsonify({"status": "ok"}), 200

@api_bp.route('/api/cors-test', methods=['GET'])
def cors_test():
    """
    Test endpoint for CORS headers.
    """
    return jsonify({"status": "ok"}), 200

@api_bp.after_request
def add_cors_headers(response):
    """
    Add CORS headers to all API responses.
    """
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response 