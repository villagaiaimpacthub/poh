"""
Security tests for the Proof of Humanity application.
Testing for authentication, authorization, input validation, and common web vulnerabilities.
"""

import json
import pytest
import re
from unittest.mock import patch, MagicMock
import base64

def test_login_success(client):
    """Test successful login."""
    response = client.post('/login', 
                          data={'username': 'testuser', 'password': 'password'},
                          follow_redirects=True)
    
    assert response.status_code == 200
    assert b'Log out' in response.data  # Assuming logout link appears after login
    assert b'Login failed' not in response.data

def test_login_wrong_password(client):
    """Test login with wrong password."""
    response = client.post('/login', 
                          data={'username': 'testuser', 'password': 'wrongpassword'},
                          follow_redirects=True)
    
    assert response.status_code == 200
    assert b'Invalid username or password' in response.data
    assert b'Log out' not in response.data

def test_login_nonexistent_user(client):
    """Test login with nonexistent user."""
    response = client.post('/login', 
                          data={'username': 'nonexistentuser', 'password': 'password'},
                          follow_redirects=True)
    
    assert response.status_code == 200
    assert b'Invalid username or password' in response.data
    assert b'Log out' not in response.data

def test_login_sql_injection_attempt(client):
    """Test login with SQL injection attempt."""
    response = client.post('/login', 
                          data={'username': "' OR 1=1 --", 'password': 'anything'},
                          follow_redirects=True)
    
    assert response.status_code == 200
    assert b'Invalid username or password' in response.data
    assert b'Log out' not in response.data

def test_logout(client, auth):
    """Test logout functionality."""
    auth.login()
    response = auth.logout()
    
    assert response.status_code == 200
    assert b'Log in' in response.data  # Assuming login link appears after logout
    assert b'Log out' not in response.data

def test_password_reset_token_expiry(client):
    """Test that password reset tokens expire."""
    # This test would need to be implemented based on your password reset mechanism
    with patch('routes.auth.verify_reset_token', return_value=None):
        response = client.get('/reset-password/expired-token', follow_redirects=True)
        
        assert response.status_code == 200
        assert b'Token is invalid or has expired' in response.data

def test_session_expiry(client, auth):
    """Test session expiry."""
    auth.login()
    
    # This would simulate session expiry by manipulating the session cookie
    with patch('flask_login.utils._get_user', return_value=None):
        response = client.get('/dashboard', follow_redirects=True)
        
        assert response.status_code == 200
        assert b'Please log in to access this page' in response.data

def test_protected_route_unauthenticated(client):
    """Test accessing protected route when unauthenticated."""
    response = client.get('/dashboard', follow_redirects=True)
    
    assert response.status_code == 200
    assert b'Please log in to access this page' in response.data

def test_admin_route_non_admin(client, auth):
    """Test accessing admin route as non-admin user."""
    auth.login()  # Login as regular user
    
    response = client.get('/admin/dashboard', follow_redirects=True)
    
    assert response.status_code == 403
    assert b'You do not have permission to access this page' in response.data

def test_admin_route_admin(client, auth):
    """Test accessing admin route as admin user."""
    auth.login(username='testadmin', password='password')  # Login as admin
    
    with patch('routes.admin.is_admin_user', return_value=True):
        response = client.get('/admin/dashboard')
        
        assert response.status_code == 200
        assert b'Admin Dashboard' in response.data

def test_csrf_protection(client, auth):
    """Test CSRF protection on forms."""
    auth.login()
    
    # Get CSRF token from the form
    response = client.get('/profile/edit')
    csrf_token_pattern = r'name="csrf_token" value="(.+?)"'
    match = re.search(csrf_token_pattern, response.data.decode())
    
    if match:
        csrf_token = match.group(1)
        
        # Submit form with valid CSRF token
        response = client.post('/profile/edit',
                              data={
                                  'csrf_token': csrf_token,
                                  'first_name': 'Updated',
                                  'last_name': 'User'
                              },
                              follow_redirects=True)
        
        assert response.status_code == 200
        assert b'Profile updated successfully' in response.data
        
        # Submit form with invalid CSRF token
        response = client.post('/profile/edit',
                              data={
                                  'csrf_token': 'invalid-token',
                                  'first_name': 'Hacker',
                                  'last_name': 'Attack'
                              },
                              follow_redirects=True)
        
        assert response.status_code == 200
        assert b'CSRF token validation failed' in response.data or b'The CSRF token is invalid' in response.data

def test_password_complexity(client):
    """Test password complexity requirements during registration."""
    response = client.post('/register',
                          data={
                              'username': 'newuser',
                              'email': 'new@example.com',
                              'password': 'simple',  # Too simple
                              'confirm_password': 'simple'
                          },
                          follow_redirects=True)
    
    assert response.status_code == 200
    assert b'Password must be at least 8 characters' in response.data or b'Password does not meet complexity requirements' in response.data
    
    # Try with more complex password
    response = client.post('/register',
                          data={
                              'username': 'newuser',
                              'email': 'new@example.com',
                              'password': 'Complex1Password!',
                              'confirm_password': 'Complex1Password!'
                          },
                          follow_redirects=True)
    
    assert response.status_code == 200
    assert b'Password must be at least 8 characters' not in response.data and b'Password does not meet complexity requirements' not in response.data

