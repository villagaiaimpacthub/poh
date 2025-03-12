from flask import Blueprint, render_template, current_app
import sqlite3
import os
import platform
import psutil
import time

bp = Blueprint('dev_dashboard', __name__, url_prefix='/dev')

@bp.route('/')
def index():
    """Developer dashboard showing system stats and application info."""
    # System information
    system_info = {
        'platform': platform.platform(),
        'python_version': platform.python_version(),
        'architecture': platform.machine(),
        'processor': platform.processor(),
        'memory': f"{psutil.virtual_memory().total / (1024 ** 3):.2f} GB",
        'memory_usage': f"{psutil.virtual_memory().percent}%",
        'disk_usage': f"{psutil.disk_usage('/').percent}%"
    }
    
    # Database statistics
    db_path = current_app.config.get('DATABASE_PATH', 'instance/poh.sqlite')
    db_stats = {}
    
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get table list
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        # Get row counts for each table
        table_counts = {}
        for table in tables:
            table_name = table[0]
            cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
            count = cursor.fetchone()[0]
            table_counts[table_name] = count
        
        # Get database file size
        db_size = os.path.getsize(db_path)
        
        db_stats = {
            'tables': len(tables),
            'table_counts': table_counts,
            'size': f"{db_size / (1024 ** 2):.2f} MB"
        }
        
        conn.close()
    
    # Application statistics
    routes = []
    for rule in current_app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': ', '.join(rule.methods),
            'path': str(rule)
        })
    
    blueprints = list(current_app.blueprints.keys())
    
    return render_template(
        'dev_dashboard.html',
        system_info=system_info,
        db_stats=db_stats,
        routes=routes,
        blueprints=blueprints
    ) 