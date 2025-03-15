from flask import Blueprint, render_template, current_app, g, request, jsonify, abort
from models.database import Database

# Create blueprint
network_bp = Blueprint('network', __name__, url_prefix='/network')

@network_bp.route('/family-tree', methods=['GET'])
def family_tree():
    """
    Render the family tree visualization page
    """
    return render_template('family-tree.html')

@network_bp.route('/viz', methods=['GET'])
def viz():
    """
    Render the network visualization page
    """
    try:
        current_app.logger.info('Serving network visualization page')
        return render_template('network_viz_standalone.html')
    except Exception as e:
        current_app.logger.error(f'Error serving visualization: {e}')
        abort(500)

@network_bp.route('/api/network-data', methods=['GET'])
def network_data():
    """
    API endpoint to return network data for visualization
    """
    try:
        return jsonify({
            'nodes': [],
            'links': []
        })
    except Exception as e:
        current_app.logger.error(f'Error serving network data: {e}')
        abort(500) 