#!/bin/bash

# Cursor Project Memory Analysis Script
# Identifies potential memory issues in a project that might cause Cursor to crash
# -----------------------------------------------------------------------------

# Text formatting
BOLD='\033[1m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default thresholds
THRESHOLD_LARGE_FILE=10M
THRESHOLD_DEEP_DIR=10
THRESHOLD_LARGE_GIT=1048576
THRESHOLD_LARGE_NODE_MODULES=1048576
THRESHOLD_LARGE_BUILD_DIR=524288
THRESHOLD_LONG_LINE=10000
THRESHOLD_LARGE_MINIFIED=1048576
THRESHOLD_PYTHON_FILES=1000
THRESHOLD_PYTHON_IMPORTS=100

# Parse command line arguments
VERBOSE=false
ANALYZE_PYTHON=false
ANALYZE_IMPORTS=false
ANALYZE_VENV=false
EXCLUDE_PATHS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --python|-p)
            ANALYZE_PYTHON=true
            shift
            ;;
        --imports|-i)
            ANALYZE_IMPORTS=true
            shift
            ;;
        --include-venv)
            ANALYZE_VENV=true
            shift
            ;;
        --exclude=*)
            EXCLUDE_PATHS="$EXCLUDE_PATHS ${1#*=}"
            shift
            ;;
        --thresholds=*)
            # Parse threshold values
            THRESHOLDS="${1#*=}"
            for threshold in ${THRESHOLDS//,/ }; do
                case "${threshold%%=*}" in
                    large_file) THRESHOLD_LARGE_FILE="${threshold##*=}" ;;
                    deep_dir) THRESHOLD_DEEP_DIR="${threshold##*=}" ;;
                    large_git) THRESHOLD_LARGE_GIT="${threshold##*=}" ;;
                    large_node_modules) THRESHOLD_LARGE_NODE_MODULES="${threshold##*=}" ;;
                    large_build_dir) THRESHOLD_LARGE_BUILD_DIR="${threshold##*=}" ;;
                    long_line) THRESHOLD_LONG_LINE="${threshold##*=}" ;;
                    large_minified) THRESHOLD_LARGE_MINIFIED="${threshold##*=}" ;;
                    python_files) THRESHOLD_PYTHON_FILES="${threshold##*=}" ;;
                    python_imports) THRESHOLD_PYTHON_IMPORTS="${threshold##*=}" ;;
                esac
            done
            shift
            ;;
        *)
            PROJECT_DIR="$1"
            shift
            ;;
    esac
done

# Function to print section headers
print_header() {
    echo -e "\n${BOLD}${BLUE}$1${NC}"
    echo -e "${BLUE}$(printf '=%.0s' {1..50})${NC}\n"
}

# Function to print warnings
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print errors
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print debug info
print_debug() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}🔍 $1${NC}"
    fi
}

# Check if a project directory is provided
if [ -z "$PROJECT_DIR" ]; then
    echo -e "${BOLD}Cursor Project Memory Analysis Script${NC}"
    echo "This script analyzes a project directory for potential memory issues that might cause Cursor to crash."
    echo ""
    echo "Usage: $0 [options] <project_directory>"
    echo ""
    echo "Options:"
    echo "  --verbose, -v           Show detailed analysis information"
    echo "  --python, -p            Enable Python-specific analysis"
    echo "  --imports, -i           Analyze Python import complexity"
    echo "  --include-venv          Include virtual environment in analysis"
    echo "  --exclude=path1,path2   Exclude specific paths from analysis"
    echo "  --thresholds=key=value  Set custom thresholds (comma-separated)"
    echo ""
    echo "Example thresholds:"
    echo "  large_file=20M"
    echo "  deep_dir=15"
    echo "  large_git=2048576"
    echo "  python_files=2000"
    echo ""
    exit 1
fi

# Check if the directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Directory does not exist: $PROJECT_DIR"
    exit 1
