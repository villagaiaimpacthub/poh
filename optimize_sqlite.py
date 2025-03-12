#!/usr/bin/env python
"""
SQLite Optimizer for M2 Mac Architecture.
This script applies M2-specific optimizations to SQLite databases for the
Proof of Humanity application, focusing on performance improvements.
"""

import os
import sys
import sqlite3
import argparse
import time
from pathlib import Path

# M2-optimized pragma settings
M2_OPTIMIZED_PRAGMAS = {
    'journal_mode': 'WAL',       # Write-Ahead Logging for better concurrency
    'synchronous': 'NORMAL',     # Balance between safety and performance
    'cache_size': -10000,        # 10MB cache (negative value means kilobytes)
    'mmap_size': 30000000000,    # 30GB memory map for faster reads
    'temp_store': 'MEMORY',      # Store temp tables and indices in memory
    'foreign_keys': 'ON',        # Maintain referential integrity
    'auto_vacuum': 'INCREMENTAL' # Incremental vacuuming to manage free space
}

# For testing on different hardware
HARDWARE_PROFILES = {
    'm1': {
        'journal_mode': 'WAL',
        'synchronous': 'NORMAL',
        'cache_size': -8000,      # 8MB cache
        'mmap_size': 20000000000, # 20GB memory map
    },
    'm2': M2_OPTIMIZED_PRAGMAS,
    'm2_pro': {
        'journal_mode': 'WAL',
        'synchronous': 'NORMAL',
        'cache_size': -20000,     # 20MB cache
        'mmap_size': 40000000000, # 40GB memory map
    },
    'safe': {
        'journal_mode': 'DELETE', # Traditional rollback journal
        'synchronous': 'FULL',    # Maximum durability
        'cache_size': -2000,      # 2MB cache
        'mmap_size': 0,           # No memory mapping
    }
}

# Recommended indexes for the Proof of Humanity database
RECOMMENDED_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
    "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
    "CREATE INDEX IF NOT EXISTS idx_family_relationships_user_id ON family_relationships(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_family_relationships_relative_id ON family_relationships(relative_id)",
    "CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON verification_requests(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status)",
    "CREATE INDEX IF NOT EXISTS idx_verification_requests_created_at ON verification_requests(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_did_documents_user_id ON did_documents(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_video_sessions_user_id ON video_sessions(user_id)",
]

def parse_arguments():
    """Parse command line arguments for database optimization."""
    parser = argparse.ArgumentParser(description='Optimize SQLite database for M2 Mac')
    parser.add_argument('--database', '-d', required=True,
                        help='Path to the SQLite database file')
    parser.add_argument('--profile', '-p', choices=list(HARDWARE_PROFILES.keys()),
                        default='m2', help='Hardware profile to use (default: m2)')
    parser.add_argument('--add-indexes', '-i', action='store_true',
                        help='Add recommended indexes')
    parser.add_argument('--vacuum', '-v', action='store_true',
                        help='Run VACUUM to rebuild the database file')
    parser.add_argument('--analyze', '-a', action='store_true',
                        help='Run ANALYZE to update optimization statistics')
    parser.add_argument('--benchmark', '-b', action='store_true',
                        help='Run benchmarks to measure performance improvements')
    return parser.parse_args()

def check_database(db_path):
    """Check if the database exists and is valid."""
    if not os.path.exists(db_path):
        print(f"Error: Database file '{db_path}' does not exist.")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        conn.execute("SELECT 1")
        conn.close()
        return True
    except sqlite3.Error as e:
        print(f"Error: Cannot open database file: {e}")
        return False

