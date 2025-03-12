#!/usr/bin/env python
"""
Circular Import Detector for Proof of Humanity on M2 Mac.
This script identifies circular imports that can impact performance,
especially on M2 architecture where import time can affect startup.
"""

import os
import sys
import re
import time
import argparse
import importlib
import pkgutil
import inspect
from pathlib import Path
from collections import defaultdict, deque
import networkx as nx
import matplotlib.pyplot as plt

def parse_arguments():
    """Parse command line arguments for circular import detection."""
    parser = argparse.ArgumentParser(description='Detect circular imports in Python codebase')
    parser.add_argument('--visualize', '-v', action='store_true', 
                        help='Generate visualization of import dependencies')
    parser.add_argument('--fix', '-f', action='store_true',
                        help='Attempt to suggest fixes for circular imports')
    parser.add_argument('--package', '-p', default='.',
                        help='Root package to analyze (default: current directory)')
    parser.add_argument('--exclude', '-e', nargs='+', default=['tests', 'venv'],
                        help='Directories to exclude (default: tests, venv)')
    return parser.parse_args()

def find_python_files(root_dir, exclude_dirs=None):
    """Find all Python files in the given directory, excluding specified directories."""
    if exclude_dirs is None:
        exclude_dirs = []
    
    python_files = []
    root_path = Path(root_dir).resolve()
    
    for path in root_path.rglob('*.py'):
        # Skip excluded directories
        if any(excluded in path.parts for excluded in exclude_dirs):
            continue
        python_files.append(str(path))
    
    return python_files