fi

print_header "ANALYZING PROJECT: $PROJECT_DIR"
print_debug "Using thresholds:"
print_debug "  Large file: $THRESHOLD_LARGE_FILE"
print_debug "  Deep directory: $THRESHOLD_DEEP_DIR"
print_debug "  Large git: $THRESHOLD_LARGE_GIT"
print_debug "  Large node_modules: $THRESHOLD_LARGE_NODE_MODULES"
print_debug "  Large build dir: $THRESHOLD_LARGE_BUILD_DIR"
print_debug "  Long line: $THRESHOLD_LONG_LINE"
print_debug "  Large minified: $THRESHOLD_LARGE_MINIFIED"
print_debug "  Python files: $THRESHOLD_PYTHON_FILES"
print_debug "  Python imports: $THRESHOLD_PYTHON_IMPORTS"

# Build find command with exclusions
FIND_CMD="find \"$PROJECT_DIR\" -type f"
if [ "$ANALYZE_VENV" = false ]; then
    FIND_CMD="$FIND_CMD -not -path \"*/venv/*\""
fi
for path in $EXCLUDE_PATHS; do
    FIND_CMD="$FIND_CMD -not -path \"*/$path/*\""
done

# Get project size
print_header "PROJECT SIZE"
PROJECT_SIZE=$(du -sh "$PROJECT_DIR" | cut -f1)
echo "Total project size: $PROJECT_SIZE"

# Count number of files
FILE_COUNT=$(eval "$FIND_CMD" | wc -l)
echo "Total number of files: $FILE_COUNT"

if [ "$FILE_COUNT" -gt 10000 ]; then
    print_warning "Large number of files detected (>10,000), which may cause indexing issues in Cursor"
fi

# Check for large files
print_header "LARGE FILES"
echo "Files larger than $THRESHOLD_LARGE_FILE that might cause memory issues:"
eval "$FIND_CMD -size +$THRESHOLD_LARGE_FILE" | while read -r file; do
    file_size=$(du -h "$file" | cut -f1)
    echo "- $file_size: ${file#$PROJECT_DIR/}"
done

# Check for very deep directory structures
print_header "DIRECTORY DEPTH"
MAX_DEPTH=$(find "$PROJECT_DIR" -type d -not -path "*/node_modules/*" -not -path "*/\.*" | awk -F"/" '{print NF}' | sort -nr | head -1)
echo "Maximum directory depth: $MAX_DEPTH"

if [ "$MAX_DEPTH" -gt "$THRESHOLD_DEEP_DIR" ]; then
    print_warning "Deep directory structure detected (depth > $THRESHOLD_DEEP_DIR), which may increase indexing complexity"
fi

# Check for git repository size
print_header "GIT REPOSITORY"
if [ -d "$PROJECT_DIR/.git" ]; then
    GIT_SIZE=$(du -sh "$PROJECT_DIR/.git" | cut -f1)
    echo "Git repository size: $GIT_SIZE"
    
    # Check if git repo is large
    GIT_SIZE_BYTES=$(du -s "$PROJECT_DIR/.git" | cut -f1)
    if [ "$GIT_SIZE_BYTES" -gt "$THRESHOLD_LARGE_GIT" ]; then
        print_warning "Large git repository detected (>$(numfmt --to=iec $THRESHOLD_LARGE_GIT)), which may cause performance issues in Cursor's git integration"
    fi
fi