def get_database_info(db_path):
    """Get information about the database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get database size
    db_size = os.path.getsize(db_path)
    
    # Get table information
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    
    table_info = {}
    for table in tables:
        table_name = table[0]
        if table_name.startswith('sqlite_'):
            continue
            
        # Count rows
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        row_count = cursor.fetchone()[0]
        
        # List columns
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        
        table_info[table_name] = {
            'rows': row_count,
            'columns': [col[1] for col in columns]
        }
    
    # Get existing indexes
    cursor.execute("SELECT name, tbl_name FROM sqlite_master WHERE type='index'")
    indexes = cursor.fetchall()
    
    # Get current pragma settings
    pragmas = {}
    for pragma in M2_OPTIMIZED_PRAGMAS.keys():
        cursor.execute(f"PRAGMA {pragma}")
        result = cursor.fetchone()
        pragmas[pragma] = result[0] if result else None
    
    conn.close()
    
    return {
        'size': db_size,
        'tables': table_info,
        'indexes': indexes,
        'pragmas': pragmas
    }

def apply_optimizations(db_path, profile, add_indexes=False):
    """Apply the specified optimizations to the database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print(f"\nApplying {profile} optimizations to {db_path}...")
    
    # Apply pragmas from the selected profile
    for pragma, value in HARDWARE_PROFILES[profile].items():
        try:
            cursor.execute(f"PRAGMA {pragma} = {value}")
            print(f"  ✅ Set {pragma} = {value}")
        except sqlite3.Error as e:
            print(f"  ❌ Failed to set {pragma}: {e}")
    
    # Add recommended indexes if requested
    if add_indexes:
        print("\nAdding recommended indexes...")
        for index_sql in RECOMMENDED_INDEXES:
            try:
                cursor.execute(index_sql)
                # Extract index name from SQL
                index_name = index_sql.split('CREATE INDEX IF NOT EXISTS ')[1].split(' ON')[0]
                print(f"  ✅ Created index: {index_name}")
            except sqlite3.Error as e:
                print(f"  ❌ Failed to create index: {e}")
    
    conn.commit()
    conn.close()

def run_vacuum(db_path):
    """Run VACUUM to rebuild the database file."""
    print(f"\nRunning VACUUM on {db_path}...")
    print("This may take a while for large databases.")
    
    conn = sqlite3.connect(db_path)
    
    try:
        start_time = time.time()
        conn.execute("VACUUM")
        end_time = time.time()
        
        duration = end_time - start_time
        print(f"  ✅ VACUUM completed in {duration:.2f} seconds")
    except sqlite3.Error as e:
        print(f"  ❌ VACUUM failed: {e}")
    
    conn.close()

def run_analyze(db_path):
    """Run ANALYZE to update statistics used by the query optimizer."""
    print(f"\nRunning ANALYZE on {db_path}...")
    
    conn = sqlite3.connect(db_path)
    
    try:
        start_time = time.time()
        conn.execute("ANALYZE")
        end_time = time.time()
        
        duration = end_time - start_time
        print(f"  ✅ ANALYZE completed in {duration:.2f} seconds")
    except sqlite3.Error as e:
        print(f"  ❌ ANALYZE failed: {e}")
    
    conn.close()

