"""
Test configuration and fixtures for the Proof of Humanity application.
"""

import os
import sys
import pytest
import tempfile
import sqlite3
from pathlib import Path

# Add the project root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import application after adding to path
try:
    from app import create_app
except ImportError:
    # Mock app creation function for when app.py doesn't exist yet
    def create_app(config=None):
        from flask import Flask
        app = Flask(__name__)
        app.config.update(config or {})
        return app

@pytest.fixture
def app():
    """Create and configure a Flask app for testing."""
    # Create a temporary file to isolate the database for each test
    db_fd, db_path = tempfile.mkstemp()
    app = create_app({
        'TESTING': True,
        'DATABASE_URI': f'sqlite:///{db_path}',
        'WTF_CSRF_ENABLED': False,
        'DEBUG': True,
        'SECRET_KEY': 'test_secret_key',
        'SERVER_NAME': 'localhost.localdomain'  # This is needed for url_for() to work in tests
    })

    # Create the database and load test data
    with app.app_context():
        init_test_database(db_path)

    yield app

    # Close and remove the temporary database
    os.close(db_fd)
    os.unlink(db_path)

@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture
def runner(app):
    """A test CLI runner for the app."""
    return app.test_cli_runner()

@pytest.fixture
def auth(client):
    """Authentication helper for tests."""
    class AuthActions:
        def __init__(self, client):
            self._client = client
            self._token = None

        def login(self, username='testuser', password='password'):
            return self._client.post(
                '/login',
                data={'username': username, 'password': password},
                follow_redirects=True
            )

        def logout(self):
            return self._client.get('/logout', follow_redirects=True)

        def register(self, username='newuser', email='new@example.com', password='password'):
            return self._client.post(
                '/register',
                data={
                    'username': username,
                    'email': email,
                    'password': password,
                    'confirm_password': password
                },
                follow_redirects=True
            )
            
        def get_token(self, username='testuser'):
            """Get a JWT token for API authentication."""
            import jwt
            import datetime
            
            # Generate a token that expires in 1 hour
            token = jwt.encode(
                {
                    'sub': username,
                    'iat': datetime.datetime.utcnow(),
                    'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
                },
                'test_secret_key',
                algorithm='HS256'
            )
            self._token = token
            return token
            
        def get_auth_headers(self):
            """Get headers with JWT token for API requests."""
            if not self._token:
                self._token = self.get_token()
            return {'Authorization': f'Bearer {self._token}'}

    return AuthActions(client)

@pytest.fixture
def db_connection():
    """Create a database connection for testing."""
    # Create a temporary file to isolate the database for each test
    db_fd, db_path = tempfile.mkstemp()
    
    # Create a connection to the database
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    # Initialize the database
    init_test_database(db_path, conn)
    
    yield conn
    
    # Close the connection and remove the temporary database
    conn.close()
    os.close(db_fd)
    os.unlink(db_path)

def init_test_database(db_path, conn=None):
    """Initialize the test database with schema and test data."""
    should_close = False
    if conn is None:
        conn = sqlite3.connect(db_path)
        should_close = True
    
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        is_admin BOOLEAN DEFAULT 0,
        avatar TEXT,
        verification_level INTEGER DEFAULT 0,
        did TEXT UNIQUE
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS family_relationships (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        related_user_id INTEGER NOT NULL,
        relationship_type TEXT NOT NULL,
        is_verified BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_at TIMESTAMP,
        verification_method TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (related_user_id) REFERENCES users (id),
        UNIQUE (user_id, related_user_id)
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS verification_requests (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        verifier_id INTEGER,
        request_type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (verifier_id) REFERENCES users (id)
    )
    ''')
    
    # Add test users - password is 'password'
    cursor.execute('''
    INSERT INTO users 
    (username, email, password_hash, first_name, last_name, is_active, is_admin, verification_level) 
    VALUES 
    ('testuser', 'test@example.com', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'Test', 'User', 1, 0, 1)
    ''')
    
    cursor.execute('''
    INSERT INTO users 
    (username, email, password_hash, first_name, last_name, is_active, is_admin, verification_level) 
    VALUES 
    ('testadmin', 'admin@example.com', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'Admin', 'User', 1, 1, 3)
    ''')
    
    # Add test family relationships
    cursor.execute('''
    INSERT INTO family_relationships 
    (user_id, related_user_id, relationship_type, is_verified) 
    VALUES 
    (1, 2, 'colleague', 1)
    ''')
    
    conn.commit()
    
    if should_close:
        conn.close() 