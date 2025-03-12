import sqlite3
import os
import re
import threading
import time
import logging
from functools import wraps
from contextlib import contextmanager
from typing import List, Dict, Any, Optional, Tuple, Union, Callable
from flask import current_app, g

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('database')

class DatabaseError(Exception):
    """Custom exception for database-related errors."""
    pass

class ConnectionPool:
    """
    A simple connection pool for SQLite connections.
    Manages a configurable number of connections for thread-safe database access.
    """
    def __init__(self, database_path: str, max_connections: int = 5, timeout: int = 10):
        """
        Initialize the connection pool.
        
        Args:
            database_path: Path to the SQLite database file
            max_connections: Maximum number of connections to keep in the pool
            timeout: Timeout in seconds for acquiring a connection
        """
        self.database_path = database_path
        self.max_connections = max_connections
        self.timeout = timeout
        self.connections = []
        self.in_use = set()
        self.lock = threading.RLock()
        self.connection_count = 0
        
        # Only create directories if not using in-memory database
        if database_path != ":memory:":
            os.makedirs(os.path.dirname(database_path), exist_ok=True)

    def _create_connection(self) -> sqlite3.Connection:
        """Create a new SQLite connection with appropriate settings."""
        try:
            conn = sqlite3.connect(
                self.database_path,
                detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
                check_same_thread=False,
                timeout=self.timeout
            )
            # Enable foreign keys
            conn.execute("PRAGMA foreign_keys = ON")
            # Enable extended result codes for better error messages
            conn.execute("PRAGMA full_column_names = ON")
            # Configure for better concurrency and less lock contention
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
            conn.execute("PRAGMA cache_size = 10000")
            conn.execute("PRAGMA temp_store = MEMORY")
            conn.execute("PRAGMA busy_timeout = 10000")  # 10 second busy timeout
            # Row factory returns results as dictionaries
            conn.row_factory = self._dict_factory
            
            self.connection_count += 1
            logger.debug(f"Created new connection #{self.connection_count}")
            return conn
        except sqlite3.Error as e:
            logger.error(f"Error creating database connection: {e}")
            raise DatabaseError(f"Failed to create database connection: {e}")
    
    @staticmethod
    def _dict_factory(cursor: sqlite3.Cursor, row: tuple) -> dict:
        """Convert a row to a dictionary with column names as keys."""
        if cursor.description is None:
            return {}
        return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
    
    def get_connection(self) -> sqlite3.Connection:
        """
        Get a connection from the pool or create a new one if necessary.
        
        Returns:
            An SQLite connection
        
        Raises:
            DatabaseError: If no connection is available within the timeout period
        """
        attempt = 0
        max_attempts = 3
        
        while attempt < max_attempts:
            try:
                with self.lock:
                    # Try to reuse an existing connection
                    if self.connections:
                        conn = self.connections.pop()
                        # Test the connection before returning it
                        try:
                            conn.execute("SELECT 1").fetchone()
                            self.in_use.add(conn)
                            return conn
                        except sqlite3.Error:
                            # Connection is broken, close it and create a new one
                            try:
                                conn.close()
                            except:
                                pass
                    
                    # Create a new connection if we haven't reached the limit
                    if len(self.in_use) < self.max_connections:
                        conn = self._create_connection()
                        self.in_use.add(conn)
                        return conn
                
                # Wait for a connection to become available
                start_time = time.time()
                while time.time() - start_time < self.timeout / max_attempts:
                    with self.lock:
                        if self.connections:
                            conn = self.connections.pop()
                            try:
                                conn.execute("SELECT 1").fetchone()
                                self.in_use.add(conn)
                                return conn
                            except sqlite3.Error:
                                # Connection is broken, close it and try again
                                try:
                                    conn.close()
                                except:
                                    pass
                    time.sleep(0.05)
                
                attempt += 1
                
            except Exception as e:
                logger.error(f"Error in get_connection (attempt {attempt}): {e}")
                attempt += 1
                time.sleep(0.1)
        
        # If we've reached here, we couldn't get a connection
        raise DatabaseError("Could not acquire a database connection after multiple attempts")
    
    def return_connection(self, conn: sqlite3.Connection) -> None:
        """
        Return a connection to the pool.
        
        Args:
            conn: The connection to return
        """
        if conn is None:
            return
            
        try:
            with self.lock:
                if conn in self.in_use:
                    # Test connection before returning to pool
                    try:
                        conn.execute("SELECT 1").fetchone()
                        self.in_use.remove(conn)
                        # Only keep connections up to max_connections
                        if len(self.connections) < self.max_connections:
                            self.connections.append(conn)
                        else:
                            conn.close()
                    except sqlite3.Error:
                        # Connection is broken, remove and close
                        self.in_use.remove(conn)
                        try:
                            conn.close()
                        except:
                            pass
                else:
                    # If the connection isn't tracked, close it
                    try:
                        conn.close()
                    except:
                        pass
        except Exception as e:
            logger.error(f"Error returning connection to pool: {e}")
            try:
                conn.close()
            except:
                pass
    
    def close_all(self) -> None:
        """Close all connections in the pool."""
        with self.lock:
            # Close all available connections
            for conn in self.connections:
                try:
                    conn.close()
                except Exception as e:
                    logger.error(f"Error closing connection: {e}")
            self.connections = []
            
            # Close all in-use connections
            for conn in list(self.in_use):
                try:
                    conn.close()
                except Exception as e:
                    logger.error(f"Error closing in-use connection: {e}")
            self.in_use = set()
            
            logger.info("All database connections closed")

    def release_connection(self, connection):
        """Release a connection back to the pool."""
        with self.lock:
            if connection in self.connections:
                self.connections.remove(connection)
                connection.close()


