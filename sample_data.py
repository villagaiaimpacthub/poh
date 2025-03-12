#!/usr/bin/env python
# sample_data.py - Generate sample data for testing

import os
import sys
import random
from datetime import datetime, timedelta
import hashlib
import json
import uuid

# Add the project root to the Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from app import create_app
from models.database import Database

def generate_sample_data():
    """Generate sample data for the Proof of Humanity application."""
    print("Generating sample data...")
    
    # Create app context
    app = create_app('development')
    with app.app_context():
        db = Database()
        
        # Create sample users
        users = []
        for i in range(1, 11):
            username = f"user{i}"
            email = f"user{i}@example.com"
            password_hash = hashlib.sha256(f"password{i}".encode()).hexdigest()
            
            # Check if user already exists
            existing_user = db.execute_query_fetch_one(
                "SELECT id FROM users WHERE username = ? OR email = ?",
                params=(username, email)
            )
            
            if existing_user:
                user_id = existing_user['id']
                print(f"User {username} already exists with ID {user_id}")
            else:
                user_id = db.execute_query(
                    """
                    INSERT INTO users 
                    (username, email, password_hash, first_name, last_name, date_of_birth, 
                    is_verified, verification_level, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    params=(
                        username, 
                        email, 
                        password_hash,
                        f"First{i}",
                        f"Last{i}",
                        (datetime.now() - timedelta(days=365*25 + i*100)).strftime('%Y-%m-%d'),
                        i % 4 == 0,  # Every 4th user is verified
                        min(i % 4, 3),  # Verification levels 0-3
                        datetime.now().isoformat(),
                        datetime.now().isoformat()
                    )
                )
                print(f"Created user {username} with ID {user_id}")
            
            users.append(user_id)
        
        # Create family relationships
        for i, user_id in enumerate(users):
            # Connect each user with 1-3 other users
            num_connections = random.randint(1, 3)
            for _ in range(num_connections):
                relative_id = random.choice([u for u in users if u != user_id])
                relationship_types = ['parent', 'child', 'sibling', 'spouse', 'cousin']
                relationship_type = random.choice(relationship_types)
                
                # Check if relationship already exists
                existing_relation = db.execute_query_fetch_one(
                    "SELECT id FROM family_relations WHERE user_id = ? AND relative_id = ?",
                    params=(user_id, relative_id)
                )
                
                if not existing_relation:
                    relation_id = db.execute_query(
                        """
                        INSERT INTO family_relations
                        (user_id, relative_id, relationship_type, is_verified, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        params=(
                            user_id,
                            relative_id,
                            relationship_type,
                            random.choice([0, 1]),  # Randomly verified
                            datetime.now().isoformat(),
                            datetime.now().isoformat()
                        )
                    )
                    print(f"Created {relationship_type} relationship between users {user_id} and {relative_id}")
        
        # Create verification attempts
        for user_id in users:
            # 50% chance to have verification attempts
            if random.random() < 0.5:
                num_attempts = random.randint(1, 3)
                for _ in range(num_attempts):
                    verification_types = ['initial', 'family', 'document', 'video']
                    status_options = ['pending', 'approved', 'rejected']
                    
                    attempt_id = db.execute_query(
                        """
                        INSERT INTO verification_attempts
                        (user_id, verifier_id, status, verification_type, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        params=(
                            user_id,
                            random.choice(users),  # Random verifier
                            random.choice(status_options),
                            random.choice(verification_types),
                            datetime.now().isoformat(),
                            datetime.now().isoformat()
                        )
                    )
                    print(f"Created verification attempt {attempt_id} for user {user_id}")
        
        # Create DIDs for verified users
        for user_id in users:
            # Check if user is verified
            user = db.execute_query_fetch_one(
                "SELECT is_verified FROM users WHERE id = ?",
                params=(user_id,)
            )
            
            if user and user['is_verified']:
                # Check if DID already exists
                existing_did = db.execute_query_fetch_one(
                    "SELECT id FROM did_documents WHERE user_id = ?",
                    params=(user_id,)
                )
                
                if not existing_did:
                    did_id = f"did:poh:{uuid.uuid4()}"
                    document = {
                        "id": did_id,
                        "controller": did_id,
                        "verificationMethod": [
                            {
                                "id": f"{did_id}#keys-1",
                                "type": "Ed25519VerificationKey2020",
                                "controller": did_id,
                                "publicKeyMultibase": "z" + uuid.uuid4().hex
                            }
                        ],
                        "authentication": [
                            f"{did_id}#keys-1"
                        ]
                    }
                    
                    did_doc_id = db.execute_query(
                        """
                        INSERT INTO did_documents
                        (user_id, did_identifier, document_json, public_key, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        params=(
                            user_id,
                            did_id,
                            json.dumps(document),
                            "sample_public_key_" + str(user_id),
                            datetime.now().isoformat(),
                            datetime.now().isoformat()
                        )
                    )
                    print(f"Created DID {did_id} for verified user {user_id}")
        
        print("Sample data generation complete!")

if __name__ == "__main__":
    generate_sample_data() 