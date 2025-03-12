# Proof of Humanity - M2 Mac Optimization Guide

This guide provides specific optimizations and configurations for running the Proof of Humanity application on Apple M2 architecture. The M2 chip offers significant performance advantages when properly utilized, but requires specific considerations to maximize performance.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Testing Optimizations](#testing-optimizations)
3. [Database Performance](#database-performance)
4. [Memory Management](#memory-management)
5. [Circular Dependencies](#circular-dependencies)
6. [M2-Specific Features](#m2-specific-features)
7. [Troubleshooting](#troubleshooting)

## Environment Setup

### Python Version

For optimal performance on M2 Macs, use Python 3.11+ which includes significant performance improvements specifically beneficial on ARM architecture:

```bash
# Install Python 3.11 using homebrew
brew install python@3.11

# Verify installation
python3.11 --version
```

### Virtual Environment

Create a dedicated virtual environment for M2-optimized dependencies:

```bash
# Create virtual environment with Python 3.11
python3.11 -m venv venv_m2

# Activate the environment
source venv_m2/bin/activate

# Upgrade pip
python -m pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

### ARM-Specific Packages

Some packages have optimized versions for ARM architecture:

```bash
# NumPy with optimized Apple Metal support
pip install numpy --no-binary numpy

# Install cryptography with M2 optimizations
pip install cryptography --no-binary cryptography
```

## Testing Optimizations

### Parallel Testing

The M2 architecture excels with parallelized tests due to its efficient core design:

```bash
# Run tests using pytest-xdist with optimized number of workers
# (typically best with N-1 cores, where N is total core count)
python -m pytest -xvs --numprocesses=auto tests/

# For specific test module with detailed output
python -m pytest -xvs --numprocesses=7 tests/test_api.py
```

### Memory Profile Tests

M2 chips have a unified memory architecture that requires different optimization strategies:

```bash
# Use the performance testing script with memory tracking
python performance_test.py --memory --cpu --iterations 3

# For more detailed memory profiling
python -m memory_profiler run_tests.py
```

### Execution Time Optimization

```bash
# Run performance comparison tests
python performance_test.py --visualize

# Database-focused performance tests
python performance_test.py --database --visualize
```

## Database Performance

### SQLite Optimization

M2 Macs can achieve exceptional SQLite performance with the right configuration:

1. **Journal Mode**: Use WAL (Write-Ahead Logging) mode
   ```python
   conn.execute('PRAGMA journal_mode = WAL')
   ```

2. **Synchronous Setting**: For better performance (with slightly reduced durability)
   ```python
   conn.execute('PRAGMA synchronous = NORMAL')
   ```

3. **Cache Size**: Increase for better performance
   ```python
   conn.execute('PRAGMA cache_size = -10000')  # 10MB
   ```

4. **Memory-mapped I/O**: Enables faster reads
   ```python
   conn.execute('PRAGMA mmap_size = 30000000000')  # 30GB
   ```

### Indexing Strategy

M2 chips benefit from careful indexing strategies:

```sql
-- Create composite indexes for frequently joined tables
CREATE INDEX idx_family_user_id ON family_relationships(user_id);
CREATE INDEX idx_verifications_date_status ON verification_requests(created_at, status);
```

## Memory Management

### Python Memory Optimizations

1. **Generator Usage**: Prefer generators over lists for large datasets
   ```python
   # Instead of: results = [process(item) for item in large_list]
   # Use: results = (process(item) for item in large_list)
   ```

2. **Cleanup Unused Objects**:
   ```python
   import gc
   gc.collect()  # Manually trigger garbage collection
   ```

3. **Memory Monitoring**:
   ```python
   # Use check_circular_imports.py with memory flags
   python check_circular_imports.py --visualize --fix
   ```

## Circular Dependencies

The `check_circular_imports.py` script identifies circular imports that can significantly impact startup time on M2 architecture.

```bash
# Run the circular import detector
python check_circular_imports.py

# With visualization and fix suggestions
python check_circular_imports.py --visualize --fix
```

### Common Fixes for Circular Imports:

1. **Late/Lazy Importing**: Move imports inside functions
   ```python
   def get_user(user_id):
       from models.user import User  # Import inside function
       return User.query.get(user_id)
   ```

2. **Use Import Typing**: For type hints
   ```python
   from typing import TYPE_CHECKING
   if TYPE_CHECKING:
       from models.user import User
   ```

3. **Dependency Injection**: Pass objects rather than importing them

## M2-Specific Features

### Metal Performance Shaders

For computationally intensive tasks, utilize Metal:

```bash
# Install PyTorch with Metal support for machine learning tasks
pip install torch torchvision torchaudio
```

### Rosetta Compatibility

Some packages may still require Rosetta 2. Check for slow imports:

```bash
python -c "import time; start=time.time(); import problematic_module; print(f'Import time: {time.time()-start:.2f}s')"
```

### Efficient Subprocess Management

M2 chips benefit from specific subprocess configurations:

```python
# Set lower priority for background tasks to avoid thermal throttling
import subprocess
subprocess.Popen(['command'], preexec_fn=lambda: os.nice(10))
```

## Troubleshooting

### Common M2-Specific Issues

1. **Slow SQLite Operations**
   - Check if you're using an optimized SQLite version
   - Ensure journal mode and cache settings are optimized

2. **Memory Usage Spikes**
   - M2's unified memory requires careful monitoring
   - Run `python performance_test.py --memory` to identify issues

3. **CPU Core Balancing**
   - Ensure parallelized operations don't overwhelm efficiency cores
   - Use `--parallel` flag with an appropriate worker count

4. **Package Compatibility**
   - Some packages may not be fully optimized for ARM
   - Check for ARM-specific versions or compile from source

### Monitoring Tools

```bash
# Install monitoring tools
pip install psutil py-spy memory_profiler

# Profile CPU usage
py-spy record -o profile.svg --pid $(pgrep -f "python app.py")

# Profile memory usage
mprof run python app.py
mprof plot
```

## Continuous Integration Setup

A sample CI workflow optimized for M2 testing:

```yaml
name: M2 Optimized Testing

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      - name: Run optimization checks
        run: |
          python check_circular_imports.py
      - name: Run parallel tests
        run: |
          python -m pytest -xvs --numprocesses=auto tests/
      - name: Performance testing
        run: |
          python performance_test.py --iterations 1 --memory --cpu
```

---

This guide is specifically tailored for the Proof of Humanity application running on M2 Mac architecture. By implementing these optimizations, you can expect significant performance improvements in both development and production environments. 