"""
Tests for the database module of the Proof of Humanity application.
"""

import pytest
import sqlite3
import datetime
import json
from unittest.mock import patch, MagicMock

# Import the database module directly
try:
    from models.database import Database, ConnectionPool, DatabaseError
except ImportError:
    # Mock classes for when the module doesn't exist yet
    class DatabaseError(Exception):
        pass
    
    class ConnectionPool:
        def __init__(self, *args, **kwargs):
            pass
        
        def get_connection(self):
            return None
        
        def return_connection(self, conn):
            pass
    
    class Database:
        def __init__(self, *args, **kwargs):
            pass


def test_connection_pool_creation(db_connection):
    """Test creating a new connection pool."""
    # Use in-memory database for testing
    pool = ConnectionPool(database_path=":memory:", max_connections=5)
    assert pool.max_connections == 5
    assert len(pool.connections) == 0
    assert not pool.in_use

def test_connection_pool_get_connection():
    """Test getting a connection from the pool."""
    pool = ConnectionPool(database_path=":memory:", max_connections=3)
    
    # Get a connection from the pool
    conn = pool.get_connection()
    assert conn is not None
    assert isinstance(conn, sqlite3.Connection)
    assert len(pool.in_use) == 1
    
    # Release the connection back to the pool
    pool.return_connection(conn)
    assert len(pool.in_use) == 0

def test_connection_pool_max_connections():
    """Test that the connection pool respects max_connections limit."""
    pool = ConnectionPool(":memory:", max_connections=2)
    
    # Get two connections (should work)
    conn1 = pool.get_connection()
    conn2 = pool.get_connection()
    
    # Try to get a third connection (should fail)
    with pytest.raises(DatabaseError):
        conn3 = pool.get_connection()
    
    # Return one connection
    pool.return_connection(conn1)
    
    # Now getting a third connection should work
    conn3 = pool.get_connection()
    
    # Clean up
    pool.return_connection(conn2)
    pool.return_connection(conn3)
    pool.close_all()

def test_database_initialize(db_connection):
    """Test database initialization."""
    db = Database(database_path=":memory:")
    assert db is not None
    assert db.pool is not None

def test_database_execute_query():
    """Test executing a simple query."""
    db = Database(db_path=":memory:")
    
    # Create a test table
    db.execute_query(
        "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)"
    )
    
    # Insert some data
    db.execute_query(
        "INSERT INTO test (name, value) VALUES (?, ?)",
        params=("test1", 100)
    )
    
    # Query the data
    result = db.execute_query_fetch_all(
        "SELECT * FROM test WHERE name = ?",
        params=("test1",)
    )
    
    assert len(result) == 1
    assert result[0]["name"] == "test1"
    assert result[0]["value"] == 100

def test_database_transaction():
    """Test transaction support."""
    db = Database(db_path=":memory:")
    
    # Create a test table
    db.execute_query(
        "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)"
    )
    
    # Start a transaction
    with db.transaction():
        # Insert some data
        db.execute_query(
            "INSERT INTO test (name, value) VALUES (?, ?)",
            params=("test1", 100)
        )
        db.execute_query(
            "INSERT INTO test (name, value) VALUES (?, ?)",
            params=("test2", 200)
        )
    
    # Query the data to verify it was committed
    result = db.execute_query_fetch_all("SELECT COUNT(*) as count FROM test")
    assert result[0]["count"] == 2

def test_database_transaction_rollback():
    """Test transaction rollback on exception."""
    db = Database(db_path=":memory:")
    
    # Create a test table
    db.execute_query(
        "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)"
    )
    
    # Start a transaction that will fail
    try:
        with db.transaction():
            # Insert some data
            db.execute_query(
                "INSERT INTO test (name, value) VALUES (?, ?)",
                params=("test1", 100)
            )
            # This will raise an exception
            raise ValueError("Forced error to test rollback")
    except ValueError:
        pass
    
    # Query the data to verify it was rolled back
    result = db.execute_query_fetch_all("SELECT COUNT(*) as count FROM test")
    assert result[0]["count"] == 0

