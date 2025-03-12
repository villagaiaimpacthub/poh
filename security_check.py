#!/usr/bin/env python
"""
Security checker for the Proof of Humanity application.
This script scans the application for common security misconfigurations and vulnerabilities.
"""

import os
import re
import sys
import json
import subprocess
from datetime import datetime
import glob
import importlib.util

# Define colors for output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(message):
    """Print a formatted header."""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 80}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message.center(80)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 80}{Colors.ENDC}\n")

def print_result(message, status):
    """Print a formatted result."""
    status_color = Colors.GREEN if status == "PASS" else Colors.FAIL if status == "FAIL" else Colors.WARNING
    status_text = f"[ {status} ]"
    print(f"{message.ljust(70)} {status_color}{status_text.rjust(10)}{Colors.ENDC}")

def check_environment_variables():
    """Check for sensitive information in environment variables."""
    print_header("Checking Environment Variables")
    
    env_issues = []
    
    # Load .env file if it exists
    env_file = os.path.join(os.getcwd(), '.env')
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                    
                if '=' in line:
                    key, value = line.split('=', 1)
                    # Check for hardcoded secrets
                    if any(secret_type in key.lower() for secret_type in ['secret', 'password', 'key', 'token']) and \
                       value and not value.startswith('${') and \
                       'replace_with' not in value.lower():
                        env_issues.append(f"Line {line_num}: Potential hardcoded secret in {key}")
    
    # Check for environment variable values in code
    sensitive_vars = []
    if 'SECRET_KEY' in os.environ:
        secret_key = os.environ['SECRET_KEY']
        if len(secret_key) < 16:
            sensitive_vars.append("SECRET_KEY is too short (should be at least 16 characters)")
    
    # Check for debug mode in production
    if os.environ.get('FLASK_ENV') == 'production' and os.environ.get('FLASK_DEBUG') == '1':
        sensitive_vars.append("Debug mode is enabled in production environment")
    
    if not env_issues and not sensitive_vars:
        print_result("No hardcoded secrets found in environment variables", "PASS")
    else:
        for issue in env_issues:
            print_result(issue, "FAIL")
        for var in sensitive_vars:
            print_result(var, "FAIL")

