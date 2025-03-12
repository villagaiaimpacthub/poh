#!/usr/bin/env python
"""
Database initialization script for Proof of Humanity.
This script:
1. Creates all database tables based on the models
2. Adds initial/seed data to the database
3. Creates admin user if specified
"""

import os
import sys
import sqlite3
import datetime
import getpass
import hashlib
import uuid
from pathlib import Path

# Add the project directory to the path so we can import modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Try to load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("python-dotenv not installed. Environment variables from .env file will not be loaded.")

# Database file path
DB_PATH = os.getenv('DATABASE_URI', 'sqlite:///poh.db')
if DB_PATH.startswith('sqlite:///'):
    DB_PATH = DB_PATH[len('sqlite:///'):]

def create_schema(conn):
    """Create the database schema."""
    print(f"Creating database schema in {DB_PATH}...")
    
    cursor = conn.cursor()
    
    # Create users table
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
    
    # Create family_relationships table
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
    
    # Create verification_requests table
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
    
    # Create did_documents table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS did_documents (
        id INTEGER PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        did TEXT UNIQUE NOT NULL,
        document TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        private_key_encrypted TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')
    
    # Create sessions table for WebRTC sessions
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS video_sessions (
        id INTEGER PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        peer_id INTEGER,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ice_servers TEXT,
        session_data TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (peer_id) REFERENCES users (id)
    )
    ''')
    
    # Add indexes for better performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_did ON users (did)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_family_relationships_user_id ON family_relationships (user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_family_relationships_related_user_id ON family_relationships (related_user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON verification_requests (user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests (status)')
    
    conn.commit()
    print("Database schema created successfully.")

def add_demo_data(conn):
    """Add demo data to the database."""
    print("Adding demo data to the database...")
    
    cursor = conn.cursor()
    
    # Check if users table is empty
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] > 0:
        print("Database already contains data. Skipping demo data creation.")
        return
    
    # Create demo users
    # Hash passwords for demo users (in production, use proper password hashing like bcrypt)
    demo_password_hash = hashlib.sha256("demo123".encode()).hexdigest()
    
    users = [
        (
            'johndoe', 
            'john.doe@example.com', 
            demo_password_hash, 
            'John', 
            'Doe', 
            datetime.datetime.now().isoformat(), 
            datetime.datetime.now().isoformat(), 
            1,
            0,
            '/static/images/default-avatar.png',
            2,  # Verification level
            f'did:poh:{uuid.uuid4().hex}'
        ),
        (
            'janedoe', 
            'jane.doe@example.com', 
            demo_password_hash, 
            'Jane', 
            'Doe', 
            datetime.datetime.now().isoformat(), 
            datetime.datetime.now().isoformat(), 
            1,
            0,
            '/static/images/default-avatar.png',
            1,  # Verification level
            f'did:poh:{uuid.uuid4().hex}'
        ),
        (
            'samsmith', 
            'sam.smith@example.com', 
            demo_password_hash, 
            'Sam', 
            'Smith', 
            datetime.datetime.now().isoformat(), 
            datetime.datetime.now().isoformat(), 
            1,
            0,
            '/static/images/default-avatar.png',
            0,  # Verification level
            f'did:poh:{uuid.uuid4().hex}'
        )
    ]
    
    cursor.executemany('''
    INSERT INTO users 
    (username, email, password_hash, first_name, last_name, created_at, updated_at, is_active, is_admin, avatar, verification_level, did) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', users)
    
    # Create demo family relationships
    family_relationships = [
        (
            1,  # John Doe
            2,  # Jane Doe
            'spouse',
            1,  # Verified
            datetime.datetime.now().isoformat(),
            'video'
        ),
        (
            2,  # Jane Doe
            1,  # John Doe
            'spouse',
            1,  # Verified
            datetime.datetime.now().isoformat(),
            'video'
        ),
        (
            1,  # John Doe
            3,  # Sam Smith
            'friend',
            0,  # Not verified
            None,
            None
        )
    ]
    
    cursor.executemany('''
    INSERT INTO family_relationships 
    (user_id, related_user_id, relationship_type, is_verified, verified_at, verification_method) 
    VALUES (?, ?, ?, ?, ?, ?)
    ''', family_relationships)
    
    # Create demo verification requests
    verification_requests = [
        (
            3,  # Sam Smith
            1,  # John Doe (verifier)
            'family',
            'pending',
            datetime.datetime.now().isoformat(),
            datetime.datetime.now().isoformat(),
            (datetime.datetime.now() + datetime.timedelta(days=7)).isoformat(),
            '{"relationship": "friend", "message": "Please verify our friendship!"}'
        ),
        (
            3,  # Sam Smith
            None,  # No specific verifier
            'document',
            'pending',
            datetime.datetime.now().isoformat(),
            datetime.datetime.now().isoformat(),
            (datetime.datetime.now() + datetime.timedelta(days=7)).isoformat(),
            '{"document_type": "passport", "status": "submitted"}'
        )
    ]
    
    cursor.executemany('''
    INSERT INTO verification_requests 
    (user_id, verifier_id, request_type, status, created_at, updated_at, expires_at, metadata) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', verification_requests)
    
    # Create demo DID documents
    for i in range(1, 4):
        cursor.execute('SELECT did FROM users WHERE id = ?', (i,))
        user_did = cursor.fetchone()[0]
        
        # Simple DID document structure
        did_document = {
            "@context": "https://www.w3.org/ns/did/v1",
            "id": user_did,
            "verificationMethod": [
                {
                    "id": f"{user_did}#keys-1",
                    "type": "Ed25519VerificationKey2018",
                    "controller": user_did,
                    "publicKeyBase58": f"mock_public_key_for_user_{i}"
                }
            ],
            "authentication": [
                f"{user_did}#keys-1"
            ],
            "assertionMethod": [
                f"{user_did}#keys-1"
            ]
        }
        
        cursor.execute('''
        INSERT INTO did_documents 
        (user_id, did, document, created_at, updated_at, private_key_encrypted) 
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            i, 
            user_did, 
            str(did_document), 
            datetime.datetime.now().isoformat(), 
            datetime.datetime.now().isoformat(),
            f"mock_encrypted_private_key_for_user_{i}"
        ))
    
    conn.commit()
    print("Demo data added successfully.")