class Database:
    """Database class for managing SQLite database connections and operations."""
    
    def __init__(self, database_path=None):
        """Initialize database connection."""
        # If database_path is provided, use it directly
        if database_path:
            self.database_path = database_path
        else:
            # Try to get from Flask app context, or use a default
            try:
                from flask import current_app
                self.database_path = current_app.config['DATABASE_PATH']
            except (RuntimeError, ImportError):
                # Working outside of application context, use a default path
                self.database_path = os.environ.get('DATABASE_PATH', 'instance/poh.sqlite')
        
        # Ensure directory exists
        if self.database_path != ":memory:":
            os.makedirs(os.path.dirname(self.database_path), exist_ok=True)
        
        # Create a connection pool for this database
        self.pool = ConnectionPool(self.database_path)
        
        # Thread-local storage for connections outside Flask context
        self.local = threading.local()
    
    def get_db(self):
        """
        Get a database connection.
        If we're in a Flask context, use g, otherwise use the connection pool.
        """
        try:
            # Try to get db from Flask's g object
            from flask import g, current_app
            if 'db' not in g:
                g.db = self.pool.get_connection()
            return g.db
        except (RuntimeError, ImportError):
            # Working outside of Flask context, use thread-local storage
            if not hasattr(self.local, 'db'):
                self.local.db = self.pool.get_connection()
            return self.local.db

    def cursor(self):
        """Get a cursor for the current database connection."""
        return self.get_db().cursor()

    def execute_query(self, query: str, params: tuple = None) -> None:
        """
        Execute a query without returning results.
        
        Args:
            query: SQL query to execute
            params: Query parameters (optional)
        """
        try:
            with self.get_db() as conn:
                cursor = conn.cursor()
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                conn.commit()
        except sqlite3.Error as e:
            logger.error(f"Error executing query: {e}")
            raise DatabaseError(f"Failed to execute query: {e}")

    def execute_query_fetch_one(self, query: str, params: tuple = None) -> Optional[dict]:
        """
        Execute a query and return a single result.
        
        Args:
            query: SQL query to execute
            params: Query parameters (optional)
            
        Returns:
            A single row as a dictionary, or None if no results
        """
        try:
            with self.get_db() as conn:
                cursor = conn.cursor()
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                result = cursor.fetchone()
                return result
        except sqlite3.Error as e:
            logger.error(f"Error executing query: {e}")
            raise DatabaseError(f"Failed to execute query: {e}")

    def execute_query_fetch_all(self, query: str, params: tuple = None) -> List[dict]:
        """
        Execute a query and return all results.
        
        Args:
            query: SQL query to execute
            params: Query parameters (optional)
            
        Returns:
            List of rows as dictionaries
        """
        try:
            with self.get_db() as conn:
                cursor = conn.cursor()
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                return cursor.fetchall()
        except sqlite3.Error as e:
            logger.error(f"Error executing query: {e}")
            raise DatabaseError(f"Failed to execute query: {e}")
    
    def __enter__(self):
        """Context manager entry."""
        self.conn = self.get_db()
        return self.conn
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        if hasattr(self, 'conn'):
            self.pool.return_connection(self.conn)
            del self.conn
    
    def close(self):
        """Close the database connection."""
        try:
            # Try to use Flask application context if available
            from flask import g
            if hasattr(g, 'db_conn') and g.db_conn is not None:
                g.db_conn.close()
                g.db_conn = None
        except (RuntimeError, ImportError):
            # Not in Flask context, return connection to pool if we have one
            if hasattr(self.local, 'conn') and self.local.conn is not None:
                self.pool.return_connection(self.local.conn)
                self.local.conn = None
        except Exception as e:
            # Log but don't raise - closing should be silent
            logger.error(f"Error closing database connection: {e}")
    
    def init_db(self, schema_path=None):
        """Initialize the database with the schema."""
        connection = None
        try:
            connection = self.get_db()
            
            if schema_path is None:
                schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'schema.sql')
            
            with open(schema_path, 'r') as f:
                connection.executescript(f.read())
                connection.commit()
                
            logger.info("Database initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing database: {e}")
            if connection:
                connection.rollback()
            raise
        finally:
            self.close()
    
    @contextmanager
    def transaction(self):
        """Context manager for database transactions."""
        connection = None
        try:
            connection = self.get_db()
            yield connection
            connection.commit()
        except Exception as e:
            logger.error(f"Transaction error: {e}")
            if connection:
                connection.rollback()
            raise
        finally:
            self.close()
    
    def fetch_one(self, query, params=None):
        """Execute a query and fetch one result."""
        connection = None
        cursor = None
        try:
            connection = self.get_db()
            cursor = connection.cursor()
            
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            return cursor.fetchone()
        except sqlite3.Error as e:
            logger.error(f"Database error fetching one row: {e}")
            logger.error(f"Query was: {query}")
            if params:
                logger.error(f"Parameters were: {params}")
            raise
        finally:
            if cursor:
                try:
                    cursor.close()
                except:
                    pass
            self.close()
    
    def fetch_all(self, query, params=None):
        """
        Execute a query and return all results.
        
        Args:
            query: SQL query string
            params: Query parameters
            
        Returns:
            List of dictionaries containing the results
        """
        with self.get_db() as db:
            cursor = db.cursor()
            try:
                cursor.execute(query, params or ())
                return cursor.fetchall()
            except sqlite3.Error as e:
                logger.error(f"Error executing query: {e}")
                raise


