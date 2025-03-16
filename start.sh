#!/bin/bash

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
fi

# Set Flask port
export FLASK_RUN_PORT=5003
export FLASK_APP=app.py
export FLASK_ENV=development

# Kill any existing process on port 5003
lsof -ti:5003 | xargs kill -9 2>/dev/null || true

# Create a log directory if it doesn't exist
mkdir -p logs

# Run the Flask application with Python 3 in the background and log output
nohup python3 app.py > logs/flask.log 2>&1 &

# Save the PID
echo $! > .flask.pid

# Wait a moment for the server to start
sleep 2

# Check if the server is running
if ps -p $(cat .flask.pid) > /dev/null; then
    echo "Server started successfully on port 5003"
    echo "View logs with: tail -f logs/flask.log"
else
    echo "Server failed to start. Check logs/flask.log for details"
    exit 1
fi 