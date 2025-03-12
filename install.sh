#!/bin/bash
# Proof of Humanity Installation Script
# This script automates the installation and setup process
# for the Proof of Humanity application on Unix-based systems

set -e  # Exit immediately if a command exits with a non-zero status

# Color definitions
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print banner
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════╗"
echo "║ Proof of Humanity - Installation Script        ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 is not installed. Please install Python 3 and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}Python 3 is installed.${NC}"

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo -e "${YELLOW}pip3 is not installed. Installing pip...${NC}"
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python3 get-pip.py
    rm get-pip.py
fi

echo -e "${GREEN}pip is installed.${NC}"

# Check if virtualenv is installed
if ! python3 -m pip show virtualenv &> /dev/null; then
    echo -e "${YELLOW}virtualenv is not installed. Installing virtualenv...${NC}"
    python3 -m pip install virtualenv
fi

echo -e "${GREEN}virtualenv is installed.${NC}"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv venv
else
    echo -e "${GREEN}Virtual environment already exists.${NC}"
fi

echo -e "${YELLOW}Activating virtual environment...${NC}"
source venv/bin/activate

# Upgrade pip inside virtualenv
echo -e "${YELLOW}Upgrading pip...${NC}"
pip install --upgrade pip

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
pip install -r requirements.txt

# Create necessary directories
echo -e "${YELLOW}Creating required directories...${NC}"
mkdir -p logs uploads/profile_images uploads/documents instance

# Set up environment variables
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo -e "${YELLOW}Setting up environment variables...${NC}"
    cp .env.example .env
    
    # Generate a random secret key
    SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
    
    # Replace placeholder with the generated key
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/replace_with_secure_random_key/$SECRET_KEY/g" .env
    else
        # Linux
        sed -i "s/replace_with_secure_random_key/$SECRET_KEY/g" .env
    fi
    
    echo -e "${GREEN}Environment variables set up.${NC}"
else
    echo -e "${GREEN}Environment file already exists or example file not found.${NC}"
fi

# Initialize database
echo -e "${YELLOW}Initializing database...${NC}"
if [ -f "init_db.py" ]; then
    python init_db.py
    echo -e "${GREEN}Database initialized.${NC}"
else
    echo -e "${RED}Database initialization script not found. Skipping database initialization.${NC}"
fi

# Make setup.py executable
if [ -f "setup.py" ]; then
    chmod +x setup.py
fi

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo -e "To activate the virtual environment, run: ${YELLOW}source venv/bin/activate${NC}"
echo -e "To start the application, run: ${YELLOW}flask run${NC}"
echo ""

# Deactivate virtual environment
deactivate

exit 0 