def test_get_user_by_id(db_connection):
    """Test retrieving a user by ID."""
    # We'll use the test database that has already been populated in the fixture
    db = Database(connection=db_connection)
    
    # The test database should have a user with ID 1
    user = db.get_user_by_id(1)
    assert user is not None
    assert user["username"] == "testuser"
    assert user["email"] == "test@example.com"

def test_get_user_by_username(db_connection):
    """Test retrieving a user by username."""
    db = Database(connection=db_connection)
    
    user = db.get_user_by_username("testuser")
    assert user is not None
    assert user["id"] == 1
    assert user["email"] == "test@example.com"

def test_get_user_by_email(db_connection):
    """Test retrieving a user by email."""
    db = Database(connection=db_connection)
    
    user = db.get_user_by_email("test@example.com")
    assert user is not None
    assert user["id"] == 1
    assert user["username"] == "testuser"

def test_create_user(db_connection):
    """Test creating a new user."""
    db = Database(connection=db_connection)
    
    # Create a new user
    new_user_id = db.create_user(
        username="newuser",
        email="new@example.com",
        password_hash="hashed_password",
        first_name="New",
        last_name="User"
    )
    
    assert new_user_id is not None
    assert new_user_id > 0
    
    # Verify the user was created
    user = db.get_user_by_id(new_user_id)
    assert user is not None
    assert user["username"] == "newuser"
    assert user["email"] == "new@example.com"
    assert user["first_name"] == "New"
    assert user["last_name"] == "User"

def test_update_user(db_connection):
    """Test updating a user."""
    db = Database(connection=db_connection)
    
    # Update the test user
    success = db.update_user(
        user_id=1,
        first_name="Updated",
        last_name="User",
        avatar="/path/to/new/avatar.jpg"
    )
    
    assert success is True
    
    # Verify the user was updated
    user = db.get_user_by_id(1)
    assert user["first_name"] == "Updated"
    assert user["last_name"] == "User"
    assert user["avatar"] == "/path/to/new/avatar.jpg"

def test_get_family_relationships(db_connection):
    """Test retrieving family relationships for a user."""
    db = Database(connection=db_connection)
    
    # Get relationships for user 1
    relationships = db.get_family_relationships(1)
    
    assert relationships is not None
    assert len(relationships) == 1  # Should have one relationship from the test data
    assert relationships[0]["related_user_id"] == 2
    assert relationships[0]["relationship_type"] == "colleague"
    assert relationships[0]["is_verified"] == 1

def test_add_family_relationship(db_connection):
    """Test adding a new family relationship."""
    db = Database(connection=db_connection)
    
    # Add a new relationship
    relationship_id = db.add_family_relationship(
        user_id=1,
        related_user_id=2,
        relationship_type="friend"
    )
    
    assert relationship_id is not None
    
    # Verify the relationship was added (this will be a new one or the existing one updated)
    relationships = db.get_family_relationships(1)
    found = False
    for rel in relationships:
        if rel["related_user_id"] == 2 and rel["relationship_type"] == "friend":
            found = True
            break
    
    assert found

def test_verify_relationship(db_connection):
    """Test verifying a family relationship."""
    db = Database(connection=db_connection)
    
    # The test data should have a relationship with ID 1
    success = db.verify_relationship(
        relationship_id=1,
        verification_method="in-person"
    )
    
    assert success is True
    
    # Verify the relationship was updated
    relationships = db.get_family_relationships(1)
    relationship = next((r for r in relationships if r["id"] == 1), None)
    
    assert relationship is not None
    assert relationship["is_verified"] == 1
    assert relationship["verification_method"] == "in-person"