def check_dependency_vulnerabilities():
    """Check for known vulnerabilities in dependencies."""
    print_header("Checking Dependencies for Vulnerabilities")
    
    # Use safety to check for vulnerabilities
    try:
        result = subprocess.run(
            ['pip', 'list', '--format=json'],
            capture_output=True,
            text=True,
            check=True
        )
        packages = json.loads(result.stdout)
        
        # Check if safety is installed
        safety_installed = any(package['name'] == 'safety' for package in packages)
        
        if not safety_installed:
            print_result("Safety not installed. Install with: pip install safety", "WARNING")
            return
            
        result = subprocess.run(
            ['safety', 'check', '--json'],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print_result("No known vulnerabilities found in dependencies", "PASS")
        else:
            vulnerabilities = json.loads(result.stdout)
            for vuln in vulnerabilities:
                package_name = vuln[0]
                affected_version = vuln[2]
                vulnerability_id = vuln[4]
                print_result(f"{package_name} {affected_version} has vulnerability {vulnerability_id}", "FAIL")
                
    except (subprocess.SubprocessError, json.JSONDecodeError) as e:
        print_result(f"Error checking dependencies: {str(e)}", "ERROR")
    except FileNotFoundError:
        print_result("Safety command not found. Install with: pip install safety", "WARNING")

def check_code_security_issues():
    """Check for security issues in code."""
    print_header("Checking Code for Security Issues")
    
    # Check for common security issues in code
    security_patterns = {
        'hardcoded_password': r'password\s*=\s*[\'"][^\'"]+[\'"]',
        'sql_injection': r'execute\([\'"].*?\%.*?[\'"]\s*%\s*',
        'eval_use': r'eval\(',
        'debug_enabled': r'debug\s*=\s*True',
        'csrf_disabled': r'csrf\.exempt|csrf_exempt|WTF_CSRF_ENABLED\s*=\s*False'
    }
    
    file_types = ['*.py', '*.html', '*.js']
    files_to_check = []
    for file_type in file_types:
        files_to_check.extend(glob.glob(os.path.join(os.getcwd(), '**', file_type), recursive=True))
    
    # Exclude virtual environment and third-party files
    files_to_check = [f for f in files_to_check if 'venv' not in f and 'node_modules' not in f]
    
    issues_found = False
    
    for file_path in files_to_check:
        relative_path = os.path.relpath(file_path, os.getcwd())
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
            try:
                content = file.read()
                for issue, pattern in security_patterns.items():
                    matches = re.finditer(pattern, content, re.IGNORECASE)
                    for match in matches:
                        line_num = content[:match.start()].count('\n') + 1
                        line = content.splitlines()[line_num - 1].strip()
                        print_result(f"{relative_path}:{line_num} - Possible {issue}: {line}", "FAIL")
                        issues_found = True
            except UnicodeDecodeError:
                print_result(f"Could not read {relative_path} (binary file?)", "WARNING")
    
    if not issues_found:
        print_result("No obvious security issues found in code", "PASS")

def check_secure_headers():
    """Check if secure headers are set in the Flask application."""
    print_header("Checking Secure HTTP Headers")
    
    # Load the app module to inspect configuration
    try:
        # Try to find and import the main app module
        app_modules = ['app.py', 'app/__init__.py', 'wsgi.py']
        app_module = None
        
        for module_path in app_modules:
            if os.path.exists(module_path):
                module_name = os.path.splitext(os.path.basename(module_path))[0]
                spec = importlib.util.spec_from_file_location(module_name, module_path)
                app_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(app_module)
                break
        
        if not app_module:
            print_result("Could not find main application module", "WARNING")
            return
            
        # Check if Flask-Talisman is being used
        using_talisman = False
        for line in open(module_path, 'r').readlines():
            if 'Talisman' in line and 'import' not in line.lower():
                using_talisman = True
                break
        
        if using_talisman:
            print_result("Using Flask-Talisman for secure headers", "PASS")
        else:
            # Check if common security headers are manually set
            headers_check = {
                'X-Content-Type-Options': False,
                'X-Frame-Options': False,
                'Content-Security-Policy': False,
                'X-XSS-Protection': False,
                'Strict-Transport-Security': False
            }
            
            # Look for these headers in the code
            for file_path in glob.glob('**/*.py', recursive=True):
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
                    content = file.read()
                    for header in headers_check:
                        if header in content:
                            headers_check[header] = True
            
            missing_headers = [h for h, found in headers_check.items() if not found]
            
            if not missing_headers:
                print_result("All important security headers appear to be set", "PASS")
            else:
                for header in missing_headers:
                    print_result(f"Missing security header: {header}", "FAIL")
    
    except Exception as e:
        print_result(f"Error checking secure headers: {str(e)}", "ERROR")

def check_csrf_protection():
    """Check if CSRF protection is enabled."""
    print_header("Checking CSRF Protection")
    
    csrf_protected = False
    
    # Check for Flask-WTF integration
    for file_path in glob.glob('**/*.py', recursive=True):
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()
            if 'flask_wtf.csrf' in content or 'CSRFProtect' in content:
                csrf_protected = True
                break
    
    # Check for csrf_token in templates
    if not csrf_protected:
        for file_path in glob.glob('**/*.html', recursive=True):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                if 'csrf_token' in content:
                    csrf_protected = True
                    break
    
    if csrf_protected:
        print_result("CSRF protection appears to be enabled", "PASS")
    else:
        print_result("CSRF protection might not be properly implemented", "FAIL")

def check_file_permissions():
    """Check for inappropriate file permissions."""
    print_header("Checking File Permissions")
    
    # This works better on Unix-like systems
    if os.name != 'posix':
        print_result("File permission checks only supported on Unix-like systems", "INFO")
        return
    
    sensitive_files = ['.env', 'config.py', '*.pem', '*.key', '*.crt']
    sensitive_paths = []
    
    for pattern in sensitive_files:
        sensitive_paths.extend(glob.glob(os.path.join(os.getcwd(), '**', pattern), recursive=True))
    
    for file_path in sensitive_paths:
        if os.path.exists(file_path):
            permissions = oct(os.stat(file_path).st_mode & 0o777)
            if int(permissions[-1]) > 0 or int(permissions[-2]) > 6:  # Check if world-readable
                relative_path = os.path.relpath(file_path, os.getcwd())
                print_result(f"{relative_path} has insecure permissions: {permissions}", "FAIL")
            else:
                relative_path = os.path.relpath(file_path, os.getcwd())
                print_result(f"{relative_path} has secure permissions", "PASS")

def check_debug_enabled():
    """Check if debug mode is enabled in production code."""
    print_header("Checking Debug Settings")
    
    debug_in_prod = False
    
    # Check app.py and similar files
    for file_path in ['app.py', 'wsgi.py', 'run.py']:
        if os.path.exists(file_path):
            with open(file_path, 'r') as file:
                content = file.read()
                if re.search(r'debug\s*=\s*True', content) and 'if __name__' not in content:
                    debug_in_prod = True
                    print_result(f"Debug mode might be enabled in {file_path}", "FAIL")
    
    if not debug_in_prod:
        print_result("No debug mode enabled in production code", "PASS")

def check_rate_limiting():
    """Check if rate limiting is implemented."""
    print_header("Checking Rate Limiting")
    
    has_rate_limiting = False
    
    # Check for Flask-Limiter
    for file_path in glob.glob('**/*.py', recursive=True):
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()
            if 'flask_limiter' in content or 'Limiter' in content or '@limiter.limit' in content:
                has_rate_limiting = True
                print_result(f"Rate limiting found in {os.path.relpath(file_path, os.getcwd())}", "PASS")
                break
    
    if not has_rate_limiting:
        print_result("Could not find rate limiting implementation", "WARNING")
        print_result("Consider implementing rate limiting for login/register endpoints", "INFO")

def check_file_upload_security():
    """Check if file upload security is implemented."""
    print_header("Checking File Upload Security")
    
    # Look for file upload handling code
    has_file_upload = False
    has_extension_check = False
    has_content_type_check = False
    
    for file_path in glob.glob('**/*.py', recursive=True):
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()
            if 'request.files' in content:
                has_file_upload = True
                relative_path = os.path.relpath(file_path, os.getcwd())
                
                # Check for file extension validation
                if re.search(r'\.endswith|allowed_file|ALLOWED_EXTENSIONS|splitext', content):
                    has_extension_check = True
                
                # Check for content type validation
                if re.search(r'content[-_]type|mimetype', content):
                    has_content_type_check = True
    
    if has_file_upload:
        if has_extension_check and has_content_type_check:
            print_result("File upload security checks appear to be implemented", "PASS")
        else:
            missing = []
            if not has_extension_check:
                missing.append("file extension validation")
            if not has_content_type_check:
                missing.append("content type validation")
            print_result(f"File upload handling found but missing: {', '.join(missing)}", "FAIL")
    else:
        print_result("No file upload handling detected", "INFO")

def main():
    """Main function to run all security checks."""
    print_header(f"Security Check for Proof of Humanity - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all checks
    check_environment_variables()
    check_dependency_vulnerabilities()
    check_code_security_issues()
    check_secure_headers()
    check_csrf_protection()
    check_file_permissions()
    check_debug_enabled()
    check_rate_limiting()
    check_file_upload_security()
    
    print_header("Security Check Complete")

if __name__ == "__main__":
    main() 