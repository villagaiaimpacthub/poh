import os
import logging
import time
from flask import Flask, render_template, g, request, redirect, url_for, flash, abort, jsonify, session, send_from_directory, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_cors import CORS
import sqlite3
from datetime import datetime
from models.database import Database

# Configure logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

# Add logging directory configuration
LOGS_DIR = os.path.join(os.path.dirname(__file__), 'logs')
if not os.path.exists(LOGS_DIR):
    os.makedirs(LOGS_DIR)

def write_network_log(data):
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = os.path.join(LOGS_DIR, f'network_viz_{timestamp}.txt')
    with open(log_file, 'w') as f:
        f.write(f"=== Network Visualization Log - {timestamp} ===\n\n")
        f.write(data)
    return log_file

def create_app(test_config=None):
    # Create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    
    # Configure CORS with expanded settings for Safari compatibility
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
    
    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass
    
    # Load configuration
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'dev_key_highly_secret'),
        DATABASE_PATH=os.path.join(app.instance_path, 'poh.sqlite'),
        MAX_CONTENT_LENGTH=8 * 1024 * 1024,  # 8MB max upload
        TEMPLATES_AUTO_RELOAD=True,
        JSON_SORT_KEYS=False,  # Preserve order of keys in JSON responses
        SESSION_COOKIE_SECURE=False,  # Set to True in production with HTTPS
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        SEND_FILE_MAX_AGE_DEFAULT=31536000,  # 1 year cache for static files
        PERMANENT_SESSION_LIFETIME=3600,  # 1 hour
    )

    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)
        
    # Initialize database
    db = Database(app.config['DATABASE_PATH'])
    
    # Before request - ensure db connection is available
    @app.before_request
    def before_request():
        g.request_start_time = time.time()
        g.db = db
        
        # Ensure we have an active database connection for this request
        try:
            g.db.get_db()
        except Exception as e:
            logger.error(f"Database connection error: {e}")
        
        # Log request details for debugging
        app.logger.debug('Request URL: %s', request.url)
        app.logger.debug('Request method: %s', request.method)
        app.logger.debug('Request path: %s', request.path)
        app.logger.debug('Request endpoint: %s', request.endpoint)
        app.logger.debug('Request blueprint: %s', request.blueprint)
        app.logger.debug('Referrer: %s', request.referrer)
        
        # Log headers in development for debugging
        if app.debug:
            app.logger.debug('Request headers: %s', dict(request.headers))
    
    # After request - log request duration
    @app.after_request
    def after_request(response):
        try:
            # Calculate request duration
            duration = time.time() - g.get('request_start_time', time.time())
            # Log slow requests (>500ms)
            if duration > 0.5:
                logger.warning(f"Slow request: {request.path} took {duration:.2f}s")
            
            # Add security headers
            response.headers['X-Content-Type-Options'] = 'nosniff'
            response.headers['X-Frame-Options'] = 'DENY'
            response.headers['X-XSS-Protection'] = '1; mode=block'
            return response
        except Exception as e:
            logger.error(f"Error in after_request: {e}")
            return response
        
    # Teardown request - close db connection
    @app.teardown_request
    def teardown_request(exception):
        if hasattr(g, 'db'):
            try:
                g.db.close()
            except Exception as e:
                # Just log, don't raise during teardown
                logger.error(f"Error closing database: {e}")
    
    # Import blueprints here to avoid circular imports
    from routes.auth import auth_bp
    from routes.network import network_bp
    from routes.api import bp as api_bp
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(network_bp)
    app.register_blueprint(api_bp)
    
    # Apply WSGI middleware
    app.wsgi_app = ProxyFix(app.wsgi_app)
    
    # Context processors for templates
    @app.context_processor
    def inject_common_variables():
        """Inject common variables into all templates."""
        cache_buster = int(time.time())
        logger.info(f"Setting cache_buster: {cache_buster}")
        
        # Get local IP address for Safari warning
        import socket
        host_ip = "127.0.0.1"  # Default fallback
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            # Connect to an external server to determine the local IP address
            s.connect(("8.8.8.8", 80))
            host_ip = s.getsockname()[0]
            s.close()
            logger.info(f"Detected host IP: {host_ip}")
        except Exception as e:
            logger.error(f"Error detecting host IP: {e}")
        
        return {
            'app_name': 'Proof of Humanity',
            'current_year': datetime.now().year,
            'version': '1.0.1',
            'now': datetime.now,
            'cache_buster': cache_buster,  # Add cache buster for CSS/JS
            'host_ip': host_ip  # Add host IP for Safari warning
        }
    
    # Add debug context processor
    @app.context_processor
    def inject_debug_info():
        """Inject debug info into templates"""
        def get_debug_info():
            return {
                'app_name': 'Proof of Humanity',
                'version': '0.1.0',
                'environment': os.environ.get('FLASK_ENV', 'development'),
                'user_agent': request.headers.get('User-Agent', 'Unknown'),
                'remote_addr': request.remote_addr or 'Unknown',
                'server_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'path': request.path,
                'endpoint': request.endpoint
            }
        
        # Add host IP for Safari users
        def get_host_ip():
            try:
                import socket
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                host_ip = s.getsockname()[0]
                s.close()
                return host_ip
            except Exception as e:
                app.logger.error(f"Error getting host IP: {e}")
                return "192.168.68.50"  # Default fallback IP
        
        # Return values for templates
        return {
            'debug_info': get_debug_info,
            'is_debug': os.environ.get('FLASK_ENV') == 'development',
            'host_ip': get_host_ip(),
            'debug': app.debug  # Add the debug variable directly
        }
    
    # Define routes
    
    # Index route
    @app.route('/')
    def index():
        return render_template('index.html', debug=app.debug)
    
    @app.route('/profile')
    def profile():
        return render_template('profile.html', debug=app.debug)
    
    @app.route('/verification')
    def verification_manage():
        """
        Manage user's verification status and progress.
        Shows current verification level, progress, and next steps.
        """
        try:
            # Mock data for user verification
            user_verification_level = 'child'  # Could be 'none', 'child', 'parent', 'grandparent'
            verification_stage = 'parent'  # The stage they're working on
            
            # Mock verification progress
            verification_progress = {
                'child': {
                    'completed': True,
                    'calls_made': 2,
                    'calls_required': 2
                },
                'parent': {
                    'completed': False,
                    'calls_made': 1,
                    'calls_required': 3
                },
                'grandparent': {
                    'completed': False,
                    'calls_made': 0,
                    'calls_required': 2
                }
            }
            
            # Calculate progress percentage
            total_steps = 7  # Total steps across all verification levels
            completed_steps = 2  # Child verification + 1 parent call
            verification_progress['percent'] = int((completed_steps / total_steps) * 100)
            
            return render_template(
                'verification.html',
                user_verification_level=user_verification_level,
                verification_stage=verification_stage,
                verification_progress=verification_progress,
                debug=app.debug
            )
        except Exception as e:
            logger.error(f"Error in verification_manage route: {e}")
            flash('An error occurred while loading verification data.', 'error')
            return render_template('verification.html', 
                                  user_verification_level='none',
                                  verification_stage='none',
                                  verification_progress={'percent': 0},
                                  debug=app.debug)
    
    @app.route('/family-tree')
    def family_tree():
        """Redirect to the family tree page on the network blueprint"""
        return redirect(url_for('network.family_tree'))
    
    @app.route('/terms')
    def terms():
        return render_template('terms.html', debug=app.debug)
    
    @app.route('/privacy')
    def privacy():
        return render_template('privacy.html', debug=app.debug)
    
    @app.route('/about')
    def about():
        """Page displaying information about the Proof of Humanity project"""
        return render_template('about.html', debug=app.debug)
    
    @app.route('/contact', methods=['GET', 'POST'])
    def contact():
        """Handle contact form submissions"""
        if request.method == 'POST':
            # In a real app, we would process the form data here
            # For now, just flash a success message
            flash('Your message has been sent successfully!', 'success')
            return redirect(url_for('about'))
        return redirect(url_for('about'))
    
    @app.route('/did_manage')
    def did_manage():
        return render_template('did_manage.html', debug=app.debug)
    
    @app.route('/benefits')
    def benefits():
        """Page displaying benefits and services available after completing PoH verification"""
        try:
            return render_template('benefits.html', debug=app.debug)
        except Exception as e:
            logger.error(f"Error in benefits route: {e}", exc_info=True)
            flash('An error occurred while loading the page.', 'error')
            return render_template('errors/500.html', debug=app.debug), 500
    
    @app.route('/access_services')
    def access_services():
        """Alias for the benefits page, now called Access Services"""
        try:
            # Add diagnostic logging
            logger.info(f"Accessing access_services route - template: benefits.html")
            logger.debug(f"Template search path: {app.jinja_loader.searchpath}")
            logger.debug(f"Available templates: {[t for t in app.jinja_loader.list_templates() if t.endswith('.html')]}")
            logger.debug(f"Request URL: {request.url}")
            logger.debug(f"Request method: {request.method}")
            logger.debug(f"Request path: {request.path}")
            logger.debug(f"Request endpoint: {request.endpoint}")
            logger.debug(f"Request blueprint: {request.blueprint}")
            logger.debug(f"Referrer: {request.referrer}")
            logger.debug(f"Request headers: {dict(request.headers)}")
            
            if 'benefits.html' not in app.jinja_loader.list_templates():
                logger.error(f"benefits.html template not found")
                # Fallback to a generic template if benefits.html doesn't exist
                flash('The requested page is not available.', 'warning')
                return render_template('index.html', debug=app.debug)
            
            return render_template('benefits.html', debug=app.debug)
        except Exception as e:
            logger.error(f"Error in access_services route: {e}", exc_info=True)
            flash('An error occurred while loading the page.', 'error')
            return render_template('errors/500.html', debug=app.debug), 500
    
    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if request.method == 'POST':
            # Mock successful login
            session['user_id'] = 1
            session['username'] = request.form.get('email', 'User')
            logger.info(f"User logged in: {session['username']}")
            return redirect(url_for('dashboard'))
        return render_template('login.html', debug=app.debug)
    
    @app.route('/register', methods=['GET', 'POST'])
    def register():
        if request.method == 'POST':
            # Mock successful registration
            return redirect(url_for('verification_manage'))
        return render_template('register.html', debug=app.debug)
    
    @app.route('/logout')
    def logout():
        session.clear()
        return redirect(url_for('index'))
    
    @app.route('/settings')
    def settings():
        return render_template('settings.html', debug=app.debug)
    
    @app.route('/forgot-password')
    def forgot_password():
        return render_template('login.html', reset_message="Please check your email for password reset instructions.", debug=app.debug)
    
    @app.route('/schedule-call')
    def schedule_call():
        """
        Page for scheduling verification calls with other users.
        Displays an interactive calendar with color-coded availability.
        """
        try:
            return render_template('schedule_call.html', debug=app.debug)
        except Exception as e:
            logger.error(f"Error in schedule_call route: {e}")
            flash('An error occurred while loading the scheduling page.', 'error')
            return redirect(url_for('verification_manage'))
    
    @app.route('/network-viz')
    def network_viz_redirect():
        """Redirect to the network visualization page on the network blueprint"""
        return redirect(url_for('network.viz'))
    
    @app.route('/dashboard')
    def dashboard():
        # Ensure user is logged in
        if 'user_id' not in session:
            return redirect(url_for('login'))
        
        # In a real app, we would fetch user data from the database
        # For now, we'll use mock data
        user = {
            'id': session['user_id'],
            'username': session.get('username', 'User'),
            'verification_level': 'child',
            'verification_stage': 'parent',
            'joined_date': 'Aug 23, 2023',
            'last_verified': '3 days ago',
            'did': 'did:poh:2a8F9d3b7C1e5A4d6B8c2E3f',
            'family_connections': 17
        }
        
        logger.info(f"User {user['username']} accessed dashboard")
        
        return render_template('dashboard.html', 
                              current_user=user,
                              now=datetime.datetime.now,
                              debug=app.debug)
    
    # Simplify static file serving
    @app.route('/static/<path:filename>')
    def serve_static(filename):
        """Serve static files with proper caching headers"""
        try:
            logger.info(f"Serving static file: {filename}")
            response = send_from_directory('static', filename)
            # Add stronger cache-busting headers
            timestamp = int(time.time())
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            response.headers['X-Timestamp'] = str(timestamp)
            logger.info(f"Static file response headers: {dict(response.headers)}")
            return response
        except Exception as e:
            logger.error(f"Error serving static file {filename}: {e}")
            abort(404)
    
    @app.route('/network/viz/logs', methods=['POST'])
    def save_network_logs():
        try:
            data = request.get_json()
            log_file = write_network_log(data['log_data'])
            return jsonify({
                'status': 'success',
                'message': 'Logs saved successfully',
                'log_file': log_file
            })
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500
    
    @app.route('/network/viz/logs/<timestamp>', methods=['GET'])
    def get_network_logs(timestamp):
        try:
            log_file = os.path.join(LOGS_DIR, f'network_viz_{timestamp}.txt')
            if os.path.exists(log_file):
                with open(log_file, 'r') as f:
                    return f.read()
            return 'Log file not found', 404
        except Exception as e:
            return str(e), 500
    
    @app.route('/network/viz/logs/<timestamp>', methods=['GET'])
    def get_network_viz_logs(timestamp):
        try:
            log_file = os.path.join(app.config['LOG_DIR'], f'network_viz_{timestamp}.log')
            if os.path.exists(log_file):
                return send_file(log_file, as_attachment=True)
            else:
                return jsonify({'error': 'Log file not found'}), 404
        except Exception as e:
            app.logger.error(f"Error retrieving logs: {e}")
            return jsonify({'error': 'Error retrieving logs'}), 500
    
    @app.route('/diagnostics')
    def diagnostics():
        """Diagnostic page for network visualization testing"""
        app.logger.info("Loading diagnostics page")
        return render_template('diagnostics.html', debug=app.debug)
    
    @app.before_request
    def log_template_info():
        """Log information about templates being rendered"""
        if request.endpoint:
            logger.info(f"Request for endpoint: {request.endpoint}, path: {request.path}, method: {request.method}")
            # Additional debugging information
            logger.info(f"Request headers: {dict(request.headers)}")
            logger.info(f"User agent: {request.user_agent}")
            logger.info(f"Session data: {dict(session)}")
    
    # Enhanced logging for rendering templates
    @app.template_filter()
    def debug_filter(value):
        """Debug filter to log template variables"""
        logger.info(f"Template variable: {value}")
        return value
    
    # Add utility route for checking browser console logs
    @app.route('/api/log', methods=['POST'])
    def log_browser_error():
        """Endpoint to log browser console errors"""
        data = request.get_json() or {}
        error_msg = data.get('error', 'Unknown error')
        error_source = data.get('source', 'browser')
        error_line = data.get('line', 'unknown')
        logger.error(f"Browser error: {error_msg} at {error_source}:{error_line}")
        return jsonify({"status": "logged"})
    
    # Add error handlers
    @app.errorhandler(404)
    def not_found_error(error):
        app.logger.error(f'Page not found: {request.url}')
        return render_template('errors/404.html', debug=app.debug), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f'Server Error: {error}')
        return render_template('errors/500.html', debug=app.debug), 500
    
    @app.errorhandler(Exception)
    def handle_exception(e):
        logger.error(f"Unhandled exception: {e}", exc_info=True)
        return render_template('errors/500.html', debug=app.debug), 500
    
    return app

if __name__ == '__main__':
    import signal
    import sys
    import socket

    # Track active server for proper cleanup
    active_server = None

    def signal_handler(sig, frame):
        print('Shutting down gracefully...')
        if active_server:
            active_server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    app = create_app()
    port = int(os.environ.get('FLASK_RUN_PORT', 5003))
    
    # Check if the default port is available
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(('0.0.0.0', port))
        sock.close()
        print(f"Starting server on port {port}")
    except socket.error:
        print(f"Port {port} is already in use. Please terminate the existing process first.")
        print(f"You can use: lsof -i :{port} | grep LISTEN  to find the process")
        print(f"And then: kill -9 <PID>  to terminate it")
        sys.exit(1)
    
    print(f"Server listening at: http://0.0.0.0:{port}")
    
    # Store the server instance for clean shutdown
    from werkzeug.serving import make_server
    active_server = make_server('0.0.0.0', port, app)
    app.debug = True
    active_server.serve_forever() 