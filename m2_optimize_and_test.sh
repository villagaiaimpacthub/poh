#!/bin/bash
# M2 Mac Optimization and Testing Script for Proof of Humanity
# This script automates the process of optimizing and testing the application on M2 Macs

set -e  # Exit on error

# ANSI color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DB_PATH="instance/poh.sqlite"
PERF_ITERATIONS=3
PARALLEL_WORKERS=$(( $(sysctl -n hw.ncpu) - 1 ))  # Use all cores except one

# Banner
echo -e "${BLUE}=================================================================${NC}"
echo -e "${BLUE}    Proof of Humanity - M2 Optimization and Testing Suite        ${NC}"
echo -e "${BLUE}=================================================================${NC}"

# Check if running on M2 Mac
echo -e "\n${YELLOW}Checking system compatibility...${NC}"
if [[ "$(sysctl -n machdep.cpu.brand_string)" == *"Apple M"* ]]; then
    echo -e "${GREEN}✓ Running on Apple Silicon Mac${NC}"
    MAC_TYPE="M$(sysctl -n machdep.cpu.brand_string | grep -o 'M[0-9]' | cut -c2-)"
    echo -e "  Detected: Apple ${MAC_TYPE}"
else
    echo -e "${YELLOW}! Not running on Apple Silicon - some optimizations may not be applicable${NC}"
    MAC_TYPE="generic"
fi

# Check Python version
echo -e "\n${YELLOW}Checking Python version...${NC}"
PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
echo -e "  Python ${PYTHON_VERSION} detected"

PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

if [[ $PYTHON_MAJOR -eq 3 && $PYTHON_MINOR -ge 11 ]]; then
    echo -e "${GREEN}✓ Using Python 3.11+ which is optimal for M2 Macs${NC}"
else
    echo -e "${YELLOW}! Using Python $PYTHON_VERSION. Consider upgrading to Python 3.11+ for better performance on M2${NC}"
fi

# Ensure virtual environment is activated
echo -e "\n${YELLOW}Checking virtual environment...${NC}"
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo -e "${YELLOW}! Virtual environment not active. Attempting to activate...${NC}"
    if [[ -d "venv" ]]; then
        source venv/bin/activate
        echo -e "${GREEN}✓ Activated virtual environment: $VIRTUAL_ENV${NC}"
    else
        echo -e "${YELLOW}! No 'venv' directory found.${NC}"
        read -p "Create a new virtual environment? (y/n): " CREATE_VENV
        if [[ "$CREATE_VENV" == "y" ]]; then
            echo "Creating virtual environment..."
            python -m venv venv
            source venv/bin/activate
            echo -e "${GREEN}✓ Created and activated virtual environment${NC}"
        else
            echo -e "${YELLOW}Continuing without virtual environment - not recommended${NC}"
        fi
    fi
else
    echo -e "${GREEN}✓ Virtual environment active: $VIRTUAL_ENV${NC}"
fi

# Install dependencies
echo -e "\n${YELLOW}Checking dependencies...${NC}"

REQUIRED_PACKAGES=(
    "pytest" 
    "pytest-cov" 
    "pytest-xdist" 
    "networkx" 
    "matplotlib" 
    "memory_profiler"
)

MISSING_PACKAGES=()
for package in "${REQUIRED_PACKAGES[@]}"; do
    python -c "import $package" 2>/dev/null || MISSING_PACKAGES+=("$package")
done

if [[ ${#MISSING_PACKAGES[@]} -gt 0 ]]; then
    echo -e "${YELLOW}! Some required packages are missing. Installing...${NC}"
    pip install ${MISSING_PACKAGES[@]}
    echo -e "${GREEN}✓ All required packages installed${NC}"
else
    echo -e "${GREEN}✓ All required packages are installed${NC}"
fi

# Check database
echo -e "\n${YELLOW}Checking database...${NC}"
if [[ ! -f "$DB_PATH" ]]; then
    echo -e "${YELLOW}! Database not found at $DB_PATH${NC}"
    
    if [[ -f "init_db.py" ]]; then
        echo "Initializing database using init_db.py..."
        python init_db.py
        echo -e "${GREEN}✓ Database initialized${NC}"
    else
        echo -e "${RED}✗ Database not found and init_db.py not available.${NC}"
        echo -e "${YELLOW}Will continue without database optimizations${NC}"
    fi
else
    echo -e "${GREEN}✓ Database found at $DB_PATH${NC}"
fi

# Run circular import check
echo -e "\n${BLUE}=================================================================${NC}"
echo -e "${BLUE}Running Circular Import Detection${NC}"
echo -e "${BLUE}=================================================================${NC}"

echo "This will detect any circular imports that could impact performance..."
python check_circular_imports.py --visualize

# Database optimization
if [[ -f "$DB_PATH" ]]; then
    echo -e "\n${BLUE}=================================================================${NC}"
    echo -e "${BLUE}Running Database Optimization${NC}"
    echo -e "${BLUE}=================================================================${NC}"

    echo "Optimizing database for M2 Mac performance..."
    python optimize_sqlite.py --database "$DB_PATH" --profile "m2" --add-indexes --analyze --benchmark
fi

# Run performance tests
echo -e "\n${BLUE}=================================================================${NC}"
echo -e "${BLUE}Running Performance Tests${NC}"
echo -e "${BLUE}=================================================================${NC}"

echo "Running performance tests with M2 optimizations..."
python performance_test.py --memory --cpu --visualize --iterations $PERF_ITERATIONS

# Run the full test suite with parallelization
echo -e "\n${BLUE}=================================================================${NC}"
echo -e "${BLUE}Running Full Test Suite${NC}"
echo -e "${BLUE}=================================================================${NC}"

echo "Running test suite with M2-optimized parallel execution..."
python -m pytest -xvs --numprocesses=$PARALLEL_WORKERS tests/

# Output final report
echo -e "\n${BLUE}=================================================================${NC}"
echo -e "${BLUE}M2 Optimization Report${NC}"
echo -e "${BLUE}=================================================================${NC}"

echo -e "\n${GREEN}Tests completed successfully!${NC}"
echo -e "\nPerformance optimization notes for ${YELLOW}Apple ${MAC_TYPE}${NC}:"
echo -e " • Used ${YELLOW}$PARALLEL_WORKERS${NC} parallel workers for testing"
echo -e " • Python version: ${YELLOW}$PYTHON_VERSION${NC}"

if [[ -f "performance_results/execution_time_"* ]]; then
    echo -e " • Performance visualizations available in ${YELLOW}performance_results/${NC} directory"
fi

if [[ -f "import_analysis/import_graph.png" ]]; then
    echo -e " • Import analysis visualization available at ${YELLOW}import_analysis/import_graph.png${NC}"
fi

echo -e "\n${YELLOW}Next steps:${NC}"
echo " 1. Review the M2_OPTIMIZATION.md file for additional tips"
echo " 2. Check the performance test results for potential bottlenecks"
echo " 3. Apply any recommended M2-specific optimizations to your code"

echo -e "\n${BLUE}=================================================================${NC}" 