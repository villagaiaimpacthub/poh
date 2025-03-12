#!/bin/bash

# optimize-cursor.sh - Optimize environment for running Cursor on M2 MacBook Pro with 8GB RAM

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> /tmp/cursor-optimize.log
}

log "Starting Cursor optimization..."

# Clear memory caches
log "Clearing memory caches..."
sudo purge
sync

# Clear various caches with proper permissions
log "Clearing system caches..."
sudo rm -rf ~/Library/Caches/*
sudo rm -rf ~/Library/Application\ Support/Cursor/Cache/*
sudo rm -rf ~/Library/Application\ Support/Cursor/Code\ Cache/*

# Set environment variables to optimize Cursor
log "Setting optimization environment variables..."
export CURSOR_DISABLE_GPU=1
export CURSOR_DISABLE_EXTENSIONS=1
export CURSOR_DISABLE_AUTO_UPDATE=1
export CURSOR_DISABLE_TELEMETRY=1
export CURSOR_DISABLE_WORKSPACE_TRUST=1
export CURSOR_DISABLE_GIT=1
export CURSOR_DISABLE_LANGUAGE_SERVERS=1
export CURSOR_DISABLE_AI_COMPLETION=1
export CURSOR_DISABLE_REAL_TIME_COLLABORATION=1

# Create or modify Cursor settings with proper permissions
log "Configuring Cursor settings..."
sudo mkdir -p ~/Library/Application\ Support/Cursor/User
sudo chown -R $USER:staff ~/Library/Application\ Support/Cursor
cat > ~/Library/Application\ Support/Cursor/User/settings.json << EOL
{
    "editor.minimap.enabled": false,
    "editor.formatOnSave": false,
    "editor.formatOnPaste": false,
    "editor.formatOnType": false,
    "editor.suggestOnTriggerCharacters": false,
    "editor.quickSuggestions": {
        "other": false,
        "comments": false,
        "strings": false
    },
    "editor.acceptSuggestionOnEnter": "off",
    "editor.snippetSuggestions": "none",
    "editor.wordBasedSuggestions": "off",
    "editor.parameterHints.enabled": false,
    "editor.hover.enabled": false,
    "editor.linkedEditing": false,
    "editor.gotoLocation.multipleTypeDefinitions": "goto",
    "editor.gotoLocation.multipleDeclarations": "goto",
    "editor.gotoLocation.multipleImplementations": "goto",
    "editor.gotoLocation.multipleReferences": "goto",
    "workbench.editor.limit.enabled": true,
    "workbench.editor.limit.value": 3,
    "files.autoSave": "off",
    "files.watcherExclude": {
        "**/.git/objects/**": true,
        "**/.git/subtree-cache/**": true,
        "**/node_modules/**": true,
        "**/.hg/store/**": true
    },
    "search.exclude": {
        "**/node_modules": true,
        "**/bower_components": true,
        "**/*.code-search": true
    },
    "files.exclude": {
        "**/.git": true,
        "**/.svn": true,
        "**/.hg": true,
        "**/CVS": true,
        "**/.DS_Store": true,
        "**/Thumbs.db": true
    }
}
EOL

# Set memory limits for Node.js (used by Cursor)
log "Setting Node.js memory limits..."
export NODE_OPTIONS="--max-old-space-size=4096"

# Disable GPU compositing with proper permissions
log "Disabling GPU compositing..."
sudo defaults write com.apple.universalaccess reduceMotion -bool true
sudo defaults write com.apple.universalaccess reduceTransparency -bool true

log "Optimization complete!" 