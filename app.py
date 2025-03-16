import os
import logging
import time
from flask import Flask, render_template, g, request, redirect, url_for, flash, abort, jsonify, session, send_from_directory
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
    
    # Enable CORS
    CORS(app)
    
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
            # Continue with the request, individual routes should handle any DB errors
    
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
        return {
            'app_name': 'Proof of Humanity',
            'current_year': datetime.now().year,
            'version': '1.0.1',
            'now': datetime.now,
        }
    
    # Add context processor for current user
    @app.context_processor
    def inject_user():
        # Create a mock user object for templates
        class MockUser:
            is_authenticated = False
            username = None
            avatar = None
        
        # Check if user is in session
        if 'user_id' in session:
            mock_user = MockUser()
            mock_user.is_authenticated = True
            mock_user.username = session.get('username', 'User')
            mock_user.avatar = None
            return {'current_user': mock_user}
        return {'current_user': MockUser()}
    
    # Routes
    @app.route('/')
    def index():
        return render_template('index.html')
    
    @app.route('/profile')
    def profile():
        return render_template('profile.html')
    
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
                verification_progress=verification_progress
            )
        except Exception as e:
            logger.error(f"Error in verification_manage route: {e}")
            flash('An error occurred while loading verification data.', 'error')
            return render_template('verification.html', 
                                  user_verification_level='none',
                                  verification_stage='none',
                                  verification_progress={'percent': 0})
    
    @app.route('/family-tree')
    def family_tree():
        """Redirect to the family tree page on the network blueprint"""
        return redirect(url_for('network.family_tree'))
    
    @app.route('/terms')
    def terms():
        return render_template('terms.html')
    
    @app.route('/privacy')
    def privacy():
        return render_template('privacy.html')
    
    @app.route('/about')
    def about():
        """Page displaying information about the Proof of Humanity project"""
        return render_template('about.html')
    
    @app.route('/did_manage')
    def did_manage():
        return render_template('did_manage.html')
    
    @app.route('/benefits')
    def benefits():
        """Page displaying benefits and services available after completing PoH verification"""
        return render_template('benefits.html')
    
    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if request.method == 'POST':
            # Mock successful login
            session['user_id'] = 1
            session['username'] = request.form.get('email', 'User')
            return redirect(url_for('verification_manage'))
        return render_template('login.html')
    
    @app.route('/register', methods=['GET', 'POST'])
    def register():
        if request.method == 'POST':
            # Mock successful registration
            return redirect(url_for('verification_manage'))
        return render_template('register.html')
    
    @app.route('/logout')
    def logout():
        session.clear()
        return redirect(url_for('index'))
    
    @app.route('/settings')
    def settings():
        return render_template('settings.html')
    
    @app.route('/forgot-password')
    def forgot_password():
        return render_template('login.html', reset_message="Please check your email for password reset instructions.")
    
    @app.route('/schedule-call')
    def schedule_call():
        """
        Page for scheduling verification calls with other users.
        Displays an interactive calendar with color-coded availability.
        """
        try:
            return render_template('schedule_call.html')
        except Exception as e:
            logger.error(f"Error in schedule_call route: {e}")
            flash('An error occurred while loading the scheduling page.', 'error')
            return redirect(url_for('verification_manage'))
    
    @app.route('/network-viz')
    def network_viz_redirect():
        """Redirect to the network visualization page on the network blueprint"""
        return redirect(url_for('network.viz'))
    
    # Simplify static file serving
    @app.route('/static/<path:filename>')
    def serve_static(filename):
        """Serve static files with proper caching headers"""
        response = send_from_directory('static', filename)
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
    
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
    
    # Add error handlers
    @app.errorhandler(404)
    def not_found_error(error):
        app.logger.error(f'Page not found: {request.url}')
        return render_template('errors/404.html'), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f'Server Error: {error}')
        return render_template('errors/500.html'), 500
    
    @app.errorhandler(Exception)
    def handle_exception(e):
        logger.error(f"Unhandled exception: {e}", exc_info=True)
        return render_template('errors/500.html'), 500
    
    return app

if __name__ == '__main__':
    import signal
    import sys

    def signal_handler(sig, frame):
        print('Shutting down gracefully...')
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    app = create_app()
    port = int(os.environ.get('FLASK_RUN_PORT', 5003))
    app.run(
        host='0.0.0.0',  # Bind to all interfaces
        port=port,
        debug=True,
        use_reloader=False  # Disable auto-reloader to prevent duplicate processes
    ) 