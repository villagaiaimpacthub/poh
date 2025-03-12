#!/usr/bin/env python
"""
Performance testing script for Proof of Humanity on M2 Mac.
This script is designed to benchmark performance and identify bottlenecks specific to M2 architecture.
"""

import os
import sys
import time
import platform
import argparse
import subprocess
import psutil
import sqlite3
import tracemalloc
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np
from datetime import datetime

# Add the project root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

def parse_arguments():
    """Parse command line arguments for performance testing."""
    parser = argparse.ArgumentParser(description='Performance testing for Proof of Humanity on M2 Mac')
    parser.add_argument('--iterations', '-i', type=int, default=5, 
                       help='Number of test iterations to run')
    parser.add_argument('--test-module', '-m', help='Specific test module to benchmark')
    parser.add_argument('--database', '-d', action='store_true', help='Focus on database performance')
    parser.add_argument('--memory', '-mem', action='store_true', help='Track memory usage')
    parser.add_argument('--cpu', '-c', action='store_true', help='Track CPU usage')
    parser.add_argument('--visualize', '-v', action='store_true', help='Generate visualization of results')
    parser.add_argument('--parallel', '-p', type=int, help='Run tests in parallel with specified number of workers')
    return parser.parse_args()

def get_system_info():
    """Get detailed system information, with special focus on M2-specific details."""
    info = {
        "platform": platform.platform(),
        "processor": platform.processor(),
        "python_version": platform.python_version(),
        "cpu_count": os.cpu_count(),
        "memory_total": psutil.virtual_memory().total // (1024 * 1024),  # MB
    }
    
    # Get more detailed CPU info from sysctl on macOS
    if platform.system() == "Darwin":
        try:
            cpu_info = subprocess.check_output(["sysctl", "-n", "machdep.cpu.brand_string"]).decode().strip()
            info["cpu_details"] = cpu_info
        except subprocess.SubprocessError:
            info["cpu_details"] = "Could not retrieve detailed CPU info"
    
    return info

def run_test_with_metrics(test_cmd, track_memory=False, track_cpu=False):
    """Run a test command and collect performance metrics."""
    metrics = {}
    
    # Start memory tracking if requested
    if track_memory:
        tracemalloc.start()
        memory_start = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024  # MB
    
    # Start CPU tracking if requested
    if track_cpu:
        cpu_percent_start = psutil.cpu_percent(interval=0.1)
    
    # Time the test execution
    start_time = time.time()
    result = subprocess.run(test_cmd, capture_output=True, text=True)
    end_time = time.time()
    
    # Calculate basic execution time
    metrics["execution_time"] = end_time - start_time
    metrics["return_code"] = result.returncode
    
    # Collect memory metrics if requested
    if track_memory:
        current, peak = tracemalloc.get_traced_memory()
        memory_end = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024  # MB
        
        metrics["memory_usage_mb"] = memory_end - memory_start
        metrics["peak_memory_mb"] = peak / 1024 / 1024  # Convert to MB
        tracemalloc.stop()
    
    # Collect CPU metrics if requested
    if track_cpu:
        cpu_percent_end = psutil.cpu_percent(interval=0.1)
        metrics["cpu_usage_percent"] = cpu_percent_end
    
    metrics["stdout"] = result.stdout
    metrics["stderr"] = result.stderr
    
    return metrics

def build_test_command(args):
    """Build the test command based on args, with M2-specific optimizations."""
    cmd = ["python", "-m", "pytest"]
    
    # Add optimization flags for M2 Macs
    if platform.system() == "Darwin" and "arm" in platform.machine().lower():
        # Use parallel testing if specified or auto-detect optimal number
        if args.parallel:
            workers = args.parallel
        else:
            # Default to number of cores - 1 for M2 chips to leave resources for the system
            workers = max(1, os.cpu_count() - 1)
        
        cmd.extend(["-xvs", f"--numprocesses={workers}"])
    else:
        cmd.extend(["-xvs"])
    
    # Add specific test module if specified
    if args.test_module:
        cmd.append(f"tests/test_{args.test_module}.py")
    else:
        cmd.append("tests/")
    
    return cmd

def analyze_database_performance():
    """Analyze database performance specifically for M2 architecture."""
    db_path = "instance/test.db"  # Adjust path as needed
    queries = [
        "SELECT count(*) FROM users",
        "SELECT count(*) FROM family_relationships",
        "SELECT * FROM verification_requests ORDER BY created_at DESC LIMIT 10",
        "SELECT u.username, COUNT(f.id) FROM users u LEFT JOIN family_relationships f ON u.id = f.user_id GROUP BY u.id",
    ]
    
    results = {}
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        for query in queries:
            start_time = time.time()
            cursor.execute(query)
            cursor.fetchall()
            end_time = time.time()
            
            query_name = query.split()[0] + " " + query.split()[1]
            results[query_name] = end_time - start_time
        
        conn.close()
    except Exception as e:
        results["error"] = str(e)
    
    return results