# Python-specific analysis
if [ "$ANALYZE_PYTHON" = true ]; then
    print_header "PYTHON ANALYSIS"
    
    # Count Python files
    PYTHON_FILES=$(eval "$FIND_CMD -name \"*.py\"" | wc -l)
    echo "Python files: $PYTHON_FILES"
    
    if [ "$PYTHON_FILES" -gt "$THRESHOLD_PYTHON_FILES" ]; then
        print_warning "Large Python project detected (>$THRESHOLD_PYTHON_FILES files), which may cause heavy Python language server memory usage"
    fi
    
    # Check for virtual environment
    if [ -d "$PROJECT_DIR/venv" ]; then
        VENV_SIZE=$(du -sh "$PROJECT_DIR/venv" | cut -f1)
        echo "Virtual environment size: $VENV_SIZE"
        
        # Check for large compiled files
        echo "Large compiled Python files (>5MB):"
        find "$PROJECT_DIR/venv" -type f -name "*.so" -size +5M | while read -r file; do
            file_size=$(du -h "$file" | cut -f1)
            echo "- $file_size: ${file#$PROJECT_DIR/}"
        done

        # Analyze virtual environment structure
        echo "Analyzing virtual environment structure..."
        VENV_PACKAGES=$(find "$PROJECT_DIR/venv/lib" -maxdepth 2 -type d -name "site-packages" 2>/dev/null)
        if [ -n "$VENV_PACKAGES" ]; then
            echo "Large packages in virtual environment (>10MB):"
            for pkg_dir in $VENV_PACKAGES; do
                find "$pkg_dir" -maxdepth 1 -type d -exec du -sh {} \; | sort -hr | head -n 5 | while read -r size dir; do
                    if [ "${size%M}" -gt 10 ]; then
                        echo "- $size: $(basename "$dir")"
                    fi
                done
            done
        fi
    fi

    # Check for Python cache files
    print_header "PYTHON CACHE ANALYSIS"
    CACHE_FILES=$(find "$PROJECT_DIR" -type f -name "*.pyc" -o -name "*.pyo" -o -name "*.pyd" | wc -l)
    CACHE_DIRS=$(find "$PROJECT_DIR" -type d -name "__pycache__" | wc -l)
    echo "Python cache files: $CACHE_FILES"
    echo "Python cache directories: $CACHE_DIRS"
    
    if [ "$CACHE_FILES" -gt 1000 ]; then
        print_warning "Large number of Python cache files detected (>1000), consider adding __pycache__ to .gitignore"
    fi

    # Analyze imports if requested
    if [ "$ANALYZE_IMPORTS" = true ]; then
        print_header "PYTHON IMPORT ANALYSIS"
        
        # Create a temporary file for import analysis
        TEMP_FILE=$(mktemp)
        
        # Find all Python files and analyze their imports
        eval "$FIND_CMD -name \"*.py\"" | while read -r file; do
            IMPORT_COUNT=$(grep -c "^import\|^from" "$file")
            if [ "$IMPORT_COUNT" -gt "$THRESHOLD_PYTHON_IMPORTS" ]; then
                echo "- ${file#$PROJECT_DIR/}: $IMPORT_COUNT imports" >> "$TEMP_FILE"
            fi
        done
        
        if [ -s "$TEMP_FILE" ]; then
            print_warning "Files with high number of imports (>$THRESHOLD_PYTHON_IMPORTS):"
            cat "$TEMP_FILE"
        else
            print_success "No files with excessive imports found"
        fi

        # Analyze import patterns
        echo "Analyzing import patterns..."
        MEMORY_INTENSIVE_PACKAGES="numpy pandas tensorflow torch scipy scikit-learn matplotlib seaborn"
        for pkg in $MEMORY_INTENSIVE_PACKAGES; do
            PKG_COUNT=$(grep -r "import $pkg\|from $pkg" "$PROJECT_DIR"/*.py 2>/dev/null | wc -l)
            if [ "$PKG_COUNT" -gt 0 ]; then
                echo "- Found $PKG_COUNT uses of $pkg (memory-intensive package)"
            fi
        done
        
        rm "$TEMP_FILE"
    fi

    # Check for requirements.txt and analyze dependencies
    if [ -f "$PROJECT_DIR/requirements.txt" ]; then
        print_header "PYTHON DEPENDENCY ANALYSIS"
        
        # Count total dependencies
        DEP_COUNT=$(wc -l < "$PROJECT_DIR/requirements.txt")
        echo "Total dependencies: $DEP_COUNT"
        
        # Check for memory-intensive packages
        echo "Checking for memory-intensive packages..."
        for pkg in $MEMORY_INTENSIVE_PACKAGES; do
            if grep -qi "^$pkg" "$PROJECT_DIR/requirements.txt"; then
                print_warning "Memory-intensive package found: $pkg"
            fi
        done

        # Check for version constraints
        echo "Analyzing version constraints..."
        UNCONSTRAINED=$(grep -c "^[a-zA-Z0-9-]\+$" "$PROJECT_DIR/requirements.txt")
        if [ "$UNCONSTRAINED" -gt 0 ]; then
            print_warning "Found $UNCONSTRAINED unconstrained dependencies in requirements.txt"
        fi
    fi
fi

# Check for package dependencies
print_header "DEPENDENCY ANALYSIS"

# JavaScript/Node.js
if [ -f "$PROJECT_DIR/package.json" ]; then
    echo "Found Node.js project"
    
    # Count dependencies
    if [ -f "$PROJECT_DIR/package-lock.json" ]; then
        DEP_COUNT=$(grep -o "\"node_modules/" "$PROJECT_DIR/package-lock.json" | wc -l)
        echo "Approximate number of npm dependencies (including nested): $DEP_COUNT"
        
        if [ "$DEP_COUNT" -gt 1000 ]; then
            print_warning "Very large number of npm dependencies detected (>1000), which may cause memory issues"
        fi
    elif [ -f "$PROJECT_DIR/yarn.lock" ]; then
        DEP_COUNT=$(grep -c "^@\|^[a-zA-Z0-9]" "$PROJECT_DIR/yarn.lock")
        echo "Approximate number of yarn dependencies: $DEP_COUNT"
        
        if [ "$DEP_COUNT" -gt 1000 ]; then
            print_warning "Very large number of yarn dependencies detected (>1000), which may cause memory issues"
        fi
    fi
    
    # Check for node_modules size
    if [ -d "$PROJECT_DIR/node_modules" ]; then
        NODE_MODULES_SIZE=$(du -sh "$PROJECT_DIR/node_modules" | cut -f1)
        echo "node_modules size: $NODE_MODULES_SIZE"
        
        NODE_MODULES_SIZE_BYTES=$(du -s "$PROJECT_DIR/node_modules" | cut -f1)
        if [ "$NODE_MODULES_SIZE_BYTES" -gt "$THRESHOLD_LARGE_NODE_MODULES" ]; then
            print_warning "Very large node_modules directory (>$(numfmt --to=iec $THRESHOLD_LARGE_NODE_MODULES)) may cause indexing issues in Cursor"
        fi
    fi
fi

# Python dependencies
if [ "$ANALYZE_PYTHON" = true ] && [ -f "$PROJECT_DIR/requirements.txt" ]; then
    echo "Found Python project"
    DEP_COUNT=$(wc -l < "$PROJECT_DIR/requirements.txt")
    echo "Number of Python dependencies: $DEP_COUNT"
    
    if [ "$DEP_COUNT" -gt 100 ]; then
        print_warning "Large number of Python dependencies detected (>100), which may cause memory issues"
    fi
fi

# Check for potential memory-intensive language servers
print_header "LANGUAGE ANALYSIS"

# Check for languages that might require memory-intensive language servers
TYPESCRIPT_FILES=$(eval "$FIND_CMD -name \"*.ts\" -o -name \"*.tsx\"" | wc -l)
JAVA_FILES=$(eval "$FIND_CMD -name \"*.java\"" | wc -l)
RUST_FILES=$(eval "$FIND_CMD -name \"*.rs\"" | wc -l)
CPP_FILES=$(eval "$FIND_CMD -name \"*.cpp\" -o -name \"*.hpp\"" | wc -l)

echo "TypeScript/TSX files: $TYPESCRIPT_FILES"
echo "Java files: $JAVA_FILES"
echo "Rust files: $RUST_FILES"
echo "C++ files: $CPP_FILES"

if [ "$TYPESCRIPT_FILES" -gt 1000 ]; then
    print_warning "Large TypeScript project detected (>1000 files), which may cause heavy TypeScript server memory usage"
fi

if [ "$JAVA_FILES" -gt 500 ]; then
    print_warning "Large Java project detected (>500 files), which may cause heavy Java language server memory usage"
fi

if [ "$RUST_FILES" -gt 500 ]; then
    print_warning "Large Rust project detected (>500 files), which may cause heavy Rust language server memory usage"
fi

if [ "$CPP_FILES" -gt 500 ]; then
    print_warning "Large C++ project detected (>500 files), which may cause heavy C++ language server memory usage"
fi

# Check for circular dependencies in JavaScript/TypeScript project
print_header "CIRCULAR DEPENDENCY ANALYSIS"

# Only run if we have Node.js project and madge installed
if [ -f "$PROJECT_DIR/package.json" ]; then
    if command -v npx &> /dev/null && npx madge --version &> /dev/null; then
        echo "Checking for circular dependencies using madge..."
        
        cd "$PROJECT_DIR" || exit
        
        if [ "$TYPESCRIPT_FILES" -gt 0 ]; then
            # For TypeScript projects
            if [ -f "tsconfig.json" ]; then
                echo "TypeScript project detected, checking TS files..."
                CIRCULAR=$(npx madge --circular --extensions ts,tsx --ts-config tsconfig.json . 2>/dev/null)
                
                if [ -n "$CIRCULAR" ]; then
                    print_error "Circular dependencies detected in TypeScript files:"
                    echo "$CIRCULAR"
                else
                    print_success "No circular dependencies found in TypeScript files"
                fi
            fi
        else
            # For JavaScript projects
            echo "JavaScript project detected, checking JS files..."
            CIRCULAR=$(npx madge --circular . 2>/dev/null)
            
            if [ -n "$CIRCULAR" ]; then
                print_error "Circular dependencies detected in JavaScript files:"
                echo "$CIRCULAR"
            else
                print_success "No circular dependencies found in JavaScript files"
            fi
        fi
    else
        print_warning "madge not installed - skipping circular dependency check. Run 'npm install -g madge' to enable this analysis."
    fi
fi

# Check for memory configuration in project configs
print_header "CONFIGURATION ANALYSIS"

# Check for .vscode/settings.json
if [ -f "$PROJECT_DIR/.vscode/settings.json" ]; then
    echo "Found VSCode settings"
    
    # Check for memory-intensive settings
    if grep -q "typescript.tsserver.maxTsServerMemory" "$PROJECT_DIR/.vscode/settings.json"; then
        TS_MEMORY=$(grep "typescript.tsserver.maxTsServerMemory" "$PROJECT_DIR/.vscode/settings.json" | grep -o "[0-9]*")
        echo "TypeScript server memory limit: ${TS_MEMORY}MB"
        
        if [ "$TS_MEMORY" -gt 2048 ]; then
            print_warning "High TypeScript server memory limit (>${TS_MEMORY}MB) may cause memory issues with 8GB RAM"
        fi
    else
        print_warning "No explicit TypeScript server memory limit set, which may lead to excessive memory usage"
    fi
fi

# Check for large generated files or build artifacts
print_header "BUILD ARTIFACTS"

# Look for build directories and their sizes
for dir in "build" "dist" "target" "out" "bin" "obj" ".next" ".nuxt"; do
    if [ -d "$PROJECT_DIR/$dir" ]; then
        DIR_SIZE=$(du -sh "$PROJECT_DIR/$dir" | cut -f1)
        echo "$dir directory size: $DIR_SIZE"
        
        DIR_SIZE_BYTES=$(du -s "$PROJECT_DIR/$dir" | cut -f1)
        if [ "$DIR_SIZE_BYTES" -gt "$THRESHOLD_LARGE_BUILD_DIR" ]; then
            print_warning "Large $dir directory (>$(numfmt --to=iec $THRESHOLD_LARGE_BUILD_DIR)) may cause indexing issues in Cursor"
        fi
    fi
done

# Check for potential problematic files that might cause Cursor to hang
print_header "PROBLEMATIC FILES"

# Long single-line files (common culprit for editor hangs)
echo "Checking for long single-line files (>$THRESHOLD_LONG_LINE characters per line)..."
eval "$FIND_CMD -not -path \"*/node_modules/*\" -not -path \"*/\.*\" -name \"*.js\" -o -name \"*.ts\" -o -name \"*.jsx\" -o -name \"*.tsx\" -o -name \"*.json\" -o -name \"*.py\"" | xargs grep -l ".\{$THRESHOLD_LONG_LINE\}" 2>/dev/null | while read -r file; do
    print_warning "Extremely long line detected in: ${file#$PROJECT_DIR/}"
done

# Large minified files
echo "Checking for large minified/compressed files..."
eval "$FIND_CMD -name \"*.min.js\" -o -name \"*.min.css\"" | while read -r file; do
    if [ "$(wc -c < "$file")" -gt "$THRESHOLD_LARGE_MINIFIED" ]; then
        file_size=$(du -h "$file" | cut -f1)
        print_warning "Large minified file: ${file#$PROJECT_DIR/} ($file_size)"
    fi
done

# Final recommendations
print_header "RECOMMENDATIONS"

RAM_HEAVY_PROJECT=false

# Set RAM_HEAVY_PROJECT based on previous findings
if [ "$FILE_COUNT" -gt 10000 ] || 
   [ "$TYPESCRIPT_FILES" -gt 1000 ] || 
   [ "$JAVA_FILES" -gt 500 ] || 
   [ "$RUST_FILES" -gt 500 ] || 
   [ "$CPP_FILES" -gt 500 ] ||
   [ "$PYTHON_FILES" -gt "$THRESHOLD_PYTHON_FILES" ]; then
    RAM_HEAVY_PROJECT=true
fi

if [ "$RAM_HEAVY_PROJECT" = true ]; then
    print_warning "This appears to be a memory-intensive project which may cause Cursor to crash on systems with 8GB RAM."
    echo ""
    echo "Recommended actions:"
    echo "1. Use the Cursor optimization script before opening this project"
    echo "2. Consider excluding large directories from the Cursor workspace"
    echo "3. Split your workspace into smaller sub-projects"
    echo "4. Disable language servers for languages you're not actively working with"
    echo "5. Close other memory-intensive applications before using Cursor"
    
    # Check if .vscode/settings.json exists, if not suggest creating one
    if [ ! -f "$PROJECT_DIR/.vscode/settings.json" ]; then
        echo ""
        echo "Consider creating a .vscode/settings.json file with the following content:"
        cat << EOF
{
  "typescript.tsserver.maxTsServerMemory": 2048,
  "typescript.disableAutomaticTypeAcquisition": true,
  "javascript.suggest.enabled": false,
  "typescript.suggest.enabled": false,
  "javascript.validate.enable": false,
  "typescript.validate.enable": false,
  "editor.formatOnSave": false,
  "editor.formatOnType": false,
  "editor.suggest.showKeywords": false,
  "editor.minimap.enabled": false,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/venv": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/venv": true
  }
}
EOF
    fi
else
    print_success "This project doesn't show obvious signs of being memory-intensive."
    echo "If you're still experiencing Cursor crashes, consider:"
    echo "1. Monitoring memory usage while working on this project"
    echo "2. Running Cursor with the --disable-extensions flag"
    echo "3. Updating to the latest version of Cursor"
fi

print_header "ANALYSIS COMPLETE" 