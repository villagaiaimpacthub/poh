import unittest
import os
import sys
import json
import time
from unittest.mock import patch, MagicMock

# Add the parent directory to the path so we can import the application modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from models.database import Database, get_family_tree, get_family_relationships, add_family_relationship, \
    verify_family_relationship, remove_family_relationship, get_inverse_relationship
from utils.security import hash_password

# Test configuration
TEST_DB_PATH = os.path.join(os.path.dirname(__file__), 'test_database.sqlite')

class TestFamilyDatabase(unittest.TestCase):
    """Test suite for family relationship database functions."""
    
    @classmethod
    def setUpClass(cls):
        """Set up the test environment once before all tests."""
        # Create a test database
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)
            
        # Initialize the database with the schema
        db = Database(TEST_DB_PATH)
        schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'schema.sql')
        db.init_db(schema_path)
        
        # Create test users
        cls.create_test_users(db)
    
    @classmethod
    def tearDownClass(cls):
        """Clean up the test environment after all tests."""
        db = Database(TEST_DB_PATH)
        db.close_connections()
        
        # Remove the test database
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)
    
    def setUp(self):
        """Set up the test environment before each test."""
        # Get a clean database connection
        self.db = Database(TEST_DB_PATH)
        
        # Clean up any existing relationships
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM family_relationships")
            conn.execute("DELETE FROM notifications WHERE type LIKE 'family%'")
            conn.commit()
    
    def tearDown(self):
        """Clean up the test environment after each test."""
        # Clean up created relationships
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM family_relationships")
            conn.execute("DELETE FROM notifications WHERE type LIKE 'family%'")
            conn.commit()
    
    @classmethod
    def create_test_users(cls, db):
        """Create test users for the test suite."""
        # User 1 (main user)
        user1_data = {
            'name': 'Test User 1',
            'email': 'user1@test.com',
            'password_hash': hash_password('password1'),
            'verification_level': 1,
            'email_verified': True,
            'created_at': int(time.time()),
            'updated_at': int(time.time())
        }
        
        # User 2 (parent)
        user2_data = {
            'name': 'Test User 2',
            'email': 'user2@test.com',
            'password_hash': hash_password('password2'),
            'verification_level': 2,
            'email_verified': True,
            'created_at': int(time.time()),
            'updated_at': int(time.time())
        }
        
        # User 3 (sibling)
        user3_data = {
            'name': 'Test User 3',
            'email': 'user3@test.com',
            'password_hash': hash_password('password3'),
            'verification_level': 1,
            'email_verified': True,
            'created_at': int(time.time()),
            'updated_at': int(time.time())
        }
        
        # User 4 (child)
        user4_data = {
            'name': 'Test User 4',
            'email': 'user4@test.com',
            'password_hash': hash_password('password4'),
            'verification_level': 0,
            'email_verified': False,
            'created_at': int(time.time()),
            'updated_at': int(time.time())
        }
        
        # Insert users
        with db.get_connection() as conn:
            # Check if users already exist
            existing = conn.execute("SELECT COUNT(*) as count FROM users").fetchone()
            
            if existing['count'] == 0:
                db.insert('users', user1_data)
                db.insert('users', user2_data)
                db.insert('users', user3_data)
                db.insert('users', user4_data)
    
    def test_get_inverse_relationship(self):
        """Test getting inverse relationship types."""
        self.assertEqual(get_inverse_relationship('parent'), 'child')
        self.assertEqual(get_inverse_relationship('child'), 'parent')
        self.assertEqual(get_inverse_relationship('spouse'), 'spouse')
        self.assertEqual(get_inverse_relationship('sibling'), 'sibling')
        self.assertEqual(get_inverse_relationship('grandparent'), 'grandchild')
        self.assertEqual(get_inverse_relationship('grandchild'), 'grandparent')
        self.assertEqual(get_inverse_relationship('aunt/uncle'), 'niece/nephew')
        self.assertEqual(get_inverse_relationship('niece/nephew'), 'aunt/uncle')
        self.assertEqual(get_inverse_relationship('cousin'), 'cousin')
        self.assertEqual(get_inverse_relationship('unknown'), 'other')
    
    def test_add_family_relationship(self):
        """Test adding a family relationship."""
        # Get the user IDs
        with self.db.get_connection() as conn:
            user1 = conn.execute("SELECT id FROM users WHERE email = 'user1@test.com'").fetchone()
            user2 = conn.execute("SELECT id FROM users WHERE email = 'user2@test.com'").fetchone()
        
        # Add a relationship (user1 is child of user2)
        result = add_family_relationship(user1['id'], 'user2@test.com', 'child')
        
        # Check the result
        self.assertTrue(result['success'])
        self.assertIn('relationship_id', result)
        self.assertIn('inverse_id', result)
        self.assertEqual(result['relationship_type'], 'child')
        self.assertEqual(result['relative_id'], user2['id'])
        
        # Check the relationships in the database
        with self.db.get_connection() as conn:
            # Check the primary relationship
            rel1 = conn.execute(
                """SELECT * FROM family_relationships 
                WHERE user_id = ? AND relative_id = ?""", 
                (user1['id'], user2['id'])
            ).fetchone()
            
            self.assertIsNotNone(rel1)
            self.assertEqual(rel1['relationship_type'], 'child')
            self.assertFalse(rel1['verified'])
            
            # Check the inverse relationship
            rel2 = conn.execute(
                """SELECT * FROM family_relationships 
                WHERE user_id = ? AND relative_id = ?""", 
                (user2['id'], user1['id'])
            ).fetchone()
            
            self.assertIsNotNone(rel2)
            self.assertEqual(rel2['relationship_type'], 'parent')
            self.assertFalse(rel2['verified'])
            
            # Check that a notification was created
            notif = conn.execute(
                "SELECT * FROM notifications WHERE user_id = ? AND type = 'family_request'",
                (user2['id'],)
            ).fetchone()
            
            self.assertIsNotNone(notif)
            self.assertFalse(notif['read'])
    
    def test_add_duplicate_relationship(self):
        """Test adding a duplicate family relationship."""
        # Get the user IDs
        with self.db.get_connection() as conn:
            user1 = conn.execute("SELECT id FROM users WHERE email = 'user1@test.com'").fetchone()
            user2 = conn.execute("SELECT id FROM users WHERE email = 'user2@test.com'").fetchone()
        
        # Add a relationship first
        add_family_relationship(user1['id'], 'user2@test.com', 'child')
        
        # Try to add the same relationship again
        result = add_family_relationship(user1['id'], 'user2@test.com', 'child')
        
        # Check the result
        self.assertFalse(result['success'])
        self.assertIn('error', result)
        self.assertEqual(result['error'], 'Relationship already exists')
    
    def test_verify_family_relationship(self):
        """Test verifying a family relationship."""
        # Get the user IDs
        with self.db.get_connection() as conn:
            user1 = conn.execute("SELECT id FROM users WHERE email = 'user1@test.com'").fetchone()
            user2 = conn.execute("SELECT id FROM users WHERE email = 'user2@test.com'").fetchone()
            user3 = conn.execute("SELECT id FROM users WHERE email = 'user3@test.com'").fetchone()
        
        # Add relationships
        rel1 = add_family_relationship(user1['id'], 'user2@test.com', 'child')
        rel2 = add_family_relationship(user1['id'], 'user3@test.com', 'sibling')
        
        # Verify the first relationship
        result = verify_family_relationship(rel1['inverse_id'])
        
        # Check the result
        self.assertTrue(result['success'])
        
        # Check the relationships in the database
        with self.db.get_connection() as conn:
            # Check the primary relationship is verified
            rel1_db = conn.execute(
                "SELECT * FROM family_relationships WHERE id = ?", 
                (rel1['relationship_id'],)
            ).fetchone()
            
            self.assertIsNotNone(rel1_db)
            self.assertTrue(rel1_db['verified'])
            
            # Check the inverse relationship is verified
            rel1_inv_db = conn.execute(
                "SELECT * FROM family_relationships WHERE id = ?", 
                (rel1['inverse_id'],)
            ).fetchone()
            
            self.assertIsNotNone(rel1_inv_db)
            self.assertTrue(rel1_inv_db['verified'])
            
            # Check that the other relationship is still unverified
            rel2_db = conn.execute(
                "SELECT * FROM family_relationships WHERE id = ?", 
                (rel2['relationship_id'],)
            ).fetchone()
            
            self.assertIsNotNone(rel2_db)
            self.assertFalse(rel2_db['verified'])
            
            # Check that a notification was created
            notif = conn.execute(
                "SELECT * FROM notifications WHERE user_id = ? AND type = 'family_verified'",
                (user1['id'],)
            ).fetchone()
            
            self.assertIsNotNone(notif)
            self.assertFalse(notif['read'])
            
            # Check user verification level (should still be 1 with only 1 verified relationship)
            user1_db = conn.execute(
                "SELECT * FROM users WHERE id = ?",
                (user1['id'],)
            ).fetchone()
            
            self.assertEqual(user1_db['verification_level'], 1)
            
            # Verify the second relationship
            verify_family_relationship(rel2['inverse_id'])
            
            # Check user verification level (should be 3 with 2 verified relationships)
            user1_db = conn.execute(
                "SELECT * FROM users WHERE id = ?",
                (user1['id'],)
            ).fetchone()
            
            self.assertEqual(user1_db['verification_level'], 3)
    
    def test_remove_family_relationship(self):
        """Test removing a family relationship."""
        # Get the user IDs
        with self.db.get_connection() as conn:
            user1 = conn.execute("SELECT id FROM users WHERE email = 'user1@test.com'").fetchone()
            user2 = conn.execute("SELECT id FROM users WHERE email = 'user2@test.com'").fetchone()
            user3 = conn.execute("SELECT id FROM users WHERE email = 'user3@test.com'").fetchone()
        
        # Add relationships
        rel1 = add_family_relationship(user1['id'], 'user2@test.com', 'child')
        rel2 = add_family_relationship(user1['id'], 'user3@test.com', 'sibling')
        
        # Verify both relationships
        verify_family_relationship(rel1['inverse_id'])
        verify_family_relationship(rel2['inverse_id'])
        
        # Check user verification level before removal
        with self.db.get_connection() as conn:
            user1_before = conn.execute(
                "SELECT * FROM users WHERE id = ?",
                (user1['id'],)
            ).fetchone()
            
            self.assertEqual(user1_before['verification_level'], 3)
        
        # Remove the first relationship
        result = remove_family_relationship(rel1['relationship_id'])
        
        # Check the result
        self.assertTrue(result['success'])
        
        # Check the database
        with self.db.get_connection() as conn:
            # Check that the relationship was removed
            rel1_db = conn.execute(
                "SELECT * FROM family_relationships WHERE id = ?", 
                (rel1['relationship_id'],)
            ).fetchone()
            
            self.assertIsNone(rel1_db)
            
            # Check that the inverse relationship was removed
            rel1_inv_db = conn.execute(
                "SELECT * FROM family_relationships WHERE id = ?", 
                (rel1['inverse_id'],)
            ).fetchone()
            
            self.assertIsNone(rel1_inv_db)
            
            # Check that the other relationship still exists
            rel2_db = conn.execute(
                "SELECT * FROM family_relationships WHERE id = ?", 
                (rel2['relationship_id'],)
            ).fetchone()
            
            self.assertIsNotNone(rel2_db)
            
            # Check that a notification was created
            notif = conn.execute(
                "SELECT * FROM notifications WHERE user_id = ? AND type = 'family_removed'",
                (user2['id'],)
            ).fetchone()
            
            self.assertIsNotNone(notif)
            
            # Check user verification level (should be 2 now with only 1 verified relationship)
            user1_after = conn.execute(
                "SELECT * FROM users WHERE id = ?",
                (user1['id'],)
            ).fetchone()
            
            self.assertEqual(user1_after['verification_level'], 2)
    
    def test_get_family_relationships(self):
        """Test getting family relationships for a user."""
        # Get the user IDs
        with self.db.get_connection() as conn:
            user1 = conn.execute("SELECT id FROM users WHERE email = 'user1@test.com'").fetchone()
            user2 = conn.execute("SELECT id FROM users WHERE email = 'user2@test.com'").fetchone()
            user3 = conn.execute("SELECT id FROM users WHERE email = 'user3@test.com'").fetchone()
        
        # Add relationships
        rel1 = add_family_relationship(user1['id'], 'user2@test.com', 'child')
        rel2 = add_family_relationship(user1['id'], 'user3@test.com', 'sibling')
        
        # Verify the first relationship
        verify_family_relationship(rel1['inverse_id'])
        
        # Get relationships
        relationships = get_family_relationships(user1['id'])
        
        # Check the results
        self.assertEqual(len(relationships), 2)
        
        # Verified relationships should come first
        self.assertTrue(relationships[0]['verified'])
        self.assertEqual(relationships[0]['relationship_type'], 'child')
        self.assertEqual(relationships[0]['relative_id'], user2['id'])
        
        self.assertFalse(relationships[1]['verified'])
        self.assertEqual(relationships[1]['relationship_type'], 'sibling')
        self.assertEqual(relationships[1]['relative_id'], user3['id'])
    
    def test_get_family_tree(self):
        """Test getting the family tree for a user."""
        # Get the user IDs
        with self.db.get_connection() as conn:
            user1 = conn.execute("SELECT id FROM users WHERE email = 'user1@test.com'").fetchone()
            user2 = conn.execute("SELECT id FROM users WHERE email = 'user2@test.com'").fetchone()
            user3 = conn.execute("SELECT id FROM users WHERE email = 'user3@test.com'").fetchone()
            user4 = conn.execute("SELECT id FROM users WHERE email = 'user4@test.com'").fetchone()
        
        # Add relationships
        # user1 is child of user2
        rel1 = add_family_relationship(user1['id'], 'user2@test.com', 'child')
        # user1 is sibling of user3
        rel2 = add_family_relationship(user1['id'], 'user3@test.com', 'sibling')
        # user1 is parent of user4
        rel3 = add_family_relationship(user1['id'], 'user4@test.com', 'parent')
        
        # Verify relationships
        verify_family_relationship(rel1['inverse_id'])
        verify_family_relationship(rel2['inverse_id'])
        # Don't verify the third relationship
        
        # Get family tree
        tree = get_family_tree(user1['id'])
        
        # Check the results
        self.assertIn('nodes', tree)
        self.assertIn('links', tree)
        
        # Check nodes (should be 4 users)
        self.assertEqual(len(tree['nodes']), 4)
        
        # Check links (should be 3 relationships)
        self.assertEqual(len(tree['links']), 3)
        
        # Find the current user node
        user1_node = None
        for node in tree['nodes']:
            if node['id'] == user1['id']:
                user1_node = node
                break
        
        self.assertIsNotNone(user1_node)
        self.assertTrue(user1_node['verified'])
        self.assertFalse(user1_node['pending'])
        
        # Find user4 node (unverified relationship)
        user4_node = None
        for node in tree['nodes']:
            if node['id'] == user4['id']:
                user4_node = node
                break
        
        self.assertIsNotNone(user4_node)
        self.assertFalse(user4_node['verified'])
        self.assertTrue(user4_node['pending'])
        self.assertEqual(user4_node['relationship'], 'parent')


