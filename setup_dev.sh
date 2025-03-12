#!/bin/bash
# setup_dev.sh - Development environment setup for Proof of Humanity

echo "Setting up development environment for Proof of Humanity..."

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create necessary directories
mkdir -p instance
mkdir -p logs
mkdir -p uploads/profile_pictures
mkdir -p uploads/verification_documents

# Initialize the database
flask init-db

# Create a development .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating development .env file..."
    cat > .env << EOL
FLASK_APP=app.py
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')
DATABASE_PATH=instance/poh.sqlite
MAIL_SERVER=localhost
MAIL_PORT=1025
MAIL_USE_TLS=false
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_DEFAULT_SENDER=noreply@proofofhumanity.id
TURN_SERVER_URL=turn:localhost:3478
TURN_SERVER_USERNAME=username
TURN_SERVER_CREDENTIAL=password
EOL
fi

echo "Development environment setup complete!"
echo "To start the application, run: flask run"
echo "To start a mail server for testing, run: python -m smtpd -n -c DebuggingServer localhost:1025" 