def extract_imports(file_path):
    """Extract all import statements from a Python file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Regular expressions to match different import patterns
    import_patterns = [
        r'^import\s+([\w.]+)',  # import module
        r'^from\s+([\w.]+)\s+import',  # from module import ...
    ]
    
    imports = []
    for pattern in import_patterns:
        for match in re.finditer(pattern, content, re.MULTILINE):
            imports.append(match.group(1))
    
    return imports

def build_import_graph(python_files):
    """Build a directed graph of import dependencies."""
    graph = nx.DiGraph()
    file_to_module = {}
    
    # Map file paths to module names
    for file_path in python_files:
        # Convert file path to relative module path
        # Remove .py extension and replace / with .
        rel_path = os.path.relpath(file_path)
        module_name = os.path.splitext(rel_path)[0].replace(os.path.sep, '.')
        file_to_module[file_path] = module_name
        graph.add_node(module_name)
    
    # Add edges for imports
    for file_path in python_files:
        source_module = file_to_module[file_path]
        imports = extract_imports(file_path)
        
        for imported_module in imports:
            # Only add edge if the imported module is in our graph
            # (i.e., it's a local module, not a third-party or standard library)
            if any(imported_module.startswith(m) for m in graph.nodes()):
                # Find the closest matching module
                matching_modules = [m for m in graph.nodes() if imported_module.startswith(m)]
                if matching_modules:
                    target_module = max(matching_modules, key=len)
                    graph.add_edge(source_module, target_module)
    
    return graph

def find_circular_imports(graph):
    """Find all cycles (circular imports) in the import graph."""
    try:
        cycles = list(nx.simple_cycles(graph))
        return cycles
    except nx.NetworkXNoCycle:
        return []

def visualize_import_graph(graph, cycles=None):
    """Visualize the import graph, highlighting circular imports."""
    plt.figure(figsize=(12, 10))
    
    # Create positions for nodes
    pos = nx.spring_layout(graph, seed=42)
    
    # Draw the graph
    nx.draw_networkx_nodes(graph, pos, node_size=500, node_color='lightblue')
    nx.draw_networkx_labels(graph, pos, font_size=8)
    
    # Draw edges
    edge_colors = []
    for u, v in graph.edges():
        if cycles and any(u in cycle and v in cycle for cycle in cycles):
            edge_colors.append('red')
        else:
            edge_colors.append('black')
    
    nx.draw_networkx_edges(graph, pos, width=1.0, edge_color=edge_colors, 
                          arrowsize=15, connectionstyle='arc3,rad=0.1')
    
    # Add a title
    plt.title('Import Dependencies (Red edges indicate circular imports)')
    plt.axis('off')
    
    # Save the visualization
    os.makedirs('import_analysis', exist_ok=True)
    plt.savefig('import_analysis/import_graph.png', dpi=300, bbox_inches='tight')
    print(f"Import graph visualization saved to import_analysis/import_graph.png")

def suggest_fixes(python_files, cycles):
    """Suggest potential fixes for circular imports."""
    if not cycles:
        print("No circular imports to fix.")
        return
    
    print("\nSuggested fixes for circular imports:")
    
    for i, cycle in enumerate(cycles, 1):
        print(f"\nCircular Import Chain {i}: {' -> '.join(cycle)} -> {cycle[0]}")
        
        # For each module in the cycle
        for module in cycle:
            # Convert module name to file path
            module_parts = module.split('.')
            module_path = os.path.join(*module_parts) + '.py'
            
            # Find the file that most closely matches this module
            matching_files = [f for f in python_files if module_path in f.replace(os.path.sep, '/')]
            
            if matching_files:
                file_path = matching_files[0]
                print(f"\n  In file {file_path}:")
                
                # Extract the specific imports for this cycle
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.readlines()
                
                # Find import lines that reference other modules in the cycle
                other_modules = [m for m in cycle if m != module]
                import_lines = []
                
                for i, line in enumerate(content):
                    if any(re.search(rf'from\s+{re.escape(m)}|import\s+{re.escape(m)}', line) for m in other_modules):
                        import_lines.append((i, line.strip()))
                
                if import_lines:
                    for line_num, line in import_lines:
                        print(f"    Line {line_num + 1}: {line}")
                    
                    # Suggest potential solutions
                    print("\n  Potential solutions:")
                    print("    1. Move imports inside functions or methods (lazy imports)")
                    print("    2. Extract common functionality to a new module")
                    print("    3. Use dependency injection instead of direct imports")
                    
                    # Specific example for lazy imports
                    for _, line in import_lines:
                        indent = "      "
                        print(f"\n    Example of lazy import:")
                        print(f"{indent}# Instead of at the module level:")
                        print(f"{indent}{line}")
                        print(f"{indent}# Move inside the functions that use it:")
                        print(f"{indent}def some_function():")
                        print(f"{indent}    {line}")
                        print(f"{indent}    # Rest of the function...")
                        break  # Just show one example

def measure_import_times(python_files):
    """Measure the time it takes to import each module."""
    import_times = {}
    
    for file_path in python_files:
        # Convert file path to module name
        rel_path = os.path.relpath(file_path)
        module_name = os.path.splitext(rel_path)[0].replace(os.path.sep, '.')
        
        try:
            # Measure import time
            start_time = time.time()
            spec = importlib.util.find_spec(module_name)
            if spec is not None:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                end_time = time.time()
                import_times[module_name] = end_time - start_time
        except (ImportError, ModuleNotFoundError):
            # Skip modules that can't be imported
            pass
        except Exception as e:
            # Other errors during import
            import_times[module_name] = f"Error: {str(e)[:100]}"
    
    return import_times

def main():
    """Main function to detect circular imports."""
    args = parse_arguments()
    
    print("=" * 80)
    print("CIRCULAR IMPORT DETECTOR FOR PROOF OF HUMANITY")
    print("=" * 80)
    print(f"\nAnalyzing Python files in {args.package}...")
    
    # Find Python files to analyze
    python_files = find_python_files(args.package, args.exclude)
    print(f"Found {len(python_files)} Python files to analyze.")
    
    # Build import graph
    print("\nBuilding import dependency graph...")
    graph = build_import_graph(python_files)
    print(f"Graph contains {len(graph.nodes())} modules and {len(graph.edges())} dependencies.")
    
    # Find circular imports
    print("\nSearching for circular imports...")
    cycles = find_circular_imports(graph)
    
    if cycles:
        print(f"Found {len(cycles)} circular import chains:")
        for i, cycle in enumerate(cycles, 1):
            print(f"  {i}. {' -> '.join(cycle)} -> {cycle[0]}")
    else:
        print("No circular imports found! Your codebase is clean.")
    
    # Measure import times for performance analysis
    print("\nMeasuring module import times (M2 optimization analysis)...")
    import_times = measure_import_times(python_files)
    
    # Sort modules by import time
    sorted_imports = sorted(
        [(module, time) for module, time in import_times.items() if isinstance(time, float)],
        key=lambda x: x[1],
        reverse=True
    )
    
    if sorted_imports:
        print("\nSlowest module imports (potential M2 optimization targets):")
        for module, import_time in sorted_imports[:10]:  # Show top 10
            print(f"  {module}: {import_time:.6f} seconds")
    
    # Visualize import graph if requested
    if args.visualize:
        try:
            print("\nGenerating import graph visualization...")
            visualize_import_graph(graph, cycles)
        except Exception as e:
            print(f"Error generating visualization: {str(e)}")
    
    # Suggest fixes for circular imports if requested
    if args.fix and cycles:
        suggest_fixes(python_files, cycles)
    
    print("\n" + "=" * 80)
    return 0

if __name__ == "__main__":
    sys.exit(main()) 