def visualize_results(results):
    """Create visualizations of performance test results."""
    # Ensure output directory exists
    os.makedirs("performance_results", exist_ok=True)
    
    # Plot execution times
    plt.figure(figsize=(10, 6))
    iterations = list(range(1, len(results) + 1))
    times = [r.get("execution_time", 0) for r in results]
    
    plt.plot(iterations, times, 'o-', label='Execution Time')
    plt.title('Test Execution Time by Iteration')
    plt.xlabel('Iteration')
    plt.ylabel('Time (seconds)')
    plt.grid(True)
    plt.legend()
    
    output_file = f"performance_results/execution_time_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
    plt.savefig(output_file)
    print(f"Execution time visualization saved to {output_file}")
    
    # If memory metrics exist, plot them
    if "memory_usage_mb" in results[0]:
        plt.figure(figsize=(10, 6))
        memory_usage = [r.get("memory_usage_mb", 0) for r in results]
        peak_memory = [r.get("peak_memory_mb", 0) for r in results]
        
        plt.plot(iterations, memory_usage, 'o-', label='Memory Usage (MB)')
        plt.plot(iterations, peak_memory, 's-', label='Peak Memory (MB)')
        plt.title('Memory Usage by Iteration')
        plt.xlabel('Iteration')
        plt.ylabel('Memory (MB)')
        plt.grid(True)
        plt.legend()
        
        output_file = f"performance_results/memory_usage_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        plt.savefig(output_file)
        print(f"Memory usage visualization saved to {output_file}")

def print_summary(all_results, system_info, db_results=None):
    """Print a summary of test results with M2-specific analysis."""
    print("\n" + "=" * 80)
    print("PERFORMANCE TEST SUMMARY FOR M2 MAC")
    print("=" * 80)
    
    print("\nSystem Information:")
    for key, value in system_info.items():
        print(f"  {key}: {value}")
    
    print("\nTest Execution Summary:")
    avg_time = sum(r.get("execution_time", 0) for r in all_results) / len(all_results)
    print(f"  Average execution time: {avg_time:.3f} seconds")
    
    if "memory_usage_mb" in all_results[0]:
        avg_memory = sum(r.get("memory_usage_mb", 0) for r in all_results) / len(all_results)
        peak_memory = max(r.get("peak_memory_mb", 0) for r in all_results)
        print(f"  Average memory usage: {avg_memory:.2f} MB")
        print(f"  Peak memory usage: {peak_memory:.2f} MB")
    
    if "cpu_usage_percent" in all_results[0]:
        avg_cpu = sum(r.get("cpu_usage_percent", 0) for r in all_results) / len(all_results)
        print(f"  Average CPU usage: {avg_cpu:.2f}%")
    
    if db_results:
        print("\nDatabase Performance:")
        for query, time in db_results.items():
            if query != "error":
                print(f"  {query}: {time:.5f} seconds")
    
    # M2-specific recommendations
    print("\nM2-Specific Recommendations:")
    if avg_time > 5.0:
        print("  ⚠️ Test execution time is high. Consider increasing parallelism for M2 architecture.")
    else:
        print("  ✅ Test execution time is good for M2 architecture.")
    
    if "memory_usage_mb" in all_results[0] and avg_memory > 500:
        print("  ⚠️ Memory usage is high. Consider optimizing for efficient memory use on M2.")
    else:
        print("  ✅ Memory usage is appropriate for M2 architecture.")
    
    print("\n" + "=" * 80)

def main():
    """Main function to run performance tests."""
    args = parse_arguments()
    system_info = get_system_info()
    
    print("=" * 80)
    print(f"Running performance tests for Proof of Humanity on M2 Mac - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print("\nSystem Information:")
    for key, value in system_info.items():
        print(f"  {key}: {value}")
    
    # Run multiple iterations of tests
    all_results = []
    for i in range(args.iterations):
        print(f"\nRunning test iteration {i+1}/{args.iterations}...")
        test_cmd = build_test_command(args)
        print(f"Command: {' '.join(test_cmd)}")
        
        result = run_test_with_metrics(test_cmd, 
                                      track_memory=args.memory, 
                                      track_cpu=args.cpu)
        all_results.append(result)
        
        print(f"Execution time: {result['execution_time']:.3f} seconds")
        if args.memory:
            print(f"Memory usage: {result.get('memory_usage_mb', 'N/A')} MB")
        if args.cpu:
            print(f"CPU usage: {result.get('cpu_usage_percent', 'N/A')}%")
        
        # Wait a bit between iterations to let system stabilize
        time.sleep(1)
    
    # Run database performance analysis if requested
    db_results = None
    if args.database:
        print("\nAnalyzing database performance...")
        db_results = analyze_database_performance()
    
    # Visualize results if requested
    if args.visualize and len(all_results) > 1:
        print("\nGenerating visualizations...")
        visualize_results(all_results)
    
    # Print summary with M2-specific analysis
    print_summary(all_results, system_info, db_results)
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 