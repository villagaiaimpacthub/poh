from flask import Blueprint, jsonify, request, current_app, g
import json
import time
from models.database import (
    get_family_tree, get_family_relationships, add_family_relationship,
    verify_family_relationship, remove_family_relationship,
    get_user_by_email, get_user_by_id
)
from utils.security import require_auth, verify_token, generate_csrf_token

# Create a blueprint for family-related endpoints
family_bp = Blueprint('family_api', __name__, url_prefix='/api/family')

@family_bp.route('/tree', methods=['GET'])
@require_auth
def get_tree():
    """
    Get the family tree for the current user.
    
    Returns:
        JSON response with family tree data
    """
    # Get the current user ID from the session
    user_id = g.user_id
    
    # Get the family tree data
    tree_data = get_family_tree(user_id)
    
    # Return the tree data as JSON
    return jsonify({
        'success': True,
        'data': tree_data
    })

@family_bp.route('/relationships', methods=['GET'])
@require_auth
def get_relationships():
    """
    Get the family relationships for the current user.
    
    Returns:
        JSON response with family relationships data
    """
    # Get the current user ID from the session
    user_id = g.user_id
    
    # Get the family relationships data
    relationships = get_family_relationships(user_id)
    
    # Return the relationships data as JSON
    return jsonify({
        'success': True,
        'data': relationships
    })

@family_bp.route('/add', methods=['POST'])
@require_auth
def add_relationship():
    """
    Add a new family relationship.
    
    Request body:
        relative_email: Email of the relative
        relationship_type: Type of relationship
        
    Returns:
        JSON response with success status and relationship data
    """
    # Get the current user ID from the session
    user_id = g.user_id
    
    # Get the request data
    data = request.get_json()
    
    # Validate the request data
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    relative_email = data.get('relative_email')
    relationship_type = data.get('relationship_type')
    
    if not relative_email or not relationship_type:
        return jsonify({'success': False, 'error': 'Missing required fields'}), 400
    
    # Validate the relationship type
    valid_relationships = ['parent', 'child', 'spouse', 'sibling', 'grandparent', 
                          'grandchild', 'aunt/uncle', 'niece/nephew', 'cousin']
    
    if relationship_type not in valid_relationships:
        return jsonify({'success': False, 'error': 'Invalid relationship type'}), 400
    
    # Prevent self-relationships
    user = get_user_by_id(user_id)
    if user['email'].lower() == relative_email.lower():
        return jsonify({'success': False, 'error': 'Cannot add relationship with yourself'}), 400
    
    # Add the relationship
    result = add_family_relationship(user_id, relative_email, relationship_type)
    
    if not result.get('success', False):
        return jsonify(result), 400
    
    # Return the result
    return jsonify(result)

@family_bp.route('/verify/<int:relationship_id>', methods=['PUT'])
@require_auth
def verify_relationship(relationship_id):
    """
    Verify a family relationship.
    
    Path parameters:
        relationship_id: ID of the relationship to verify
        
    Returns:
        JSON response with success status and relationship data
    """
    # Get the current user ID from the session
    user_id = g.user_id
    
    # Verify the relationship
    result = verify_family_relationship(relationship_id)
    
    if not result.get('success', False):
        return jsonify(result), 404
    
    # Return the result
    return jsonify(result)

@family_bp.route('/remove/<int:relationship_id>', methods=['DELETE'])
@require_auth
def remove_relationship(relationship_id):
    """
    Remove a family relationship.
    
    Path parameters:
        relationship_id: ID of the relationship to remove
        
    Returns:
        JSON response with success status
    """
    # Get the current user ID from the session
    user_id = g.user_id
    
    # Remove the relationship
    result = remove_family_relationship(relationship_id)
    
    if not result.get('success', False):
        return jsonify(result), 404
    
    # Return the result
    return jsonify(result)

@family_bp.route('/search', methods=['GET'])
@require_auth
def search_users():
    """
    Search for users by email or name to add as family members.
    
    Query parameters:
        q: Search query
        
    Returns:
        JSON response with search results
    """
    # Get the current user ID from the session
    user_id = g.user_id
    
    # Get the search query
    query = request.args.get('q', '')
    
    if not query or len(query) < 3:
        return jsonify({
            'success': False,
            'error': 'Search query must be at least 3 characters'
        }), 400
    
    # TODO: Implement a proper search function in the database module
    # For now, we'll just check if the query matches an email exactly
    
    user = get_user_by_email(query)
    
    if not user or user['id'] == user_id:
        return jsonify({
            'success': True,
            'data': []
        })
    
    # Return basic user information (no sensitive data)
    return jsonify({
        'success': True,
        'data': [{
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'verification_level': user['verification_level']
        }]
    }) 