def test_rate_limiting_login(client):
    """Test rate limiting on login attempts."""
    # Make multiple rapid login attempts
    for _ in range(10):
        client.post('/login', data={'username': 'testuser', 'password': 'wrongpassword'})
    
    # The next attempt should be rate limited
    response = client.post('/login', data={'username': 'testuser', 'password': 'wrongpassword'})
    
    assert response.status_code == 429
    assert b'Too many login attempts' in response.data or b'Rate limit exceeded' in response.data

def test_xss_protection(client, auth):
    """Test protection against Cross-Site Scripting (XSS)."""
    auth.login()
    
    # Try to inject script in profile name
    script_payload = '<script>alert("XSS")</script>'
    
    response = client.post('/profile/edit',
                          data={
                              'first_name': script_payload,
                              'last_name': 'User'
                          },
                          follow_redirects=True)
    
    assert response.status_code == 200
    
    # Get the profile page and check if the script is properly escaped
    response = client.get('/profile')
    
    assert response.status_code == 200
    assert script_payload not in response.data.decode()
    assert '&lt;script&gt;' in response.data.decode() or script_payload not in response.data.decode()

def test_sql_injection_protection(client, auth):
    """Test protection against SQL injection in API endpoints."""
    auth.login()
    
    # Try to inject SQL in a search parameter
    injection_payload = "test' OR 1=1 --"
    
    response = client.get(f'/api/family/search?q={injection_payload}')
    
    # The application should handle this safely (not return all users)
    assert response.status_code == 200
    data = json.loads(response.data)
    
    # If properly protected, we should either get an empty result or filtered results
    # not the entire user table
    assert len(data) <= 1  # Should only match actual users with this name, likely none

def test_secure_headers(client):
    """Test that secure headers are properly set."""
    response = client.get('/')
    
    assert 'X-Content-Type-Options' in response.headers
    assert response.headers['X-Content-Type-Options'] == 'nosniff'
    
    assert 'X-Frame-Options' in response.headers
    assert response.headers['X-Frame-Options'] in ['DENY', 'SAMEORIGIN']
    
    assert 'Content-Security-Policy' in response.headers
    # Check for basic CSP directives
    assert "default-src 'self'" in response.headers['Content-Security-Policy']

def test_api_authorization(client):
    """Test API endpoints require proper authorization."""
    # Unauthenticated request
    response = client.get('/api/family/tree')
    assert response.status_code == 401
    
    # Authenticated request using basic auth with invalid credentials
    credentials = base64.b64encode(b'invalid:credentials').decode('utf-8')
    headers = {'Authorization': f'Basic {credentials}'}
    
    response = client.get('/api/family/tree', headers=headers)
    assert response.status_code == 401
    
    # Authenticated request with invalid/expired token
    headers = {'Authorization': 'Bearer invalid_token'}
    
    response = client.get('/api/family/tree', headers=headers)
    assert response.status_code == 401

def test_file_upload_security(client, auth):
    """Test file upload security measures."""
    auth.login()
    
    # Try to upload file with disallowed extension
    with open('tests/test_file.exe', 'w') as f:
        f.write('Malicious content')
    
    with open('tests/test_file.exe', 'rb') as f:
        response = client.post('/profile/avatar',
                              data={'avatar': (f, 'test_file.exe')},
                              content_type='multipart/form-data',
                              follow_redirects=True)
    
    assert response.status_code == 200
    assert b'File type not allowed' in response.data
    
    # Try to upload file with allowed extension
    with open('tests/test_file.jpg', 'w') as f:
        f.write('Fake JPEG content')
    
    with open('tests/test_file.jpg', 'rb') as f:
        response = client.post('/profile/avatar',
                              data={'avatar': (f, 'test_file.jpg')},
                              content_type='multipart/form-data',
                              follow_redirects=True)
    
    assert response.status_code == 200
    assert b'File type not allowed' not in response.data
    
    # Clean up test files
    import os
    if os.path.exists('tests/test_file.exe'):
        os.remove('tests/test_file.exe')
    if os.path.exists('tests/test_file.jpg'):
        os.remove('tests/test_file.jpg')

def test_session_fixation_protection(client, auth):
    """Test protection against session fixation attacks."""
    # Store the session cookie before login
    client.get('/')
    pre_login_cookies = client.cookie_jar
    
    # Login
    response = client.post('/login', 
                          data={'username': 'testuser', 'password': 'password'},
                          follow_redirects=True)
    
    assert response.status_code == 200
    
    # Check that the session cookie changed after login
    post_login_cookies = client.cookie_jar
    
    # Extract the session cookie values
    pre_login_session = None
    post_login_session = None
    
    for cookie in pre_login_cookies:
        if cookie.name == 'session':
            pre_login_session = cookie.value
    
    for cookie in post_login_cookies:
        if cookie.name == 'session':
            post_login_session = cookie.value
    
    assert pre_login_session != post_login_session

def test_error_handling_no_information_disclosure(client):
    """Test that error pages don't disclose sensitive information."""
    # Trigger a 404 error
    response = client.get('/nonexistent-page')
    
    assert response.status_code == 404
    assert b'Stack trace' not in response.data
    assert b'Traceback' not in response.data
    assert b'Error 404' in response.data
    
    # Trigger a 500 error (this requires a route that intentionally raises an exception)
    with patch('routes.views.trigger_error', side_effect=Exception('Test exception')):
        response = client.get('/trigger-error')
        
        assert response.status_code == 500
        assert b'Stack trace' not in response.data
        assert b'Traceback' not in response.data
        assert b'Error 500' in response.data
        assert b'Test exception' not in response.data  # The specific error message should not be exposed 