# Specialized query functions for the Proof of Humanity application

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Get a user by ID.
    
    Args:
        user_id: User ID
        
    Returns:
        User data or None if not found
    """
    db = Database()
    return db.fetch_one(
        "SELECT * FROM users WHERE id = ?",
        (user_id,)
    )

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Get a user by email.
    
    Args:
        email: User email
        
    Returns:
        User data or None if not found
    """
    db = Database()
    return db.fetch_one(
        "SELECT * FROM users WHERE email = ?",
        (email.lower(),)
    )

def create_user(name: str, email: str, password_hash: str) -> int:
    """
    Create a new user.
    
    Args:
        name: User name
        email: User email
        password_hash: Hashed password
        
    Returns:
        User ID
    """
    db = Database()
    user_data = {
        'name': name,
        'email': email.lower(),
        'password_hash': password_hash,
        'verification_level': 0,
        'email_verified': False,
        'created_at': int(time.time()),
        'updated_at': int(time.time())
    }
    return db.execute_query(
        "INSERT INTO users ({}) VALUES ({}) RETURNING id".format(
            ', '.join(user_data.keys()),
            ', '.join(['?'] * len(user_data))
        ),
        tuple(user_data.values())
    )

def update_user_verification_level(user_id: int, level: int) -> bool:
    """
    Update a user's verification level.
    
    Args:
        user_id: User ID
        level: New verification level
        
    Returns:
        True if successful, False otherwise
    """
    db = Database()
    rows_affected = db.execute_query(
        "UPDATE users SET verification_level = ?, updated_at = ? WHERE id = ?",
        (level, int(time.time()), user_id)
    )
    return rows_affected > 0

