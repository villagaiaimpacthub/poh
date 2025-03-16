from flask import Blueprint, render_template, current_app, g, request, jsonify, abort
from models.database import Database

# Create blueprint
network_bp = Blueprint('network', __name__, url_prefix='/network')

@network_bp.route('/family-tree', methods=['GET'])
def family_tree():
    """
    Render the family tree visualization page
    """
    return render_template('family_tree.html')

@network_bp.route('/viz', methods=['GET'])
def viz():
    """
    Render the network visualization page
    """
    try:
        current_app.logger.info('Serving network visualization page')
        # Log request headers to check for potential CORS issues
        current_app.logger.debug(f"Request headers: {request.headers}")
        return render_template('network_viz_standalone.html')
    except Exception as e:
        current_app.logger.error(f'Error serving visualization: {e}', exc_info=True)
        abort(500)

@network_bp.route('/api/network-data', methods=['GET'])
def network_data():
    """
    API endpoint to return network data for visualization
    """
    try:
        current_app.logger.info('Network data requested')
        # Add test data for visualization debugging
        test_data = {
            'nodes': [
                {'id': 'root', 'group': 1, 'name': 'Genesis', 'level': 'founder'},
                {'id': 'child1', 'group': 2, 'name': 'User 1', 'level': 'parent'},
                {'id': 'child2', 'group': 2, 'name': 'User 2', 'level': 'parent'},
                {'id': 'grandchild1', 'group': 3, 'name': 'User 3', 'level': 'child'}
            ],
            'links': [
                {'source': 'root', 'target': 'child1', 'value': 1},
                {'source': 'root', 'target': 'child2', 'value': 1},
                {'source': 'child1', 'target': 'grandchild1', 'value': 1}
            ]
        }
        current_app.logger.info(f'Returning test network data with {len(test_data["nodes"])} nodes')
        return jsonify(test_data)
    except Exception as e:
        current_app.logger.error(f'Error serving network data: {e}', exc_info=True)
        abort(500) 