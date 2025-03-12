#!/usr/bin/env python
"""
Test runner for the Proof of Humanity application.
Runs all tests and generates a coverage report.
"""

import os
import sys
import subprocess
import argparse
from datetime import datetime

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Run tests for the Proof of Humanity application')
    parser.add_argument('--verbose', '-v', action='store_true', help='Display verbose output')
    parser.add_argument('--coverage', '-c', action='store_true', help='Generate coverage report')
    parser.add_argument('--html', action='store_true', help='Generate HTML coverage report')
    parser.add_argument('--module', '-m', help='Run tests for a specific module (e.g., api, database)')
    parser.add_argument('--failfast', '-f', action='store_true', help='Stop on first test failure')
    return parser.parse_args()

def get_test_command(args):
    """Build the test command based on arguments."""
    cmd = ['python', '-m', 'pytest']
    
    if args.verbose:
        cmd.append('-v')
    
    if args.failfast:
        cmd.append('-x')
    
    if args.coverage:
        cmd.extend(['--cov=.', '--cov-report=term'])
        if args.html:
            cmd.append('--cov-report=html')
    
    if args.module:
        cmd.append(f'tests/test_{args.module}.py')
    else:
        cmd.append('tests/')
    
    return cmd

def run_tests(cmd):
    """Run the tests with the specified command."""
    print(f"Running command: {' '.join(cmd)}")
    start_time = datetime.now()
    result = subprocess.run(cmd, capture_output=True, text=True)
    end_time = datetime.now()
    
    return result, (end_time - start_time).total_seconds()

def parse_test_results(result):
    """Parse the test results output."""
    if result.returncode == 0:
        print("\n✅ All tests passed!")
    else:
        print("\n❌ Some tests failed.")
    
    # Extract and print test summary
    output_lines = result.stdout.split('\n')
    summary_line = None
    for line in reversed(output_lines):
        if '===' in line and 'seconds' in line:
            summary_line = line
            break
    
    if summary_line:
        print(f"\nTest Summary: {summary_line.strip()}")
    
    # Extract and print coverage summary if available
    if 'TOTAL' in result.stdout:
        for line in output_lines:
            if 'TOTAL' in line:
                coverage_line = line
                break
        
        if 'coverage_line' in locals():
            print(f"\nCoverage Summary: {coverage_line.strip()}")
    
    return result.returncode

def print_failing_tests(result):
    """Print details of failing tests."""
    output_lines = result.stdout.split('\n')
    
    # Find all test failures
    failure_sections = []
    current_section = []
    in_failure = False
    
    for line in output_lines:
        if line.startswith('E       ') or line.startswith('E   '):
            in_failure = True
            current_section.append(line)
        elif in_failure and not line.strip():
            in_failure = False
            if current_section:
                failure_sections.append(current_section)
                current_section = []
    
    if current_section:  # Don't forget the last section
        failure_sections.append(current_section)
    
    # Print failure details
    if failure_sections:
        print("\nFailing Tests:")
        for i, section in enumerate(failure_sections, 1):
            print(f"\nFailure {i}:")
            for line in section:
                print(line)

def main():
    """Main function to run tests."""
    args = parse_arguments()
    
    # Ensure we're in the project root directory
    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)
    
    # Add the project root to the Python path
    sys.path.insert(0, project_root)
    
    print("=" * 80)
    print(f"Running tests for Proof of Humanity - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Build and run the test command
    cmd = get_test_command(args)
    result, duration = run_tests(cmd)
    
    # Print test output
    if args.verbose:
        print("\nTest Output:")
        print(result.stdout)
        if result.stderr:
            print("\nTest Errors:")
            print(result.stderr)
    
    # Parse and print results
    returncode = parse_test_results(result)
    
    # Print duration
    print(f"\nTotal duration: {duration:.2f} seconds")
    
    # Print failures if any
    if returncode != 0:
        print_failing_tests(result)
    
    # Print coverage report location if generated
    if args.coverage and args.html:
        print("\nHTML coverage report generated in 'htmlcov/index.html'")
    
    print("\n" + "=" * 80)
    return returncode

if __name__ == "__main__":
    sys.exit(main()) 