def mark_email_verified(user_id: int) -> bool:
    """
    Mark a user's email as verified.
    
    Args:
        user_id: User ID
        
    Returns:
        True if successful, False otherwise
    """
    db = Database()
    rows_affected = db.execute_query(
        "UPDATE users SET email_verified = TRUE, updated_at = ? WHERE id = ?",
        (int(time.time()), user_id)
    )
    return rows_affected > 0

def get_family_relationships(user_id: int) -> List[Dict[str, Any]]:
    """
    Get all family relationships for a user.
    
    Args:
        user_id: User ID
        
    Returns:
        List of relationship data
    """
    db = Database()
    return db.fetch_all(
        """
        SELECT r.*, u.name, u.email, u.verification_level 
        FROM family_relationships r
        JOIN users u ON r.relative_id = u.id
        WHERE r.user_id = ?
        ORDER BY r.verified DESC, r.created_at DESC
        """,
        (user_id,)
    )

def get_family_tree(user_id: int) -> Dict[str, Any]:
    """
    Get the family tree for a user.
    
    Args:
        user_id: User ID
        
    Returns:
        Dictionary with nodes and links for the family tree
    """
    db = Database()
    
    # Get user's own info
    user = get_user_by_id(user_id)
    if not user:
        return {"nodes": [], "links": []}
    
    # Get all relatives (direct and indirect)
    relationships = db.fetch_all(
        """
        WITH RECURSIVE
        relatives(user_id, relative_id, path, relationship_type, verified, relation_id) AS (
            -- Direct relationships
            SELECT 
                r.user_id, 
                r.relative_id, 
                user_id || ',' || relative_id AS path,
                r.relationship_type,
                r.verified,
                r.id
            FROM family_relationships r
            WHERE r.user_id = ?
            
            UNION
            
            -- Relatives of relatives (up to 3 levels deep)
            SELECT 
                r.user_id, 
                r.relative_id, 
                relatives.path || ',' || r.relative_id AS path,
                r.relationship_type,
                r.verified,
                r.id
            FROM family_relationships r
            JOIN relatives ON r.user_id = relatives.relative_id
            WHERE relatives.path NOT LIKE '%' || r.relative_id || '%'
            AND LENGTH(relatives.path) - LENGTH(REPLACE(relatives.path, ',', '')) < 3
        )
        SELECT DISTINCT 
            r.user_id, 
            r.relative_id, 
            r.relationship_type,
            r.verified,
            r.relation_id,
            u1.name AS user_name,
            u1.email AS user_email,
            u1.verification_level AS user_verification_level,
            u2.name AS relative_name,
            u2.email AS relative_email,
            u2.verification_level AS relative_verification_level
        FROM relatives r
        JOIN users u1 ON r.user_id = u1.id
        JOIN users u2 ON r.relative_id = u2.id
        """,
        (user_id,)
    )
    
    # Build the family tree
    nodes = [
        {
            "id": user_id,
            "name": user["name"],
            "email": user["email"],
            "verification_level": user["verification_level"],
            "verified": True,
            "pending": False,
            "added_date": user["created_at"]
        }
    ]
    
    links = []
    processed_users = {user_id}
    
    for rel in relationships:
        # Add the user node if not already added
        if rel["user_id"] not in processed_users:
            nodes.append({
                "id": rel["user_id"],
                "name": rel["user_name"],
                "email": rel["user_email"],
                "verification_level": rel["user_verification_level"],
                "verified": True,
                "pending": False
            })
            processed_users.add(rel["user_id"])
        
        # Add the relative node if not already added
        if rel["relative_id"] not in processed_users:
            nodes.append({
                "id": rel["relative_id"],
                "name": rel["relative_name"],
                "email": rel["relative_email"],
                "verification_level": rel["relative_verification_level"],
                "verified": rel["verified"],
                "pending": not rel["verified"],
                "relationship": rel["relationship_type"]
            })
            processed_users.add(rel["relative_id"])
        
        # Add the link
        links.append({
            "id": rel["relation_id"],
            "source": rel["user_id"],
            "target": rel["relative_id"],
            "relationship": rel["relationship_type"],
            "verified": rel["verified"]
        })
    
    return {
        "nodes": nodes,
        "links": links
    }