def create_admin_user(conn):
    """Create an admin user if needed."""
    print("\nDo you want to create an admin user? (y/n)")
    create_admin = input().strip().lower()
    
    if create_admin != 'y':
        print("Skipping admin user creation.")
        return
    
    cursor = conn.cursor()
    
    # Check if admin user already exists
    cursor.execute('SELECT COUNT(*) FROM users WHERE is_admin = 1')
    if cursor.fetchone()[0] > 0:
        print("Admin user already exists. Skipping admin user creation.")
        return
    
    # Get admin user details
    username = input("Enter admin username: ").strip()
    email = input("Enter admin email: ").strip()
    password = getpass.getpass("Enter admin password: ")
    confirm_password = getpass.getpass("Confirm admin password: ")
    
    if password != confirm_password:
        print("Passwords don't match. Skipping admin user creation.")
        return
    
    # Hash password (in production, use proper password hashing like bcrypt)
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # Create admin user
    cursor.execute('''
    INSERT INTO users 
    (username, email, password_hash, first_name, last_name, created_at, updated_at, is_active, is_admin, verification_level) 
    VALUES (?, ?, ?, 'Admin', 'User', ?, ?, 1, 1, 3)
    ''', (
        username, 
        email, 
        password_hash, 
        datetime.datetime.now().isoformat(), 
        datetime.datetime.now().isoformat()
    ))
    
    conn.commit()
    print("Admin user created successfully.")

def initialize_database():
    """Initialize the database."""
    db_dir = os.path.dirname(DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir)
    
    # Check if database already exists
    db_exists = os.path.exists(DB_PATH)
    
    # Connect to the database (creates the file if it doesn't exist)
    conn = sqlite3.connect(DB_PATH)
    
    # Create schema
    create_schema(conn)
    
    # Add demo data if it's a new database
    if not db_exists:
        add_demo_data(conn)
    
    # Optionally create admin user
    create_admin_user(conn)
    
    conn.close()
    print(f"\nDatabase initialization complete. Database located at: {DB_PATH}")

if __name__ == '__main__':
    initialize_database() 