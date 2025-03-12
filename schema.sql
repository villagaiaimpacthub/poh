-- Schema for Proof of Humanity application

-- Drop existing tables
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS family_relations;
DROP TABLE IF EXISTS verification_attempts;
DROP TABLE IF EXISTS did_documents;

-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    date_of_birth TEXT,
    profile_picture TEXT,
    bio TEXT,
    is_verified BOOLEAN DEFAULT 0,
    verification_level INTEGER DEFAULT 0,
    email_verified BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Family relations table
CREATE TABLE family_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    relative_id INTEGER NOT NULL,
    relationship_type TEXT NOT NULL, -- parent, child, sibling, spouse, cousin
    is_verified BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (relative_id) REFERENCES users (id)
);

-- Verification attempts table
CREATE TABLE verification_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    verifier_id INTEGER,
    status TEXT NOT NULL, -- pending, approved, rejected
    verification_type TEXT NOT NULL, -- initial, family, document, video
    metadata TEXT, -- JSON data related to this verification attempt
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (verifier_id) REFERENCES users (id)
);

-- DID documents table
CREATE TABLE did_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    did_identifier TEXT UNIQUE NOT NULL,
    document_json TEXT NOT NULL,
    public_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verification ON users(verification_level);
CREATE INDEX idx_family_relations_user_id ON family_relations(user_id);
CREATE INDEX idx_family_relations_relative_id ON family_relations(relative_id);
CREATE INDEX idx_verification_attempts_user_id ON verification_attempts(user_id);
CREATE INDEX idx_did_documents_user_id ON did_documents(user_id);
CREATE INDEX idx_did_documents_identifier ON did_documents(did_identifier); 