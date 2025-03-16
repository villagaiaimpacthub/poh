#!/bin/bash
# run_dev.sh - Start development services for Proof of Humanity

# Force kill any remaining processes on ports to ensure clean start
echo "Forcefully terminating any processes using required ports..."
lsof -ti:5003 | xargs kill -9 2>/dev/null || true
lsof -ti:1025 | xargs kill -9 2>/dev/null || true
sleep 2

# Add better signal handling
trap cleanup SIGINT SIGTERM EXIT

cleanup() {
    echo "Shutting down services..."
    if [ -n "$FLASK_PID" ] && ps -p $FLASK_PID > /dev/null; then
        echo "Terminating Flask server (PID: $FLASK_PID)"
        kill $FLASK_PID 2>/dev/null || kill -9 $FLASK_PID 2>/dev/null
    fi
    
    if [ -n "$MAIL_PID" ] && ps -p $MAIL_PID > /dev/null; then
        echo "Terminating Mail server (PID: $MAIL_PID)"
        kill $MAIL_PID 2>/dev/null || kill -9 $MAIL_PID 2>/dev/null
    fi
    
    # Final cleanup
    pkill -f "python.*flask run" 2>/dev/null || true
    pkill -f "python.*smtpd" 2>/dev/null || true
    
    echo "Cleanup complete"
}

# Ensure ports are available
check_port() {
    if lsof -i ":$1" > /dev/null 2>&1; then
        echo "Port $1 is still in use. Attempting to force close..."
        lsof -ti:$1 | xargs kill -9 2>/dev/null || true
        sleep 1
        
        # Check again
        if lsof -i ":$1" > /dev/null 2>&1; then
            echo "Error: Port $1 is still in use. Cannot start service."
            return 1
        fi
    fi
    return 0
}

# Check critical ports
check_port 5003 || exit 1
check_port 1025 || exit 1

# Export Flask development settings
export FLASK_APP=app.py
export FLASK_ENV=development
export FLASK_DEBUG=1

# Start Flask development server 
echo "Starting Flask development server..."
python3 -m flask run --host=0.0.0.0 --port=5003 &
FLASK_PID=$!

# Verify Flask server started successfully
sleep 2
if ! ps -p $FLASK_PID > /dev/null; then
    echo "Flask server failed to start. Please check logs for errors."
    cleanup
    exit 1
fi

# Log the actual PID for debugging
echo "Flask server PID: $FLASK_PID"

# Start mail server for testing in the background
echo "Starting development mail server..."
python3 -m smtpd -n -c DebuggingServer localhost:1025 &
MAIL_PID=$!
echo "Mail server PID: $MAIL_PID"

echo "Development services started!"
echo "Flask server: http://localhost:5003"
echo "Mail server: localhost:1025"

# Keep the script running and handle CTRL+C gracefully
echo "Press Ctrl+C to stop all services"
wait $FLASK_PID 