def add_family_relationship(user_id: int, relative_email: str, relationship_type: str) -> Dict[str, Any]:
    """
    Add a family relationship.
    
    Args:
        user_id: User ID
        relative_email: Email of the relative
        relationship_type: Type of relationship
        
    Returns:
        Dictionary with relationship data or error
    """
    db = Database()
    
    # Check if the relative exists
    relative = get_user_by_email(relative_email)
    if not relative:
        return {"success": False, "error": "User not found"}
    
    relative_id = relative["id"]
    
    # Check if the relationship already exists
    existing = db.fetch_one(
        "SELECT * FROM family_relationships WHERE user_id = ? AND relative_id = ?",
        (user_id, relative_id)
    )
    
    if existing:
        return {"success": False, "error": "Relationship already exists"}
    
    # Get the inverse relationship type
    inverse_relationship = get_inverse_relationship(relationship_type)
    
    with db.transaction() as conn:
        # Add the relationship
        now = int(time.time())
        relationship_id = db.execute_query(
            "INSERT INTO family_relationships (user_id, relative_id, relationship_type, verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
            (user_id, relative_id, relationship_type, False, now, now)
        )
        
        # Add the inverse relationship
        inverse_id = db.execute_query(
            "INSERT INTO family_relationships (user_id, relative_id, relationship_type, verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
            (relative_id, user_id, inverse_relationship, False, now, now)
        )
        
        # Create a notification for the relative
        db.execute_query(
            "INSERT INTO notifications (user_id, type, message, data, read, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (relative_id, 'family_request', f"New family relationship request: {relationship_type}", f'{{"user_id": {user_id}, "relationship_id": {inverse_id}, "relationship_type": "{inverse_relationship}"}}', False, now)
        )
    
    return {
        "success": True,
        "relationship_id": relationship_id,
        "relationship_type": relationship_type,
        "relative_id": relative_id,
        "relative_name": relative["name"],
        "inverse_id": inverse_id
    }

def verify_family_relationship(relationship_id: int) -> Dict[str, Any]:
    """
    Verify a family relationship.
    
    Args:
        relationship_id: ID of the relationship to verify
        
    Returns:
        Dictionary with status and relationship data
    """
    db = Database()
    
    # Get the relationship
    relationship = db.fetch_one(
        "SELECT * FROM family_relationships WHERE id = ?",
        (relationship_id,)
    )
    
    if not relationship:
        return {"success": False, "error": "Relationship not found"}
    
    user_id = relationship["user_id"]
    relative_id = relationship["relative_id"]
    
    # Get the inverse relationship
    inverse = db.fetch_one(
        "SELECT * FROM family_relationships WHERE user_id = ? AND relative_id = ?",
        (relative_id, user_id)
    )
    
    if not inverse:
        return {"success": False, "error": "Inverse relationship not found"}
    
    with db.transaction() as conn:
        # Mark both relationships as verified
        now = int(time.time())
        
        conn.execute(
            "UPDATE family_relationships SET verified = TRUE, updated_at = ? WHERE id = ?",
            (now, relationship_id)
        )
        
        conn.execute(
            "UPDATE family_relationships SET verified = TRUE, updated_at = ? WHERE id = ?",
            (now, inverse["id"])
        )
        
        # Count how many verified relationships the user has
        result = conn.execute(
            "SELECT COUNT(*) as count FROM family_relationships WHERE user_id = ? AND verified = TRUE",
            (user_id,)
        ).fetchone()
        
        verified_count = result["count"]
        
        # Update verification level if enough verified relationships
        if verified_count >= 2:
            conn.execute(
                """
                UPDATE users 
                SET verification_level = CASE
                    WHEN verification_level < 3 THEN 3
                    ELSE verification_level
                END,
                updated_at = ?
                WHERE id = ?
                """,
                (now, user_id)
            )
        
        # Create a notification for the relative
        conn.execute(
            "INSERT INTO notifications (user_id, type, message, data, read, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (relative_id, 'family_verified', f"Family relationship verified", f'{{"user_id": {user_id}, "relationship_id": {inverse["id"]}}}', False, now)
        )
    
    return {
        "success": True,
        "relationship_id": relationship_id,
        "inverse_id": inverse["id"],
        "user_id": user_id,
        "relative_id": relative_id
    }

