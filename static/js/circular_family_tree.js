/**
 * Browser detection utility
 * This function is critical for ensuring consistent color rendering across different browsers,
 * especially between Safari/iOS and other browsers which may handle color values differently.
 * 
 * Safari on iOS has known issues with certain hex color formats, and using RGB values can help
 * ensure consistent color display across platforms.
 * 
 * @returns {Object} Object containing browser information including name, version, and boolean flags
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
        this.version = "3.1.0"; // For tracking and debugging
        console.log(`[CIRCULAR-TREE] Initializing visualization version ${this.version}`);
        
        // Store configuration
        this.config = config || {};
        this.containerId = config.containerId;
        
        // Network growth limitations to prevent performance issues
        this.maxNetworkSize = 300; // Maximum total nodes
        this.maxGenerations = 3;   // Maximum number of growth cycles
        this.currentGeneration = 0; // Track current generation
        
        // Get container and set dimensions
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.error(`[CIRCULAR-TREE] Container with ID ${this.containerId} not found`);
            return;
        }
        
        // Set up dimensions with reasonable defaults for different screen sizes
        this.container.style.position = 'relative';
        this.width = this.container.offsetWidth || 800; // Default width if not specified
        this.height = this.container.offsetHeight || 600; // Default height if not specified
        
        // Ensure minimum dimensions for visibility
        this.width = Math.max(this.width, 600);  
        this.height = Math.max(this.height, 500);
        
        // Detect if mobile screen and adjust dimensions for better display
        this.isMobile = window.innerWidth < 768;
        if (this.isMobile) {
            console.log('[CIRCULAR-TREE] Mobile device detected, adjusting dimensions');
            // Use more appropriate dimensions for mobile
            this.width = Math.min(this.width, window.innerWidth - 40);
            this.height = Math.min(600, window.innerHeight - 100);
        }
        
        // Detect browser for color compatibility
        const browser = detectBrowser();
        const isSafariOrIOS = browser.isSafari || browser.isIOS;
        
        // Set color scheme with browser-specific adjustments
        this.nodeColors = {
            1: isSafariOrIOS ? 'rgb(255, 215, 0)' : '#FFD700',  // Gold - Founders
            2: isSafariOrIOS ? 'rgb(122, 67, 255)' : '#7a43ff',  // Purple - Parents
            3: isSafariOrIOS ? 'rgb(67, 209, 255)' : '#43d1ff',  // Blue - Children
            4: isSafariOrIOS ? 'rgb(76, 175, 80)' : '#4CAF50'   // Green - Grandchildren
        };
        
        console.log(`[CIRCULAR-TREE] Using ${isSafariOrIOS ? 'RGB' : 'HEX'} colors for ${browser.name} browser`);
        
        // Add styles to the page
        this.addStyles();
        
        // Create SVG container with explicit dimensions
        this.svg = d3.select(`#${this.containerId}`)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${this.width} ${this.height}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .attr("class", "family-tree-svg");
            
        // Create a container group for the visualization that can be transformed
        this.vizContainer = this.svg.append("g")
            .attr("class", "viz-container")
            .attr("transform", "translate(0,0)");
            
        // Create a group for the visualization, centered in the SVG
        this.vizGroup = this.vizContainer.append("g")
            .attr("class", "viz-group")
            .attr("transform", `translate(${this.width/2}, ${this.height/2})`);
        
        // Log configuration
        console.log(`[CIRCULAR-TREE] Container dimensions: ${this.width}x${this.height}`);
        
        // Create the visualization
        this.createCircularTree();
        
        // Add legend after creating the tree
        this.addLegend();
        
        // Add window resize handler for responsiveness
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    /**
     * Handle window resize events to update visualization
     */
    handleResize() {
        // Don't update too frequently - debounce
        if (this.resizeTimer) clearTimeout(this.resizeTimer);
        
        this.resizeTimer = setTimeout(() => {
            console.log('[CIRCULAR-TREE] Window resized, updating visualization');
            
            // Update dimensions
            this.width = this.container.offsetWidth || 800;
            this.height = this.container.offsetHeight || 600;
            
            // Check if mobile
            const wasMobile = this.isMobile;
            this.isMobile = window.innerWidth < 768;
            
            // Only rebuild if there's a significant size change or mobile state changed
            const widthChanged = Math.abs(this.width - this.svg.attr("width")) > 50;
            const heightChanged = Math.abs(this.height - this.svg.attr("height")) > 50;
            const mobileStateChanged = wasMobile !== this.isMobile;
            
            if (widthChanged || heightChanged || mobileStateChanged) {
                // Update SVG viewBox
                this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);
                
                // Clear and rebuild visualization
                this.resetVisualization();
            }
        }, 250);
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
                .attr("width", "100%")
                .attr("height", "100%")
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
            this.addLegend();
            
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
     * Create the circular tree visualization
     */
    createCircularTree() {
        console.log('[DEBUG-VISUALIZATION] Beginning createCircularTree with version: 3.1.0');

        // Clear any existing visualization
        this.vizGroup.selectAll("*").remove();
        
        // Detect browser for color compatibility
        const browser = detectBrowser();
        const isSafariOrIOS = browser.isSafari || browser.isIOS;
        
        // Set the custom colors - using rgb for better cross-browser compatibility
        this.nodeColors = {
            1: isSafariOrIOS ? 'rgb(255, 215, 0)' : '#FFD700',  // Gold - Founders
            2: isSafariOrIOS ? 'rgb(122, 67, 255)' : '#7a43ff',  // Purple - Parents
            3: isSafariOrIOS ? 'rgb(67, 209, 255)' : '#43d1ff',  // Blue - Children
            4: isSafariOrIOS ? 'rgb(76, 175, 80)' : '#4CAF50'   // Green - Grandchildren
        };
        
        console.log(`[CIRCULAR-TREE] Using ${isSafariOrIOS ? 'RGB' : 'HEX'} colors for ${browser.name}`);
        
        // Calculate the total nodes for each level
        const level1Count = 8;  // Gold - Founders
        const level2Count = 24; // Purple - Parents
        const level3Count = 72; // Blue - Children
        const level4Count = 216; // Green - Grandchildren
        
        // Create nodes data
        this.nodes = [];
        
        // Set visualization constraints - larger on desktop, smaller on mobile
        const scaleFactor = this.isMobile ? 0.75 : 0.9; // Scale down to ensure it fits, more on mobile
        
        // Scale the max radius based on container dimensions
        const maxRadius = Math.min(this.width, this.height) * 0.47 * scaleFactor;
        
        // Calculate proper node sizes based on the available space and node count
        // Scale node sizes based on level, total count, and device type
        const nodeRadii = {
            1: this.isMobile ? 8 : 12,     // Gold nodes - larger
            2: this.isMobile ? 5 : 7,      // Purple nodes
            3: this.isMobile ? 3.5 : 5,    // Blue nodes
            4: this.isMobile ? 2.5 : 3.5   // Green nodes - smaller
        };
        
        // Calculate base radiuses for each level with proper spacing
        const levelRadius = {
            1: maxRadius * 0.19, // Gold nodes - inner circle
            2: maxRadius * 0.38, // Purple nodes
            3: maxRadius * 0.62, // Blue nodes
            4: maxRadius * 0.85  // Green nodes - outer circle
        };
        
        // Helper to create a node at a specific angle and level
        const createNode = (angle, level, index, total) => {
            const radius = levelRadius[level];
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            return {
                id: `node-${level}-${index}`,
                level: level,
                currentLevel: level,
                x: x,
                y: y,
                angle: angle,
                radius: nodeRadii[level],
                color: this.nodeColors[level]
            };
        };
        
        // Track gold nodes for special effects
        let founderNodes = [];
        
        // Create Level 1 nodes (Founders - Gold)
        for (let i = 0; i < level1Count; i++) {
            const angle = (i * 2 * Math.PI / level1Count);
            const node = createNode(angle, 1, i, level1Count);
            this.nodes.push(node);
            founderNodes.push(node);
        }
        
        // Create Level 2 nodes (Parents - Purple)
        for (let i = 0; i < level2Count; i++) {
            const angle = (i * 2 * Math.PI / level2Count);
            this.nodes.push(createNode(angle, 2, i, level2Count));
        }
        
        // Create Level 3 nodes (Children - Blue)
        for (let i = 0; i < level3Count; i++) {
            const angle = (i * 2 * Math.PI / level3Count);
            this.nodes.push(createNode(angle, 3, i, level3Count));
        }
        
        // Create Level 4 nodes (Grandchildren - Green)
        for (let i = 0; i < level4Count; i++) {
            const angle = (i * 2 * Math.PI / level4Count);
            this.nodes.push(createNode(angle, 4, i, level4Count));
        }
        
        // Create links data
        this.links = [];
        
        // Generate links between gold (founders) and purple (parents)
        for (let i = 0; i < level1Count; i++) {
            const goldNode = this.nodes[i];
            
            // Each gold node connects to exactly 3 purple nodes
            const purpleStartIndex = level1Count;
            for (let j = 0; j < 3; j++) {
                const purpleIndex = purpleStartIndex + (i * 3) + j;
                if (purpleIndex < purpleStartIndex + level2Count) {
                    this.links.push({
                        source: goldNode.id,
                        target: this.nodes[purpleIndex].id,
                        value: 1.5
                    });
                }
            }
        }
        
        // Generate links between purple (parents) and blue (children)
        for (let i = 0; i < level2Count; i++) {
            const purpleIndex = level1Count + i;
            const purpleNode = this.nodes[purpleIndex];
            
            // Each purple node connects to exactly 3 blue nodes
            const blueStartIndex = level1Count + level2Count;
            for (let j = 0; j < 3; j++) {
                const blueIndex = blueStartIndex + (i * 3) + j;
                if (blueIndex < blueStartIndex + level3Count) {
                    this.links.push({
                        source: purpleNode.id,
                        target: this.nodes[blueIndex].id,
                        value: 1
                    });
                }
            }
        }
        
        // Generate links between blue (children) and green (grandchildren)
        for (let i = 0; i < level3Count; i++) {
            const blueIndex = level1Count + level2Count + i;
            const blueNode = this.nodes[blueIndex];
            
            // Each blue node connects to exactly 3 green nodes
            const greenStartIndex = level1Count + level2Count + level3Count;
            for (let j = 0; j < 3; j++) {
                const greenIndex = greenStartIndex + (i * 3) + j;
                if (greenIndex < greenStartIndex + level4Count) {
                    this.links.push({
                        source: blueNode.id,
                        target: this.nodes[greenIndex].id,
                        value: 0.7
                    });
                }
            }
        }
        
        console.log('[DEBUG-VISUALIZATION] Created nodes and links:', this.nodes.length, 'nodes and', this.links.length, 'links');
        
        // Create link elements with proper source/target resolution
        this.linkElements = this.vizGroup.selectAll(".link")
            .data(this.links)
            .enter().append("line")
            .attr("class", "link")
            .attr("x1", d => {
                const node = this.nodes.find(n => n.id === d.source);
                return node ? node.x : 0;
            })
            .attr("y1", d => {
                const node = this.nodes.find(n => n.id === d.source);
                return node ? node.y : 0;
            })
            .attr("x2", d => {
                const node = this.nodes.find(n => n.id === d.target);
                return node ? node.x : 0;
            })
            .attr("y2", d => {
                const node = this.nodes.find(n => n.id === d.target);
                return node ? node.y : 0;
            })
            .attr("stroke", "#ffffff")
            .attr("stroke-opacity", 0.2)
            .attr("stroke-width", d => d.value);
        
        // Create node groups
        this.nodeElements = this.vizGroup.selectAll(".node")
            .data(this.nodes)
            .enter().append("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.x},${d.y})`)
            .attr("data-id", d => d.id)
            .attr("data-level", d => d.level);
        
        console.log('[DEBUG-VISUALIZATION] Created node elements:', this.nodeElements.size());
        
        // Add node circles
        this.nodeElements.append("circle")
            .attr("r", d => d.radius)
            .attr("fill", d => {
                if (d.level === 1) {
                    console.log(`[DEBUG-VISUALIZATION] Drawing level 1 node with color ${d.color} at [${d.x.toFixed(2)}, ${d.y.toFixed(2)}]`);
                }
                return d.color;
            })
            .attr("stroke", "white")
            .attr("stroke-width", d => Math.min(1.5, d.radius * 0.15)) // Scale stroke based on radius
            .attr("opacity", 0.9);
        
        // Add pulse animation for founders/gold nodes only (level 1)
        if (founderNodes.length > 0) {
            console.log('[DEBUG-VISUALIZATION] Adding pulse animations for founders nodes');
            const pulseGroup = this.vizGroup.append("g").attr("class", "pulse-group");
            
            // Add individual pulse animations around each founder node for emphasis
            founderNodes.forEach((node, i) => {
                pulseGroup.append("circle")
                    .attr("class", `node-pulse node-pulse-${i}`)
                    .attr("cx", node.x)
                    .attr("cy", node.y)
                    .attr("r", node.radius * 1.5)
                    .attr("fill", "none")
                    .attr("stroke", this.nodeColors[1])
                    .attr("stroke-width", 1.5)
                    .attr("opacity", 0.6)
                    .style("animation-delay", `${i * 0.2}s`); // Stagger animation
            });
            
            // Add CSS for pulse animations
            if (!document.querySelector('#pulse-animation')) {
                const style = document.createElement('style');
                style.id = 'pulse-animation';
                style.textContent = `
                    @keyframes nodePulse {
                        0% { 
                            transform: scale(1);
                            opacity: 0.6;
                        }
                        70% { 
                            transform: scale(1.8);
                            opacity: 0;
                        }
                        100% { 
                            transform: scale(1);
                            opacity: 0;
                        }
                    }
                    
                    .node-pulse {
                        animation: nodePulse 3s infinite;
                    }
                `;
                document.head.appendChild(style);
            }
        }
        
        // Add legend and buttons
        this.addEnhancedLegendAndButtons();

        console.log('[DEBUG-VISUALIZATION] Visualization setup complete');
    }
    
    /**
     * Add a legend to explain node colors
     */
    addLegend() {
        // Add a legend to the visualization
        const legendContainer = document.createElement('div');
        legendContainer.className = 'legend-container';
        
        // Define legend data
        const legendData = [
            { color: this.nodeColors[1], text: 'Full Network Access' },
            { color: this.nodeColors[2], text: 'Parents' },
            { color: this.nodeColors[3], text: 'Children' },
            { color: this.nodeColors[4], text: 'Grandchildren' },
            { 
                special: 'founder-connection', 
                text: 'Founder Direct Connection', 
                color: this.nodeColors[1] 
            }
        ];
        
        // Create legend items
        legendData.forEach(item => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            if (item.special === 'founder-connection') {
                // Special case for founder connection line
                const lineElement = document.createElement('div');
                lineElement.className = 'legend-line legend-founder-connection';
                legendItem.appendChild(lineElement);
            } else {
                // Standard color circle
                const colorElement = document.createElement('div');
                colorElement.className = 'legend-color';
                colorElement.style.backgroundColor = item.color;
                legendItem.appendChild(colorElement);
            }
            
            const textElement = document.createElement('div');
            textElement.className = 'legend-text';
            textElement.textContent = item.text;
            legendItem.appendChild(textElement);
            
            legendContainer.appendChild(legendItem);
        });
        
        // Add buttons for interaction
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'legend-buttons';
        
        // Reset button
        const resetButton = document.createElement('button');
        resetButton.className = 'legend-button';
        resetButton.textContent = 'Reset';
        resetButton.addEventListener('click', () => {
            this.resetVisualization();
        });
        buttonsContainer.appendChild(resetButton);
        
        // Grow Network button
        const growButton = document.createElement('button');
        growButton.className = 'legend-button';
        growButton.textContent = 'Grow Network';
        growButton.addEventListener('click', () => {
            this.levelUpNodes();
        });
        buttonsContainer.appendChild(growButton);
        
        legendContainer.appendChild(buttonsContainer);
        
        // Add the legend to the container
        this.container.appendChild(legendContainer);
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
     * Reset the visualization
     */
    resetVisualization() {
        // Clear the visualization and recreate it
        this.vizGroup.selectAll("*").remove();
        this.createCircularTree();
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
     * Level up all nodes (change color based on level) in a single animation
     */
    levelUpNodes() {
        console.log("[VISUALIZATION] Starting level up sequence");
        
        // Get nodes at each level
        const level4Nodes = this.nodes.filter(n => n.currentLevel === 4);
        const level3Nodes = this.nodes.filter(n => n.currentLevel === 3);
        const level2Nodes = this.nodes.filter(n => n.currentLevel === 2);
        
        console.log(`Level 4 nodes: ${level4Nodes.length}, Level 3: ${level3Nodes.length}, Level 2: ${level2Nodes.length}`);
        
        // Promote green nodes to blue (level 4 to 3)
        level4Nodes.forEach(node => {
            // Select the node using the data-id attribute
            const nodeElement = this.vizGroup.select(`.node[data-id="${node.id}"]`).select("circle");
            console.log(`Looking for node ${node.id}, found: ${!nodeElement.empty()}`);
            
            if (!nodeElement.empty()) {
                const delay = Math.random() * 300; // Staggered animation
                nodeElement.transition()
                    .delay(delay)
                    .duration(800)
                    .attr("fill", this.nodeColors[3]);
                node.currentLevel = 3;
            }
        });
        
        // Promote blue nodes to purple (level 3 to 2)
        level3Nodes.forEach(node => {
            const nodeElement = this.vizGroup.select(`.node[data-id="${node.id}"]`).select("circle");
            if (!nodeElement.empty()) {
                const delay = 300 + Math.random() * 300;
                nodeElement.transition()
                    .delay(delay)
                    .duration(800)
                    .attr("fill", this.nodeColors[2]);
                node.currentLevel = 2;
            }
        });
        
        // Promote purple nodes to gold (level 2 to 1)
        level2Nodes.forEach(node => {
            const nodeElement = this.vizGroup.select(`.node[data-id="${node.id}"]`).select("circle");
            if (!nodeElement.empty()) {
                const delay = 600 + Math.random() * 300;
                nodeElement.transition()
                    .delay(delay)
                    .duration(800)
                    .attr("fill", this.nodeColors[1]);
                node.currentLevel = 1;
            }
        });
        
        console.log("[VISUALIZATION] Level up sequence complete");
    }

    /**
     * Add an enhanced legend and control buttons in better positions
     */
    addEnhancedLegendAndButtons() {
        console.log('[DEBUG-VISUALIZATION] Adding enhanced legend and buttons');
        
        // Create simplified legend with position adjusted for mobile/desktop
        let legendX, legendY;
        
        if (this.isMobile) {
            // For mobile, position the legend at the bottom
            legendX = this.width/2 - 90;
            legendY = this.height - 180;
        } else {
            // For desktop, position on the right side
            legendX = this.width - 210;
            legendY = this.height/2 - 100;
        }
        
        const legendGroup = this.svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${legendX}, ${legendY})`);
        
        // Add semi-transparent background for better readability
        legendGroup.append("rect")
            .attr("width", 180)
            .attr("height", 150)
            .attr("rx", 10)
            .attr("ry", 10)
            .attr("fill", "rgba(0, 0, 0, 0.7)");
        
        // Add legend title
        legendGroup.append("text")
            .attr("class", "legend-title")
            .attr("x", 15)
            .attr("y", 25)
            .text("Legend")
            .attr("font-size", "16px")
            .attr("font-weight", "bold")
            .attr("fill", "#fff");
        
        // Add legend items
        const legendData = [
            { color: this.nodeColors[1], text: "Full Network Access" },
            { color: this.nodeColors[2], text: "Parents" },
            { color: this.nodeColors[3], text: "Children" },
            { color: this.nodeColors[4], text: "Grandchildren" }
        ];
        
        const legendItems = legendGroup.selectAll(".legend-item")
            .data(legendData)
            .enter()
            .append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(15, ${i * 26 + 50})`);
        
        // Add colored circles
        legendItems.append("circle")
            .attr("cx", 8)
            .attr("cy", 0)
            .attr("r", 8)
            .attr("fill", d => d.color)
            .attr("stroke", "white")
            .attr("stroke-width", 1);
        
        // Add text
        legendItems.append("text")
            .attr("x", 25)
            .attr("y", 4)
            .text(d => d.text)
            .attr("font-size", this.isMobile ? "12px" : "14px")
            .attr("fill", "white");
        
        // Add buttons group with position adjusted for mobile/desktop
        let buttonY = this.height - 50;
        // For very small heights on mobile, move buttons up more
        if (this.isMobile && this.height < 500) {
            buttonY = this.height - 40;
        }
        
        const buttonGroup = this.svg.append("g")
            .attr("class", "button-group")
            .attr("transform", `translate(${this.width/2 - 110}, ${buttonY})`);
        
        // Button sizes adjusted for mobile
        const resetBtnWidth = this.isMobile ? 70 : 80;
        const growBtnWidth = this.isMobile ? 120 : 140;
        const btnHeight = this.isMobile ? 32 : 36;
        const fontSize = this.isMobile ? "12px" : "14px";
        
        // Add Reset button
        const resetButton = buttonGroup.append("g")
            .attr("class", "viz-button reset-button")
            .style("cursor", "pointer")
            .on("click", () => this.resetVisualization());
        
        resetButton.append("rect")
            .attr("width", resetBtnWidth)
            .attr("height", btnHeight)
            .attr("rx", 6)
            .attr("ry", 6)
            .attr("fill", "rgba(50, 50, 70, 0.8)")
            .attr("stroke", "rgba(255, 255, 255, 0.3)")
            .attr("stroke-width", 1);
        
        resetButton.append("text")
            .attr("x", resetBtnWidth/2)
            .attr("y", btnHeight/2)
            .text("Reset")
            .attr("font-size", fontSize)
            .attr("fill", "white")
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle");
        
        // Add Grow Network button
        const growButtonOffset = this.isMobile ? 85 : 100;
        
        const growButton = buttonGroup.append("g")
            .attr("class", "viz-button grow-button")
            .attr("transform", `translate(${growButtonOffset}, 0)`)
            .style("cursor", "pointer")
            .on("click", () => this.levelUpNodes());
        
        growButton.append("rect")
            .attr("width", growBtnWidth)
            .attr("height", btnHeight)
            .attr("rx", 6)
            .attr("ry", 6)
            .attr("fill", "#7a43ff")
            .attr("stroke", "rgba(255, 255, 255, 0.5)")
            .attr("stroke-width", 1);
        
        growButton.append("text")
            .attr("x", growBtnWidth/2)
            .attr("y", btnHeight/2)
            .text("Grow Network")
            .attr("font-size", fontSize)
            .attr("fill", "white")
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle");
    }

    addStyles() {
        // Add custom CSS styles to the page
        const styleId = 'circular-family-tree-styles';
        
        // Don't add styles if they already exist
        if (document.getElementById(styleId)) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .family-tree-svg {
                background-color: transparent;
            }
            
            .nodes circle {
                transition: fill 1s ease, r 0.5s ease, stroke-width 0.5s ease;
            }
            
            .founder-connection {
                stroke-linecap: round;
                animation: pulse-founder-link 2s infinite alternate;
            }
            
            @keyframes pulse-founder-link {
                0% { 
                    stroke-opacity: 0.5;
                    stroke-width: 1.5px;
                }
                100% { 
                    stroke-opacity: 0.8;
                    stroke-width: 2px;
                }
            }
            
            .node-pulse {
                animation: pulse-node 3s infinite;
            }
            
            @keyframes pulse-node {
                0% { 
                    r: 12px;
                    stroke-opacity: 0.6;
                }
                50% { 
                    r: 18px;
                    stroke-opacity: 0.3;
                }
                100% { 
                    r: 12px;
                    stroke-opacity: 0.6;
                }
            }
            
            .legend-item {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
            }
            
            .legend-color {
                width: 15px;
                height: 15px;
                border-radius: 50%;
                margin-right: 10px;
            }
            
            .legend-text {
                font-size: 14px;
            }
            
            .legend-buttons {
                display: flex;
                gap: 10px;
                margin-top: 15px;
            }
            
            .legend-button {
                background-color: rgba(122, 67, 255, 0.8);
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: background-color 0.3s;
            }
            
            .legend-button:hover {
                background-color: rgba(122, 67, 255, 1);
            }
            
            /* Special style for founder direct connection line in legend */
            .legend-line {
                width: 20px;
                height: 2px;
                margin-right: 10px;
            }
            
            .legend-founder-connection {
                border-top: 2px dashed #FFC857;
            }
            
            /* Mobile-specific styles */
            @media (max-width: 768px) {
                .node-pulse {
                    animation: pulse-node-mobile 3s infinite;
                }
                
                @keyframes pulse-node-mobile {
                    0% { 
                        r: 8px;
                        stroke-opacity: 0.6;
                    }
                    50% { 
                        r: 12px;
                        stroke-opacity: 0.3;
                    }
                    100% { 
                        r: 8px;
                        stroke-opacity: 0.6;
                    }
                }
                
                .legend-text {
                    font-size: 12px;
                }
                
                .legend-color {
                    width: 12px;
                    height: 12px;
                    margin-right: 8px;
                }
                
                .viz-button {
                    touch-action: manipulation;
                }
                
                /* Improve touch target size for mobile */
                .viz-button rect {
                    touch-action: manipulation;
                }
            }
        `;
        
        document.head.appendChild(style);
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
                title: "Proof of Humanity Network",
                version: "3.0.0" // Add version number for debugging
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