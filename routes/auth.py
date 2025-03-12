from flask import Blueprint, render_template, redirect, url_for, request, flash, g, session
from werkzeug.security import generate_password_hash, check_password_hash
from models.database import Database
from models.user import User

# Create auth blueprint
auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    """User registration form and handling"""
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm = request.form.get('confirm_password')
        
        error = None
        
        if not username:
            error = 'Username is required.'
        elif not email:
            error = 'Email is required.'
        elif not password:
            error = 'Password is required.'
        elif password != confirm:
            error = 'Passwords do not match.'
        
        # Check if username or email already exists
        if error is None:
            db = g.db
            if db.execute_query_fetch_one('SELECT id FROM users WHERE username = ?', (username,)):
                error = f"User {username} is already registered."
            elif db.execute_query_fetch_one('SELECT id FROM users WHERE email = ?', (email,)):
                error = f"Email {email} is already registered."
        
        # Create new user
        if error is None:
            db = g.db
            hashed_password = generate_password_hash(password)
            db.execute_query(
                'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                (username, email, hashed_password)
            )
            
            flash('Registration successful! Please log in.', 'success')
            return redirect(url_for('auth.login'))
        
        flash(error, 'error')
    
    return render_template('auth/register.html')

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """User login form and handling"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        error = None
        
        if not username:
            error = 'Username is required.'
        elif not password:
            error = 'Password is required.'
        
        if error is None:
            db = g.db
            user = db.execute_query_fetch_one(
                'SELECT * FROM users WHERE username = ?', (username,)
            )
            
            if user is None:
                error = 'Invalid username or password.'
            elif not check_password_hash(user['password'], password):
                error = 'Invalid username or password.'
            
            if error is None:
                # Clear session and create a new one
                session.clear()
                session['user_id'] = user['id']
                
                flash('Welcome back!', 'success')
                return redirect(url_for('index'))
        
        flash(error, 'error')
    
    return render_template('auth/login.html')

@auth_bp.route('/logout')
def logout():
    """Log out the current user"""
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('index'))

@auth_bp.before_app_request
def load_logged_in_user():
    """Load user information if user is logged in"""
    user_id = session.get('user_id')
    
    if user_id is None:
        g.user = None
    else:
        db = g.db
        user_data = db.execute_query_fetch_one('SELECT * FROM users WHERE id = ?', (user_id,))
        
        if user_data:
            g.user = User.from_db(user_data)
        else:
            g.user = None
            session.clear()  # Clear invalid session 