def remove_family_relationship(relationship_id: int) -> Dict[str, Any]:
    """
    Remove a family relationship.
    
    Args:
        relationship_id: ID of the relationship to remove
        
    Returns:
        Dictionary with status and removed relationship data
    """
    db = Database()
    
    # Get the relationship
    relationship = db.fetch_one(
        "SELECT * FROM family_relationships WHERE id = ?",
        (relationship_id,)
    )
    
    if not relationship:
        return {"success": False, "error": "Relationship not found"}
    
    user_id = relationship["user_id"]
    relative_id = relationship["relative_id"]
    
    # Get the inverse relationship
    inverse = db.fetch_one(
        "SELECT * FROM family_relationships WHERE user_id = ? AND relative_id = ?",
        (relative_id, user_id)
    )
    
    with db.transaction() as conn:
        # Delete both relationships
        conn.execute(
            "DELETE FROM family_relationships WHERE id = ?",
            (relationship_id,)
        )
        
        if inverse:
            conn.execute(
                "DELETE FROM family_relationships WHERE id = ?",
                (inverse["id"],)
            )
        
        # Count how many verified relationships the user has now
        result = conn.execute(
            "SELECT COUNT(*) as count FROM family_relationships WHERE user_id = ? AND verified = TRUE",
            (user_id,)
        ).fetchone()
        
        verified_count = result["count"]
        
        # Update verification level if not enough verified relationships
        if verified_count < 2:
            conn.execute(
                """
                UPDATE users 
                SET verification_level = CASE
                    WHEN verification_level = 3 THEN 2
                    ELSE verification_level
                END,
                updated_at = ?
                WHERE id = ?
                """,
                (int(time.time()), user_id)
            )
        
        # Create a notification for the relative
        if inverse:
            conn.execute(
                "INSERT INTO notifications (user_id, type, message, data, read, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (relative_id, 'family_removed', f"Family relationship removed", f'{{"user_id": {user_id}}}', False, int(time.time()))
            )
    
    return {
        "success": True,
        "user_id": user_id,
        "relative_id": relative_id
    }

def get_inverse_relationship(relationship_type: str) -> str:
    """
    Get the inverse relationship type.
    
    Args:
        relationship_type: Original relationship type
        
    Returns:
        Inverse relationship type
    """
    inverse_map = {
        'parent': 'child',
        'child': 'parent',
        'spouse': 'spouse',
        'sibling': 'sibling',
        'grandparent': 'grandchild',
        'grandchild': 'grandparent',
        'aunt/uncle': 'niece/nephew',
        'niece/nephew': 'aunt/uncle',
        'cousin': 'cousin'
    }
    
    return inverse_map.get(relationship_type, 'other')

def get_verification_requests(user_id: int, include_completed: bool = False) -> List[Dict[str, Any]]:
    """
    Get verification requests for a user.
    
    Args:
        user_id: User ID
        include_completed: Whether to include completed verifications
        
    Returns:
        List of verification request data
    """
    db = Database()
    
    if include_completed:
        return db.fetch_all(
            """
            SELECT v.*, u.name as verifier_name
            FROM verification_requests v
            LEFT JOIN users u ON v.verifier_id = u.id
            WHERE v.user_id = ?
            ORDER BY v.created_at DESC
            """,
            (user_id,)
        )
    else:
        return db.fetch_all(
            """
            SELECT v.*, u.name as verifier_name
            FROM verification_requests v
            LEFT JOIN users u ON v.verifier_id = u.id
            WHERE v.user_id = ? AND v.status = 'pending'
            ORDER BY v.created_at DESC
            """,
            (user_id,)
        )

