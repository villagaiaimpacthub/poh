"""
Family relationship API routes for the Proof of Humanity application.
"""

from .routes import family_bp as bp, get_family_tree, add_family_relationship, remove_relationship

__all__ = ['bp', 'get_family_tree', 'add_family_relationship', 'remove_relationship'] 