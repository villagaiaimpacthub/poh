"""
API routes package for the Proof of Humanity application.
"""

from flask import Blueprint, jsonify

bp = Blueprint('api', __name__, url_prefix='/api')

# Import and register all API routes
from routes.api.family import bp as family_bp
from routes.api.verification import bp as verification_bp
from routes.api.did import bp as did_bp

bp.register_blueprint(family_bp, url_prefix='/family')
bp.register_blueprint(verification_bp, url_prefix='/verification')
bp.register_blueprint(did_bp, url_prefix='/did')

@bp.route('/health')
def health_check():
    """Health check endpoint for API monitoring."""
    return jsonify({"status": "ok"})

# Error handling for API routes
@bp.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404

@bp.errorhandler(400)
def bad_request(error):
    return jsonify({"error": "Bad request"}), 400

@bp.errorhandler(401)
def unauthorized(error):
    return jsonify({"error": "Unauthorized"}), 401

@bp.errorhandler(403)
def forbidden(error):
    return jsonify({"error": "Forbidden"}), 403

@bp.errorhandler(500)
def server_error(error):
    return jsonify({"error": "Internal server error"}), 500 