def create_verification_request(user_id: int, verification_type: str, data: str = None) -> int:
    """
    Create a verification request.
    
    Args:
        user_id: User ID
        verification_type: Type of verification (e.g., 'identity', 'video', 'document')
        data: Additional data for the verification
        
    Returns:
        Verification request ID
    """
    db = Database()
    
    now = int(time.time())
    request_data = {
        'user_id': user_id,
        'type': verification_type,
        'status': 'pending',
        'data': data,
        'created_at': now,
        'updated_at': now
    }
    
    return db.execute_query(
        "INSERT INTO verification_requests ({}) VALUES ({}) RETURNING id".format(
            ', '.join(request_data.keys()),
            ', '.join(['?'] * len(request_data))
        ),
        tuple(request_data.values())
    )

def get_did_document(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Get a user's DID document.
    
    Args:
        user_id: User ID
        
    Returns:
        DID document data or None if not found
    """
    db = Database()
    return db.fetch_one(
        "SELECT * FROM did_documents WHERE user_id = ?",
        (user_id,)
    )

def get_did_by_identifier(did_identifier: str) -> Optional[Dict[str, Any]]:
    """
    Get a DID document by its identifier.
    
    Args:
        did_identifier: DID identifier
        
    Returns:
        DID document data or None if not found
    """
    db = Database()
    return db.fetch_one(
        "SELECT * FROM did_documents WHERE identifier = ?",
        (did_identifier,)
    )

def create_did_document(user_id: int, identifier: str, document: str, keys: str = None) -> int:
    """
    Create a DID document.
    
    Args:
        user_id: User ID
        identifier: DID identifier
        document: DID document as JSON string
        keys: Encrypted private keys (optional)
        
    Returns:
        DID document ID
    """
    db = Database()
    
    now = int(time.time())
    did_data = {
        'user_id': user_id,
        'identifier': identifier,
        'document': document,
        'keys': keys,
        'created_at': now,
        'updated_at': now
    }
    
    return db.execute_query(
        "INSERT INTO did_documents ({}) VALUES ({}) RETURNING id".format(
            ', '.join(did_data.keys()),
            ', '.join(['?'] * len(did_data))
        ),
        tuple(did_data.values())
    )

def add_notification(user_id: int, notification_type: str, message: str, data: str = None) -> int:
    """
    Add a notification for a user.
    
    Args:
        user_id: User ID
        notification_type: Type of notification
        message: Notification message
        data: Additional data for the notification
        
    Returns:
        Notification ID
    """
    db = Database()
    
    notification_data = {
        'user_id': user_id,
        'type': notification_type,
        'message': message,
        'data': data,
        'read': False,
        'created_at': int(time.time())
    }
    
    return db.execute_query(
        "INSERT INTO notifications ({}) VALUES ({}) RETURNING id".format(
            ', '.join(notification_data.keys()),
            ', '.join(['?'] * len(notification_data))
        ),
        tuple(notification_data.values())
    )

def get_notifications(user_id: int, unread_only: bool = False) -> List[Dict[str, Any]]:
    """
    Get notifications for a user.
    
    Args:
        user_id: User ID
        unread_only: Whether to retrieve only unread notifications
        
    Returns:
        List of notification data
    """
    db = Database()
    
    if unread_only:
        return db.fetch_all(
            "SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC",
            (user_id,)
        )
    else:
        return db.fetch_all(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
            (user_id,)
        )

def mark_notification_read(notification_id: int) -> bool:
    """
    Mark a notification as read.
    
    Args:
        notification_id: Notification ID
        
    Returns:
        True if successful, False otherwise
    """
    db = Database()
    rows_affected = db.execute_query(
        "UPDATE notifications SET read = TRUE WHERE id = ?",
        (notification_id,)
    )
    return rows_affected > 0

def mark_all_notifications_read(user_id: int) -> bool:
    """
    Mark all notifications for a user as read.
    
    Args:
        user_id: User ID
        
    Returns:
        True if successful, False otherwise
    """
    db = Database()
    rows_affected = db.execute_query(
        "UPDATE notifications SET read = TRUE WHERE user_id = ? AND read = 0",
        (user_id,)
    )
    return rows_affected > 0


# Initialize the database singleton
db = Database() 