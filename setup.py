#!/usr/bin/env python
"""
Setup script for the Proof of Humanity application.
This script handles:
1. Virtual environment creation
2. Dependency installation
3. Database initialization
4. Configuration setup
"""

import os
import subprocess
import sys
import shutil
import random
import string
import json
from pathlib import Path

# Configuration
VENV_DIR = "venv"
PYTHON = "python3"
PIP = f"{VENV_DIR}/bin/pip" if os.name != "nt" else f"{VENV_DIR}\\Scripts\\pip"
PYTHON_VENV = f"{VENV_DIR}/bin/python" if os.name != "nt" else f"{VENV_DIR}\\Scripts\\python"
REQUIRED_DIRS = ["logs", "uploads", "uploads/profile_images", "uploads/documents", "instance"]

def generate_secret_key(length=32):
    """Generate a random secret key."""
    chars = string.ascii_letters + string.digits + '!@#$%^&*()-_=+[]{}|;:,.<>?'
    return ''.join(random.choice(chars) for _ in range(length))

def create_virtual_environment():
    """Create a virtual environment for the application."""
    print("Creating virtual environment...")
    if os.path.exists(VENV_DIR):
        print(f"Virtual environment already exists in {VENV_DIR}")
        return
    
    try:
        subprocess.run([PYTHON, "-m", "venv", VENV_DIR], check=True)
        print(f"Virtual environment created in {VENV_DIR}")
    except subprocess.CalledProcessError as e:
        print(f"Error creating virtual environment: {e}")
        sys.exit(1)

def install_dependencies():
    """Install dependencies from requirements.txt."""
    print("Installing dependencies...")
    try:
        subprocess.run([PIP, "install", "--upgrade", "pip"], check=True)
        subprocess.run([PIP, "install", "-r", "requirements.txt"], check=True)
        print("Dependencies installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"Error installing dependencies: {e}")
        sys.exit(1)

def create_required_directories():
    """Create required directories if they don't exist."""
    print("Creating required directories...")
    for directory in REQUIRED_DIRS:
        os.makedirs(directory, exist_ok=True)
        print(f"Directory {directory} created or already exists")

def setup_environment():
    """Set up environment variables from .env.example."""
    print("Setting up environment variables...")
    env_example_path = Path(".env.example")
    env_path = Path(".env")
    
    if not env_example_path.exists():
        print(".env.example file not found. Skipping environment setup.")
        return
    
    if env_path.exists():
        print(".env file already exists. Skipping environment setup.")
        return
    
    with open(env_example_path, 'r') as example_file:
        env_content = example_file.read()
    
    # Replace placeholder values with generated values
    env_content = env_content.replace("replace_with_secure_random_key", generate_secret_key())
    
    with open(env_path, 'w') as env_file:
        env_file.write(env_content)
    
    print(".env file created from .env.example")

def initialize_database():
    """Initialize the database with schema and initial data."""
    print("Initializing database...")
    try:
        # Run database initialization script
        subprocess.run([PYTHON_VENV, "init_db.py"], check=True)
        print("Database initialized successfully")
    except subprocess.CalledProcessError as e:
        print(f"Error initializing database: {e}")
        print("You may need to run 'python init_db.py' manually after setup completes.")

def setup_webrtc_config():
    """Create initial WebRTC configuration."""
    print("Setting up WebRTC configuration...")
    config_path = Path("instance/webrtc_config.json")
    
    if config_path.exists():
        print("WebRTC configuration already exists. Skipping.")
        return
    
    # Create basic configuration
    config = {
        "stun_servers": ["stun:stun.l.google.com:19302"],
        "turn_servers": [],
        "ice_transport_policy": "all",
        "bundle_policy": "balanced",
        "rtcp_mux_policy": "require",
        "peer_identity": None,
        "certificates": []
    }
    
    # Ensure directory exists
    os.makedirs(config_path.parent, exist_ok=True)
    
    # Write config
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    
    print("WebRTC configuration created")

def setup_application():
    """Main setup function that orchestrates all setup steps."""
    print("Starting Proof of Humanity application setup...")
    
    create_virtual_environment()
    install_dependencies()
    create_required_directories()
    setup_environment()
    setup_webrtc_config()
    initialize_database()
    
    print("\nSetup completed successfully!")
    print("\nTo start the application, run:")
    if os.name != "nt":
        print("source venv/bin/activate")
    else:
        print(r"venv\Scripts\activate")
    print("flask run")

if __name__ == "__main__":
    setup_application() 