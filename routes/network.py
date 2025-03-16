from flask import Blueprint, render_template, current_app, g, request, jsonify, abort
from models.database import Database

# Create blueprint
network_bp = Blueprint('network', __name__, url_prefix='/network')

@network_bp.route('/family-tree', methods=['GET'])
def family_tree():
    """
    Render the family tree visualization page
    """
    try:
        current_app.logger.info('Serving family tree page')
        return render_template('family-tree.html')
    except Exception as e:
        current_app.logger.error(f'Error serving family tree: {e}', exc_info=True)
        return render_template('errors/500.html'), 500

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

@network_bp.route('/circular-tree-data', methods=['GET'])
def circular_tree_data():
    """Return data for the circular family tree visualization."""
    # This would normally fetch data from a database
    # For now, we'll return sample data
    sample_data = {
        "center": {
            "id": "user123",
            "name": "Current User",
            "level": 1
        },
        "connections": [
            {
                "id": "parent1",
                "name": "Parent 1",
                "level": 2,
                "connections": [
                    {
                        "id": "grandparent1",
                        "name": "Grandparent 1",
                        "level": 3,
                        "connections": [
                            {"id": "ggp1", "name": "Great Grandparent 1", "level": 4},
                            {"id": "ggp2", "name": "Great Grandparent 2", "level": 4},
                            {"id": "ggp3", "name": "Great Grandparent 3", "level": 4}
                        ]
                    },
                    {
                        "id": "grandparent2",
                        "name": "Grandparent 2",
                        "level": 3,
                        "connections": [
                            {"id": "ggp4", "name": "Great Grandparent 4", "level": 4},
                            {"id": "ggp5", "name": "Great Grandparent 5", "level": 4},
                            {"id": "ggp6", "name": "Great Grandparent 6", "level": 4}
                        ]
                    },
                    {
                        "id": "grandparent3",
                        "name": "Grandparent 3",
                        "level": 3,
                        "connections": [
                            {"id": "ggp7", "name": "Great Grandparent 7", "level": 4},
                            {"id": "ggp8", "name": "Great Grandparent 8", "level": 4},
                            {"id": "ggp9", "name": "Great Grandparent 9", "level": 4}
                        ]
                    }
                ]
            },
            {
                "id": "parent2",
                "name": "Parent 2",
                "level": 2,
                "connections": [
                    {
                        "id": "grandparent4",
                        "name": "Grandparent 4",
                        "level": 3,
                        "connections": [
                            {"id": "ggp10", "name": "Great Grandparent 10", "level": 4},
                            {"id": "ggp11", "name": "Great Grandparent 11", "level": 4},
                            {"id": "ggp12", "name": "Great Grandparent 12", "level": 4}
                        ]
                    },
                    {
                        "id": "grandparent5",
                        "name": "Grandparent 5",
                        "level": 3,
                        "connections": [
                            {"id": "ggp13", "name": "Great Grandparent 13", "level": 4},
                            {"id": "ggp14", "name": "Great Grandparent 14", "level": 4},
                            {"id": "ggp15", "name": "Great Grandparent 15", "level": 4}
                        ]
                    },
                    {
                        "id": "grandparent6",
                        "name": "Grandparent 6",
                        "level": 3,
                        "connections": [
                            {"id": "ggp16", "name": "Great Grandparent 16", "level": 4},
                            {"id": "ggp17", "name": "Great Grandparent 17", "level": 4},
                            {"id": "ggp18", "name": "Great Grandparent 18", "level": 4}
                        ]
                    }
                ]
            }
        ]
    }
    return jsonify(sample_data) 