def run_benchmark(db_path):
    """Run some benchmark queries to measure performance."""
    print(f"\nRunning performance benchmarks on {db_path}...")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get list of tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = [row[0] for row in cursor.fetchall()]
    
    if not tables:
        print("  ❌ No user tables found in database")
        conn.close()
        return
    
    # Benchmark queries
    benchmark_queries = []
    
    # Generate benchmarks for each table
    for table in tables:
        # Count rows
        benchmark_queries.append({
            "name": f"Count rows in {table}",
            "query": f"SELECT COUNT(*) FROM {table}"
        })
        
        # Get columns for the table
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [row[1] for row in cursor.fetchall()]
        
        if columns:
            # Simple select with limit
            benchmark_queries.append({
                "name": f"Select from {table} with limit",
                "query": f"SELECT * FROM {table} LIMIT 100"
            })
            
            # Select with ordering
            if len(columns) > 0:
                benchmark_queries.append({
                    "name": f"Select from {table} with ordering",
                    "query": f"SELECT * FROM {table} ORDER BY {columns[0]} LIMIT 100"
                })
    
    # Add some common queries for the Proof of Humanity application
    proof_of_humanity_queries = [
        {
            "name": "User verification status",
            "query": """
                SELECT u.username, COUNT(v.id) as verification_count, MAX(v.status) as latest_status 
                FROM users u 
                LEFT JOIN verification_requests v ON u.id = v.user_id 
                GROUP BY u.id LIMIT 100
            """
        },
        {
            "name": "Family relationships",
            "query": """
                SELECT u1.username as user, u2.username as relative, f.relationship_type 
                FROM family_relationships f
                JOIN users u1 ON f.user_id = u1.id
                JOIN users u2 ON f.relative_id = u2.id
                LIMIT 100
            """
        },
        {
            "name": "Recent verification requests",
            "query": """
                SELECT v.id, u.username, v.created_at, v.status
                FROM verification_requests v
                JOIN users u ON v.user_id = u.id
                ORDER BY v.created_at DESC LIMIT 100
            """
        }
    ]
    
    # Add Proof of Humanity queries if the relevant tables exist
    required_tables = ['users', 'verification_requests', 'family_relationships']
    if all(table in tables for table in required_tables):
        benchmark_queries.extend(proof_of_humanity_queries)
    
    # Run and time each query
    results = []
    for benchmark in benchmark_queries:
        try:
            # Run query 3 times and average (to warm up cache)
            times = []
            for _ in range(3):
                start_time = time.time()
                cursor.execute(benchmark["query"])
                cursor.fetchall()
                end_time = time.time()
                times.append(end_time - start_time)
            
            # Take the average of the last 2 runs (ignore first run which includes compilation)
            avg_time = sum(times[1:]) / len(times[1:])
            results.append({
                "name": benchmark["name"],
                "time": avg_time
            })
            print(f"  📊 {benchmark['name']}: {avg_time:.6f} seconds")
        except sqlite3.Error as e:
            print(f"  ❌ Query failed: {benchmark['name']} - {e}")
    
    conn.close()
    
    if results:
        print("\nBenchmark Summary:")
        print(f"  Average query time: {sum(r['time'] for r in results) / len(results):.6f} seconds")
        print(f"  Fastest query: {min(results, key=lambda x: x['time'])['name']} ({min(r['time'] for r in results):.6f} seconds)")
        print(f"  Slowest query: {max(results, key=lambda x: x['time'])['name']} ({max(r['time'] for r in results):.6f} seconds)")

def summarize_optimizations(db_path, before, after):
    """Summarize the changes made to the database."""
    print("\nOptimization Summary:")
    
    # Database size change
    size_before = before['size']
    size_after = after['size']
    size_diff = size_after - size_before
    size_percent = (size_diff / size_before) * 100 if size_before > 0 else 0
    
    print(f"  Database Size: {size_before:,} bytes → {size_after:,} bytes "
          f"({size_diff:+,} bytes, {size_percent:+.1f}%)")
    
    # Pragma changes
    print("\n  PRAGMA Settings:")
    for pragma, before_value in before['pragmas'].items():
        after_value = after['pragmas'].get(pragma)
        if before_value != after_value:
            print(f"    {pragma}: {before_value} → {after_value}")
        else:
            print(f"    {pragma}: {before_value} (unchanged)")
    
    # Index changes
    before_indexes = set(idx[0] for idx in before['indexes'])
    after_indexes = set(idx[0] for idx in after['indexes'])
    
    new_indexes = after_indexes - before_indexes
    if new_indexes:
        print("\n  Added Indexes:")
        for idx in new_indexes:
            print(f"    ✅ {idx}")

def main():
    """Main function to optimize the database."""
    args = parse_arguments()
    
    print("=" * 80)
    print("SQLite Optimizer for M2 Mac")
    print("=" * 80)
    
    # Check if the database exists and is valid
    if not check_database(args.database):
        return 1
    
    # Get database information before optimization
    print(f"\nAnalyzing database: {args.database}")
    before_info = get_database_info(args.database)
    
    # Display basic database info
    print(f"\nDatabase Size: {before_info['size']:,} bytes")
    print(f"Tables: {len(before_info['tables'])}")
    print(f"Indexes: {len(before_info['indexes'])}")
    
    # Apply optimizations
    apply_optimizations(args.database, args.profile, args.add_indexes)
    
    # Run VACUUM if requested
    if args.vacuum:
        run_vacuum(args.database)
    
    # Run ANALYZE if requested
    if args.analyze:
        run_analyze(args.database)
    
    # Get database information after optimization
    after_info = get_database_info(args.database)
    
    # Summarize the changes
    summarize_optimizations(args.database, before_info, after_info)
    
    # Run benchmark if requested
    if args.benchmark:
        run_benchmark(args.database)
    
    print("\nOptimization complete! Your database is now optimized for M2 Mac performance.")
    print("=" * 80)
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 