class TestFamilyAPI(unittest.TestCase):
    """Test suite for family relationship API endpoints."""
    
    @classmethod
    def setUpClass(cls):
        """Set up the test environment once before all tests."""
        from app import create_app
        
        # Create a test Flask app
        app = create_app({
            'TESTING': True,
            'DATABASE': TEST_DB_PATH
        })
        
        # Create a test client
        cls.client = app.test_client()
        
        # Create a test database if it doesn't exist
        if not os.path.exists(TEST_DB_PATH):
            db = Database(TEST_DB_PATH)
            schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'schema.sql')
            db.init_db(schema_path)
            TestFamilyDatabase.create_test_users(db)
    
    @classmethod
    def tearDownClass(cls):
        """Clean up the test environment after all tests."""
        db = Database(TEST_DB_PATH)
        db.close_connections()
    
    def setUp(self):
        """Set up the test environment before each test."""
        self.db = Database(TEST_DB_PATH)
        
        # Clean up any existing relationships
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM family_relationships")
            conn.execute("DELETE FROM notifications WHERE type LIKE 'family%'")
            conn.commit()
        
        # Mock the authentication
        self.auth_patcher = patch('utils.security.verify_token')
        self.mock_auth = self.auth_patcher.start()
        
        # Get the user ID
        with self.db.get_connection() as conn:
            user1 = conn.execute("SELECT id FROM users WHERE email = 'user1@test.com'").fetchone()
            self.user_id = user1['id']
        
        # Set up mock return value
        self.mock_auth.return_value = {'user_id': self.user_id}
    
    def tearDown(self):
        """Clean up the test environment after each test."""
        # Clean up created relationships
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM family_relationships")
            conn.execute("DELETE FROM notifications WHERE type LIKE 'family%'")
            conn.commit()
        
        # Stop the auth patcher
        self.auth_patcher.stop()
    
    def test_get_tree(self):
        """Test the GET /api/family/tree endpoint."""
        # Add some relationships
        with self.db.get_connection() as conn:
            user2 = conn.execute("SELECT id FROM users WHERE email = 'user2@test.com'").fetchone()
            user3 = conn.execute("SELECT id FROM users WHERE email = 'user3@test.com'").fetchone()
        
        add_family_relationship(self.user_id, 'user2@test.com', 'child')
        add_family_relationship(self.user_id, 'user3@test.com', 'sibling')
        
        # Make the request
        response = self.client.get('/api/family/tree')
        
        # Check the response
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertTrue(data['success'])
        self.assertIn('data', data)
        self.assertIn('nodes', data['data'])
        self.assertIn('links', data['data'])
        
        # Should have 3 nodes (user1, user2, user3)
        self.assertEqual(len(data['data']['nodes']), 3)
        # Should have 2 links
        self.assertEqual(len(data['data']['links']), 2)
    
    def test_get_relationships(self):
        """Test the GET /api/family/relationships endpoint."""
        # Add some relationships
        add_family_relationship(self.user_id, 'user2@test.com', 'child')
        rel = add_family_relationship(self.user_id, 'user3@test.com', 'sibling')
        
        # Verify one relationship
        verify_family_relationship(rel['inverse_id'])
        
        # Make the request
        response = self.client.get('/api/family/relationships')
        
        # Check the response
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertTrue(data['success'])
        self.assertIn('data', data)
        
        # Should have 2 relationships
        self.assertEqual(len(data['data']), 2)
        
        # Verified relationships should come first
        self.assertTrue(data['data'][0]['verified'])
        self.assertEqual(data['data'][0]['relationship_type'], 'sibling')
        
        self.assertFalse(data['data'][1]['verified'])
        self.assertEqual(data['data'][1]['relationship_type'], 'child')
    
    def test_add_relationship(self):
        """Test the POST /api/family/add endpoint."""
        # Make the request
        response = self.client.post(
            '/api/family/add',
            json={
                'relative_email': 'user2@test.com',
                'relationship_type': 'child'
            }
        )
        
        # Check the response
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertTrue(data['success'])
        self.assertIn('relationship_id', data)
        self.assertIn('inverse_id', data)
        self.assertEqual(data['relationship_type'], 'child')
        
        # Check that the relationship was created in the database
        with self.db.get_connection() as conn:
            rel = conn.execute(
                """SELECT * FROM family_relationships 
                WHERE id = ?""", 
                (data['relationship_id'],)
            ).fetchone()
            
            self.assertIsNotNone(rel)
            self.assertEqual(rel['user_id'], self.user_id)
            self.assertEqual(rel['relationship_type'], 'child')
            self.assertFalse(rel['verified'])
    
    def test_add_relationship_invalid(self):
        """Test the POST /api/family/add endpoint with invalid data."""
        # Test with missing data
        response = self.client.post(
            '/api/family/add',
            json={
                'relative_email': 'user2@test.com'
                # Missing relationship_type
            }
        )
        
        self.assertEqual(response.status_code, 400)
        
        # Test with invalid relationship type
        response = self.client.post(
            '/api/family/add',
            json={
                'relative_email': 'user2@test.com',
                'relationship_type': 'invalid_type'
            }
        )
        
        self.assertEqual(response.status_code, 400)
        
        # Test with self-relationship
        with self.db.get_connection() as conn:
            user1 = conn.execute("SELECT email FROM users WHERE id = ?", (self.user_id,)).fetchone()
        
        response = self.client.post(
            '/api/family/add',
            json={
                'relative_email': user1['email'],
                'relationship_type': 'sibling'
            }
        )
        
        self.assertEqual(response.status_code, 400)
        
        # Test with non-existent user
        response = self.client.post(
            '/api/family/add',
            json={
                'relative_email': 'nonexistent@test.com',
                'relationship_type': 'sibling'
            }
        )
        
        self.assertEqual(response.status_code, 400)
    
    def test_verify_relationship(self):
        """Test the PUT /api/family/verify/:id endpoint."""
        # Add a relationship
        rel = add_family_relationship(self.user_id, 'user2@test.com', 'child')
        
        # Make the request
        response = self.client.put(f'/api/family/verify/{rel["inverse_id"]}')
        
        # Check the response
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertTrue(data['success'])
        
        # Check that the relationship was verified in the database
        with self.db.get_connection() as conn:
            rel_db = conn.execute(
                "SELECT * FROM family_relationships WHERE id = ?", 
                (rel['relationship_id'],)
            ).fetchone()
            
            self.assertIsNotNone(rel_db)
            self.assertTrue(rel_db['verified'])
    
    def test_verify_nonexistent_relationship(self):
        """Test the PUT /api/family/verify/:id endpoint with a non-existent relationship."""
        # Make the request with a non-existent ID
        response = self.client.put('/api/family/verify/9999')
        
        # Check the response
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        
        self.assertFalse(data['success'])
        self.assertIn('error', data)
    
    def test_remove_relationship(self):
        """Test the DELETE /api/family/remove/:id endpoint."""
        # Add a relationship
        rel = add_family_relationship(self.user_id, 'user2@test.com', 'child')
        
        # Make the request
        response = self.client.delete(f'/api/family/remove/{rel["relationship_id"]}')
        
        # Check the response
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertTrue(data['success'])
        
        # Check that the relationship was removed from the database
        with self.db.get_connection() as conn:
            rel_db = conn.execute(
                "SELECT * FROM family_relationships WHERE id = ?", 
                (rel['relationship_id'],)
            ).fetchone()
            
            self.assertIsNone(rel_db)
    
    def test_remove_nonexistent_relationship(self):
        """Test the DELETE /api/family/remove/:id endpoint with a non-existent relationship."""
        # Make the request with a non-existent ID
        response = self.client.delete('/api/family/remove/9999')
        
        # Check the response
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        
        self.assertFalse(data['success'])
        self.assertIn('error', data)


if __name__ == '__main__':
    unittest.main() 