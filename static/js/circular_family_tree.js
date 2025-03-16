/**
 * Browser detection utility
 * @returns {Object} Object containing browser information
 */
function detectBrowser() {
    const userAgent = navigator.userAgent;
    let browserName = "Unknown";
    let browserVersion = "Unknown";
    let isSafari = false;
    let isIOS = false;
    
    // Safari detection
    if (userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") === -1) {
        browserName = "Safari";
        isSafari = true;
        
        // Extract Safari version
        const safariMatch = userAgent.match(/Version\/(\d+\.\d+)/);
        if (safariMatch) {
            browserVersion = safariMatch[1];
        }
    } 
    // Chrome detection
    else if (userAgent.indexOf("Chrome") > -1) {
        browserName = "Chrome";
        
        // Extract Chrome version
        const chromeMatch = userAgent.match(/Chrome\/(\d+\.\d+)/);
        if (chromeMatch) {
            browserVersion = chromeMatch[1];
        }
    } 
    // Firefox detection
    else if (userAgent.indexOf("Firefox") > -1) {
        browserName = "Firefox";
        
        // Extract Firefox version
        const firefoxMatch = userAgent.match(/Firefox\/(\d+\.\d+)/);
        if (firefoxMatch) {
            browserVersion = firefoxMatch[1];
        }
    } 
    // Edge detection
    else if (userAgent.indexOf("Edg") > -1) {
        browserName = "Edge";
        
        // Extract Edge version
        const edgeMatch = userAgent.match(/Edg\/(\d+\.\d+)/);
        if (edgeMatch) {
            browserVersion = edgeMatch[1];
        }
    }
    
    // iOS detection
    if (
        /iPad|iPhone|iPod/.test(userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    ) {
        isIOS = true;
    }
    
    return {
        name: browserName,
        version: browserVersion,
        isSafari: isSafari,
        isIOS: isIOS,
        userAgent: userAgent
    };
}

/**
 * Circular Family Tree Visualization
 * D3.js-based visualization with concentric circles of family relationships
 */
class CircularFamilyTree {
    /**
     * Constructor for the Circular Family Tree Visualization
     * @param {Object} config - Configuration object
     * @param {string} config.containerId - ID of the container element
     * @param {number} [config.width] - Width of the visualization
     * @param {number} [config.height] - Height of the visualization
     * @param {string} [config.title] - Title of the visualization
     */
    constructor(config) {
        // Detect browser for better debugging
        this.browser = detectBrowser();
        console.log('[CIRCULAR-TREE] Browser detected:', this.browser);
        
        console.log('[CIRCULAR-TREE] Constructor called with config:', config);
        
        // Set default container ID if not provided
        if (typeof config === 'string') {
            config = { containerId: config };
        }
        
        this.containerId = config.containerId || 'visualization-container';
        this.initialized = false;
        
        // Set safe default dimensions first
        this.width = config.width || 800;
        this.height = config.height || 600;
        this.title = config.title || 'Family Network Visualization';
        
        // Node colors for different levels
        this.nodeColors = {
            1: "#FFD700", // Gold for center/user
            2: "#7a43ff", // Purple for parents
            3: "#43d1ff", // Blue for grandparents
            4: "#4CAF50"  // Green for great grandparents
        };
        
        // Add Safari-specific handling if needed
        if (this.browser.isSafari) {
            console.log('[CIRCULAR-TREE] Safari detected, using Safari-specific initialization');
            // For Safari, we'll use a longer initial delay and more aggressive retry strategy
            setTimeout(() => this.initWithRetries(0, true), 100);
        } else {
            // Safe initialization with retries for other browsers
            this.initWithRetries();
        }
    }
    
    /**
     * Initialize with retries to handle DOM timing issues
     * @param {number} retryCount - Number of retry attempts
     * @param {boolean} isSafari - Whether the browser is Safari
     */
    initWithRetries(retryCount = 0, isSafari = false) {
        console.log(`[CIRCULAR-TREE] Attempting initialization, retry: ${retryCount}`);
        
        // Check if container exists
        this.container = document.getElementById(this.containerId);
        
        // Log container status
        console.log(`[CIRCULAR-TREE] Container lookup for ID '${this.containerId}':`, this.container);
        
        if (!this.container) {
            console.warn(`[CIRCULAR-TREE] Container with ID '${this.containerId}' not found.`);
            
            // If we've retried too many times, use default dimensions
            if (retryCount >= 5) {
                console.error(`[CIRCULAR-TREE] Max retries reached. Using default dimensions.`);
                // We'll still try to initialize with default dimensions
                this.initialize();
                return;
            }
            
            // Retry after a short delay (exponential backoff)
            const delay = Math.min(100 * Math.pow(2, retryCount), 2000);
            console.log(`[CIRCULAR-TREE] Retrying in ${delay}ms...`);
            
            setTimeout(() => {
                this.initWithRetries(retryCount + 1, isSafari);
            }, delay);
            
            return;
        }
        
        // Container exists, try to get dimensions safely
        try {
            // For Safari, add extra checks
            if (isSafari) {
                console.log('[CIRCULAR-TREE] Using Safari-specific dimension detection');
                
                // Force a reflow to ensure dimensions are available
                void this.container.offsetWidth;
                
                // Get dimensions directly first
                const containerWidth = this.container.offsetWidth;
                const containerHeight = this.container.offsetHeight;
                
                console.log('[CIRCULAR-TREE] Direct dimensions:', {
                    offsetWidth: containerWidth,
                    offsetHeight: containerHeight
                });
                
                if (containerWidth > 0 && containerHeight > 0) {
                    this.width = containerWidth;
                    this.height = Math.max(containerHeight, 300); // Ensure minimum height
                    
                    console.log(`[CIRCULAR-TREE] Using direct dimensions: ${this.width}x${this.height}`);
                    this.initialize();
                    return;
                }
            }
            
            // Wait for next animation frame to ensure DOM is ready
            window.requestAnimationFrame(() => {
                try {
                    // Safe method to get container dimensions
                    const containerStyle = window.getComputedStyle(this.container);
                    const rect = this.container.getBoundingClientRect();
                    
                    console.log(`[CIRCULAR-TREE] Container computed style:`, {
                        width: containerStyle.width,
                        height: containerStyle.height
                    });
                    console.log(`[CIRCULAR-TREE] Container rect:`, rect);
                    
                    // Use computed width if available, otherwise use getBoundingClientRect
                    if (containerStyle && containerStyle.width) {
                        const styleWidth = parseFloat(containerStyle.width);
                        if (styleWidth && !isNaN(styleWidth)) {
                            this.width = styleWidth;
                        }
                    } else if (rect && rect.width) {
                        this.width = rect.width;
                    }
                    
                    // Only use container height if it's reasonable
                    if (containerStyle && containerStyle.height) {
                        const styleHeight = parseFloat(containerStyle.height);
                        if (styleHeight && !isNaN(styleHeight) && styleHeight > 100) {
                            this.height = styleHeight;
                        }
                    } else if (rect && rect.height && rect.height > 100) {
                        this.height = rect.height;
                    }
                    
                    console.log(`[CIRCULAR-TREE] Final dimensions set to: ${this.width}x${this.height}`);
                    
                    // Initialize the visualization
                    this.initialize();
                } catch (error) {
                    console.error('[CIRCULAR-TREE] Error getting container dimensions:', error);
                    // Initialize with default dimensions
                    this.initialize();
                }
            });
        } catch (error) {
            console.error('[CIRCULAR-TREE] Error during initialization:', error);
            // Initialize with default dimensions as a fallback
            this.initialize();
        }
    }
    
    /**
     * Initialize the visualization
     */
    initialize() {
        if (this.initialized) {
            console.log('[CIRCULAR-TREE] Already initialized, skipping');
            return;
        }
        
        try {
            console.log(`[CIRCULAR-TREE] Initializing with dimensions ${this.width}x${this.height}`);
            
            // Create SVG element - use selector string instead of referencing this.container
            // This provides an additional layer of safety
            this.svg = d3.select(`#${this.containerId}`)
                .append("svg")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("viewBox", `0 0 ${this.width} ${this.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .style("background", "rgba(15, 15, 35, 0.3)")
                .style("border-radius", "8px");
            
            // Add a background
            this.svg.append("rect")
                .attr("width", "100%")
                .attr("height", "100%")
                .attr("fill", "rgba(15, 15, 35, 0.3)")
                .attr("rx", 8)
                .attr("ry", 8);
                
            // Add title
            this.svg.append("text")
                .attr("x", this.width / 2)
                .attr("y", 30)
                .attr("text-anchor", "middle")
                .attr("fill", "white")
                .style("font-size", "18px")
                .style("font-weight", "bold")
                .text(this.title);
                
            // Create visualization group centered in the SVG
            this.vizGroup = this.svg.append("g")
                .attr("transform", `translate(${this.width / 2}, ${this.height / 2})`);
                
            // Create the visualization
            this.createCircularTree();
            
            // Add buttons
            this.addGrowNetworkButton();
            this.addResetButton();
            
            // Mark as initialized
            this.initialized = true;
            
            // Try to hide loading indicator
            this.hideLoadingIndicator();
            
            console.log(`[CIRCULAR-TREE] Visualization successfully initialized`);
        } catch (error) {
            console.error("[CIRCULAR-TREE] Error initializing visualization:", error);
            this.showErrorMessage(error.message);
        }
    }
    
    /**
     * Hide loading indicator if it exists
     */
    hideLoadingIndicator() {
        try {
            // Try multiple selector approaches for robustness
            const selectors = [
                `#${this.containerId} .loading-indicator`,
                `#loading-indicator`,
                `.loading-indicator`
            ];
            
            for (const selector of selectors) {
                const indicator = document.querySelector(selector);
                if (indicator) {
                    console.log(`[CIRCULAR-TREE] Found loading indicator with selector: ${selector}`);
                    indicator.style.display = 'none';
                    return;
                }
            }
        } catch (error) {
            console.error('[CIRCULAR-TREE] Error hiding loading indicator:', error);
        }
    }
    
    /**
     * Show error message in the visualization container
     */
    showErrorMessage(message) {
        try {
            // Try to find the container again
            const container = document.getElementById(this.containerId);
            if (container) {
                container.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: white; background-color: rgba(15, 23, 42, 0.7); border-radius: 8px;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ff5757; margin-bottom: 1rem;"></i>
                        <p>Error loading visualization: ${message}</p>
                        <p style="margin-top: 0.5rem; font-size: 0.9rem; color: rgba(255, 255, 255, 0.7);">Try refreshing the page or check console for details.</p>
                    </div>
                `;
            }
            
            // Also try to update any loading indicators
            const selectors = [
                `#loading-indicator`,
                `.loading-indicator`
            ];
            
            for (const selector of selectors) {
                const indicator = document.querySelector(selector);
                if (indicator) {
                    indicator.innerHTML = `
                        <div style="text-align: center; color: white;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #ff5757; margin-bottom: 1rem;"></i>
                            <p>Error loading visualization: ${message}</p>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('[CIRCULAR-TREE] Error showing error message:', error);
        }
    }
    
    /**
     * Create the circular tree visualization
     */
    createCircularTree() {
        // Clear previous visualization
        this.vizGroup.selectAll("*").remove();
        
        // Define node data
        this.nodes = [];
        this.links = [];
        
        // Define level properties
        const levels = {
            1: { count: 1, radius: Math.min(this.width, this.height) * 0.05, nodeRadius: 20 },
            2: { count: 8, radius: Math.min(this.width, this.height) * 0.15, nodeRadius: 15 },
            3: { count: 24, radius: Math.min(this.width, this.height) * 0.25, nodeRadius: 12 },
            4: { count: 48, radius: Math.min(this.width, this.height) * 0.35, nodeRadius: 8 }
        };
        
        // Create center node (level 1 - gold)
        const centerNode = {
            id: "center",
            x: 0,
            y: 0,
            color: this.nodeColors[1],
            level: 1,
            currentLevel: 1,
            radius: levels[1].nodeRadius
        };
        this.nodes.push(centerNode);
        
        // Create nodes for level 2 (purple)
        for (let i = 0; i < levels[2].count; i++) {
            const angle = (i / levels[2].count) * 2 * Math.PI;
            const node = {
                id: `level2-${i}`,
                x: levels[2].radius * Math.cos(angle),
                y: levels[2].radius * Math.sin(angle),
                color: this.nodeColors[2],
                level: 2,
                currentLevel: 2,
                radius: levels[2].nodeRadius,
                angle: angle
            };
            this.nodes.push(node);
            
            // Create link to center
            this.links.push({
                source: centerNode,
                target: node,
                sourceLevel: 1,
                targetLevel: 2
            });
        }
        
        // Create nodes for level 3 (blue)
        const level2Nodes = this.nodes.filter(n => n.level === 2);
        for (let i = 0; i < level2Nodes.length; i++) {
            const parentNode = level2Nodes[i];
            const childCount = 3; // Each level 2 node has 3 children
            
            for (let j = 0; j < childCount; j++) {
                // Calculate position with offset from parent's angle
                const angleOffset = ((j - (childCount - 1) / 2) * 0.1);
                const angle = parentNode.angle + angleOffset;
                
                const node = {
                    id: `level3-${i}-${j}`,
                    x: levels[3].radius * Math.cos(angle),
                    y: levels[3].radius * Math.sin(angle),
                    color: this.nodeColors[3],
                    level: 3,
                    currentLevel: 3,
                    radius: levels[3].nodeRadius,
                    angle: angle
                };
                this.nodes.push(node);
                
                // Create link to parent
                this.links.push({
                    source: parentNode,
                    target: node,
                    sourceLevel: 2,
                    targetLevel: 3
                });
            }
        }
        
        // Create nodes for level 4 (green)
        const level3Nodes = this.nodes.filter(n => n.level === 3);
        for (let i = 0; i < level3Nodes.length; i++) {
            const parentNode = level3Nodes[i];
            const childCount = 2; // Each level 3 node has 2 children
            
            for (let j = 0; j < childCount; j++) {
                // Calculate position with offset from parent's angle
                const angleOffset = ((j - (childCount - 1) / 2) * 0.05);
                const angle = parentNode.angle + angleOffset;
                
                const node = {
                    id: `level4-${i}-${j}`,
                    x: levels[4].radius * Math.cos(angle),
                    y: levels[4].radius * Math.sin(angle),
                    color: this.nodeColors[4],
                    level: 4,
                    currentLevel: 4,
                    radius: levels[4].nodeRadius,
                    angle: angle
                };
                this.nodes.push(node);
                
                // Create link to parent
                this.links.push({
                    source: parentNode,
                    target: node,
                    sourceLevel: 3,
                    targetLevel: 4
                });
            }
        }
        
        // Create additional connections between nodes within the same level
        // Connect level 2 nodes (purple)
        for (let i = 0; i < level2Nodes.length; i++) {
            const nextIdx = (i + 1) % level2Nodes.length;
            this.links.push({
                source: level2Nodes[i],
                target: level2Nodes[nextIdx],
                sourceLevel: 2,
                targetLevel: 2,
                sameLevel: true
            });
        }
        
        // Connect level 3 nodes (blue) to others with the same parent
        const level3ByParent = {};
        level3Nodes.forEach(node => {
            const parentId = node.id.split('-')[1];
            if (!level3ByParent[parentId]) level3ByParent[parentId] = [];
            level3ByParent[parentId].push(node);
        });
        
        Object.values(level3ByParent).forEach(siblings => {
            for (let i = 0; i < siblings.length; i++) {
                const nextIdx = (i + 1) % siblings.length;
                this.links.push({
                    source: siblings[i],
                    target: siblings[nextIdx],
                    sourceLevel: 3,
                    targetLevel: 3,
                    sameLevel: true
                });
            }
        });
        
        // Draw links
        const linksGroup = this.vizGroup.append("g").attr("class", "links");
        
        this.links.forEach(link => {
            // Create gradient for the link
            const gradientId = `link-gradient-${link.source.id}-${link.target.id}`;
            const gradient = this.svg.append("defs")
                .append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", 1)
                .attr("y2", 0);
                
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", link.source.color);
                
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", link.target.color);
            
            // Draw the link
            linksGroup.append("line")
                .attr("x1", link.source.x)
                .attr("y1", link.source.y)
                .attr("x2", link.target.x)
                .attr("y2", link.target.y)
                .attr("stroke", link.sameLevel ? `url(#${gradientId})` : `url(#${gradientId})`)
                .attr("stroke-width", link.sameLevel ? 1 : 2)
                .attr("opacity", link.sameLevel ? 0.3 : 0.7)
                .attr("stroke-dasharray", link.sameLevel ? "3,3" : null);
        });
        
        // Draw nodes
        const nodesGroup = this.vizGroup.append("g").attr("class", "nodes");
        
        this.nodeElements = nodesGroup.selectAll(".node")
            .data(this.nodes)
            .enter()
            .append("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.x}, ${d.y})`)
            .attr("data-id", d => d.id)
            .attr("data-level", d => d.level);
        
        // Add node circles
        this.nodeElements.append("circle")
            .attr("r", d => d.radius)
            .attr("fill", d => d.color)
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .attr("opacity", 0.9);
        
        // Add pulse animation for center node
        if (this.nodes.length > 0) {
            const pulseGroup = this.vizGroup.append("g").attr("class", "pulse-group");
            
            pulseGroup.append("circle")
                .attr("class", "pulse-circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", 20)
                .attr("fill", "none")
                .attr("stroke", this.nodeColors[1])
                .attr("stroke-width", 2)
                .attr("opacity", 0.7);
                
            // Add CSS for pulse animation
            if (!document.querySelector('#pulse-animation')) {
                const style = document.createElement('style');
                style.id = 'pulse-animation';
                style.textContent = `
                    @keyframes pulse {
                        0% {
                            transform: scale(1);
                            opacity: 0.7;
                        }
                        70% {
                            transform: scale(2);
                            opacity: 0;
                        }
                        100% {
                            transform: scale(1);
                            opacity: 0;
                        }
                    }
                    
                    .pulse-circle {
                        animation: pulse 2s infinite;
                    }
                `;
                document.head.appendChild(style);
            }
        }
        
        // Add the legend
        this.addLegend();
    }
    
    /**
     * Add a button to grow the network (level up all nodes)
     */
    addGrowNetworkButton() {
        const buttonGroup = this.svg.append("g")
            .attr("class", "button-group")
            .attr("transform", `translate(${this.width - 120}, ${this.height - 60})`)
            .style("cursor", "pointer")
            .on("click", () => this.levelUpNodes());
            
        // Button background
        buttonGroup.append("rect")
            .attr("width", 120)
            .attr("height", 40)
            .attr("rx", 20)
            .attr("ry", 20)
            .attr("fill", "rgba(122, 67, 255, 0.8)")
            .attr("stroke", "white")
            .attr("stroke-width", 1);
            
        // Button text
        buttonGroup.append("text")
            .attr("x", 60)
            .attr("y", 25)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("fill", "white")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text("Grow Network");
            
        // Button hover effect
        buttonGroup.on("mouseover", function() {
            d3.select(this).select("rect")
                .transition()
                .duration(200)
                .attr("fill", "rgba(122, 67, 255, 1)")
                .attr("transform", "scale(1.05)");
        })
        .on("mouseout", function() {
            d3.select(this).select("rect")
                .transition()
                .duration(200)
                .attr("fill", "rgba(122, 67, 255, 0.8)")
                .attr("transform", "scale(1)");
        });
    }
    
    /**
     * Add a reset button to reset the visualization
     */
    addResetButton() {
        const buttonGroup = this.svg.append("g")
            .attr("class", "reset-button-group")
            .attr("transform", `translate(${this.width - 120}, ${this.height - 110})`)
            .style("cursor", "pointer")
            .on("click", () => this.resetNetwork());
            
        // Button background
        buttonGroup.append("rect")
            .attr("width", 120)
            .attr("height", 40)
            .attr("rx", 20)
            .attr("ry", 20)
            .attr("fill", "rgba(67, 209, 255, 0.8)")
            .attr("stroke", "white")
            .attr("stroke-width", 1);
            
        // Button text
        buttonGroup.append("text")
            .attr("x", 60)
            .attr("y", 25)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("fill", "white")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text("Reset");
            
        // Button hover effect
        buttonGroup.on("mouseover", function() {
            d3.select(this).select("rect")
                .transition()
                .duration(200)
                .attr("fill", "rgba(67, 209, 255, 1)")
                .attr("transform", "scale(1.05)");
        })
        .on("mouseout", function() {
            d3.select(this).select("rect")
                .transition()
                .duration(200)
                .attr("fill", "rgba(67, 209, 255, 0.8)")
                .attr("transform", "scale(1)");
        });
    }
    
    /**
     * Reset the network to its original state
     */
    resetNetwork() {
        // Reset all nodes to their original levels
        this.nodes.forEach(node => {
            node.currentLevel = node.level;
        });
        
        // Update node colors
        this.vizGroup.selectAll(".node circle")
            .transition()
            .duration(800)
            .attr("fill", d => this.nodeColors[d.currentLevel]);
    }
    
    /**
     * Level up all nodes (change color based on level)
     */
    levelUpNodes() {
        // Start from outer nodes and work inward
        const level4Nodes = this.nodes.filter(n => n.currentLevel === 4);
        const level3Nodes = this.nodes.filter(n => n.currentLevel === 3);
        const level2Nodes = this.nodes.filter(n => n.currentLevel === 2);
        
        console.log("[VISUALIZATION] Starting level up sequence");
        console.log("[VISUALIZATION] Level 4 nodes:", level4Nodes.length);
        console.log("[VISUALIZATION] Level 3 nodes:", level3Nodes.length);
        console.log("[VISUALIZATION] Level 2 nodes:", level2Nodes.length);
        
        // First animation: level 4 nodes turn to level 3 color
        this.animateLevelChange(level4Nodes, 3, () => {
            // Second animation: level 3 nodes turn to level 2 color
            this.animateLevelChange(level3Nodes, 2, () => {
                // Third animation: level 2 nodes turn to level 1 color
                this.animateLevelChange(level2Nodes, 1, () => {
                    console.log("[VISUALIZATION] Level up sequence complete");
                });
            });
        });
    }
    
    /**
     * Animate level change for a set of nodes
     * @param {Array} nodes - Nodes to animate
     * @param {number} newLevel - New level value
     * @param {Function} callback - Callback after animation completes
     */
    animateLevelChange(nodes, newLevel, callback) {
        if (nodes.length === 0) {
            if (callback) callback();
            return;
        }
        
        console.log(`[VISUALIZATION] Animating ${nodes.length} nodes to level ${newLevel}`);
        
        const duration = 1000;
        let completed = 0;
        
        // Animate each node's color change
        nodes.forEach(node => {
            const nodeElement = this.vizGroup.select(`.node[data-id="${node.id}"]`).select("circle");
            
            if (!nodeElement.empty()) {
                nodeElement.transition()
                    .duration(duration)
                    .attr("fill", this.nodeColors[newLevel])
                    .on("end", () => {
                        // Update node data
                        node.color = this.nodeColors[newLevel];
                        node.currentLevel = newLevel;
                        
                        // Check if all nodes completed animation
                        completed++;
                        if (completed === nodes.length && callback) {
                            callback();
                        }
                    });
            } else {
                console.warn(`[VISUALIZATION] Node element not found for ID: ${node.id}`);
                completed++;
                if (completed === nodes.length && callback) {
                    callback();
                }
            }
        });
    }
    
    /**
     * Add a legend to explain node colors
     */
    addLegend() {
        const legendGroup = this.svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(20, ${this.height - 120})`);
            
        const legendBackground = legendGroup.append("rect")
            .attr("width", 180)
            .attr("height", 110)
            .attr("fill", "rgba(15, 15, 35, 0.7)")
            .attr("rx", 8)
            .attr("ry", 8)
            .attr("stroke", "rgba(255, 255, 255, 0.2)")
            .attr("stroke-width", 1);
            
        const legendTitle = legendGroup.append("text")
            .attr("x", 10)
            .attr("y", 20)
            .attr("fill", "white")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text("Legend");
            
        const legendItems = [
            { color: this.nodeColors[1], label: "Founding Members" },
            { color: this.nodeColors[2], label: "First Generation" },
            { color: this.nodeColors[3], label: "Second Generation" },
            { color: this.nodeColors[4], label: "Third Generation" }
        ];
        
        legendItems.forEach((item, i) => {
            const itemGroup = legendGroup.append("g")
                .attr("transform", `translate(10, ${40 + i * 20})`);
                
            itemGroup.append("circle")
                .attr("r", 6)
                .attr("fill", item.color);
                
            itemGroup.append("text")
                .attr("x", 15)
                .attr("y", 4)
                .attr("fill", "white")
                .attr("font-size", "12px")
                .text(item.label);
        });
    }
}

// Initialize the visualization when the DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
    console.log('[CIRCULAR-TREE] DOM content loaded, looking for container');
    
    const container = document.getElementById("family-tree-container");
    const heroViz = document.getElementById("hero-visualization");
    
    if (container) {
        console.log('[CIRCULAR-TREE] Found family-tree-container, initializing visualization');
        try {
            new CircularFamilyTree({
                containerId: "family-tree-container",
                title: "Proof of Humanity Family Network"
            });
        } catch (error) {
            console.error('[CIRCULAR-TREE] Error initializing family tree visualization:', error);
        }
    }
    
    if (heroViz) {
        console.log('[CIRCULAR-TREE] Found hero-visualization, initializing visualization');
        try {
            new CircularFamilyTree({
                containerId: "hero-visualization",
                title: "Proof of Humanity Network"
            });
            
            // Hide loading indicator if it exists
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        } catch (error) {
            console.error('[CIRCULAR-TREE] Error initializing hero visualization:', error);
            
            // Show error in loading indicator if it exists
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.innerHTML = `<p>Error loading visualization: ${error.message}</p>`;
            }
        }
    }
}); 