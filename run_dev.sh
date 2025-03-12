#!/bin/bash
# run_dev.sh - Start development services for Proof of Humanity

# Start Flask development server in the background
echo "Starting Flask development server..."
flask run --host=0.0.0.0 --port=5000 &
FLASK_PID=$!

# Start mail server for testing in the background
echo "Starting development mail server..."
python -m smtpd -n -c DebuggingServer localhost:1025 &
MAIL_PID=$!

# Provide a simple TURN server for WebRTC testing
echo "Starting simple TURN server..."
# This is a placeholder - you may need to install a proper TURN server
# or use a service like Twilio for WebRTC testing

echo "Development services started!"
echo "Flask server: http://localhost:5000"
echo "Mail server: localhost:1025"

# Handle exit
function cleanup {
    echo "Shutting down services..."
    kill $FLASK_PID
    kill $MAIL_PID
    echo "Cleanup complete"
}

trap cleanup EXIT

# Keep the script running
echo "Press Ctrl+C to stop all services"
wait 