def test_remove_relationship(db_connection):
    """Test removing a family relationship."""
    db = Database(connection=db_connection)
    
    # The test data should have a relationship with ID 1
    success = db.remove_relationship(1)
    
    assert success is True
    
    # Verify the relationship was removed
    relationships = db.get_family_relationships(1)
    relationship = next((r for r in relationships if r["id"] == 1), None)
    
    assert relationship is None

def test_get_did_document(db_connection):
    """Test retrieving a DID document."""
    db = Database(connection=db_connection)
    
    # Insert a test DID document
    did = "did:poh:test123"
    document = {
        "id": did,
        "controller": did,
        "verificationMethod": []
    }
    
    cursor = db_connection.cursor()
    cursor.execute(
        """
        INSERT INTO did_documents (user_id, did, document, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (1, did, json.dumps(document), datetime.datetime.now().isoformat(), datetime.datetime.now().isoformat())
    )
    db_connection.commit()
    
    # Retrieve the document
    result = db.get_did_document(1)
    
    assert result is not None
    assert result["did"] == did
    loaded_doc = json.loads(result["document"])
    assert loaded_doc["id"] == did
    assert loaded_doc["controller"] == did

def test_update_did_document(db_connection):
    """Test updating a DID document."""
    db = Database(connection=db_connection)
    
    # Insert a test DID document
    did = "did:poh:test456"
    document = {
        "id": did,
        "controller": did,
        "verificationMethod": []
    }
    
    cursor = db_connection.cursor()
    cursor.execute(
        """
        INSERT INTO did_documents (user_id, did, document, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (2, did, json.dumps(document), datetime.datetime.now().isoformat(), datetime.datetime.now().isoformat())
    )
    db_connection.commit()
    
    # Update the document
    updated_document = {
        "id": did,
        "controller": did,
        "verificationMethod": [
            {
                "id": f"{did}#keys-1",
                "type": "Ed25519VerificationKey2020",
                "controller": did,
                "publicKeyMultibase": "test_public_key"
            }
        ]
    }
    
    success = db.update_did_document(2, json.dumps(updated_document))
    
    assert success is True
    
    # Verify the document was updated
    result = db.get_did_document(2)
    loaded_doc = json.loads(result["document"])
    
    assert loaded_doc["verificationMethod"] is not None
    assert len(loaded_doc["verificationMethod"]) == 1
    assert loaded_doc["verificationMethod"][0]["publicKeyMultibase"] == "test_public_key"

def test_create_verification_request(db_connection):
    """Test creating a verification request."""
    db = Database(connection=db_connection)
    
    request_id = db.create_verification_request(
        user_id=1,
        verifier_id=2,
        request_type="family",
        metadata={"relationship": "friend"}
    )
    
    assert request_id is not None
    assert request_id > 0
    
    # Verify the request was created
    cursor = db_connection.cursor()
    cursor.execute("SELECT * FROM verification_requests WHERE id = ?", (request_id,))
    request = cursor.fetchone()
    
    assert request is not None
    assert request["user_id"] == 1
    assert request["verifier_id"] == 2
    assert request["request_type"] == "family"
    assert request["status"] == "pending"
    
def test_update_verification_request(db_connection):
    """Test updating a verification request."""
    db = Database(connection=db_connection)
    
    # Insert a test verification request
    cursor = db_connection.cursor()
    cursor.execute(
        """
        INSERT INTO verification_requests 
        (user_id, verifier_id, request_type, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            1, 2, "family", "pending", 
            datetime.datetime.now().isoformat(),
            datetime.datetime.now().isoformat()
        )
    )
    db_connection.commit()
    request_id = cursor.lastrowid
    
    # Update the request
    success = db.update_verification_request(
        request_id=request_id,
        status="approved",
        notes="Verified through video call"
    )
    
    assert success is True
    
    # Verify the request was updated
    cursor.execute("SELECT * FROM verification_requests WHERE id = ?", (request_id,))
    request = cursor.fetchone()
    
    assert request is not None
    assert request["status"] == "approved" 