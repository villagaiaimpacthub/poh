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
    
    // Improved Safari detection - first check for Safari but not Chrome
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
        // iOS browsers should also be treated as Safari for color handling
        if (!isSafari) {
            console.log('[BROWSER-DETECT] iOS device detected, treating as Safari for color handling');
        }
    }
    
    // Additional check for WebKit engine (used by Safari)
    if (window.WebKitCSSMatrix) {
        console.log('[BROWSER-DETECT] WebKit CSS Matrix detected, browser likely Safari or Safari-based');
        if (!isSafari) {
            console.log('[BROWSER-DETECT] Setting isSafari=true based on WebKit detection');
            isSafari = true;
        }
    }
    
    return {
        name: browserName,
        version: browserVersion,
        isSafari: isSafari || isIOS, // Treat iOS browsers as Safari for color handling
        isIOS: isIOS,
        userAgent: userAgent
    };
}

// Define the gold color as a constant at the top of the file
const GOLD_COLOR = '#FFD700';  // Pure gold

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
        
        // Store references for event handling
        this.activeNode = null;
        this.selectedNode = null;
        this.dragNode = null;
        
        // Network data
        this.nodes = [];
        this.links = [];
        
        // Check if we're on a mobile device for responsive adjustments
        this.isMobile = window.innerWidth < 768;
        
        // Use consistent node colors for easy identification of levels
        this.nodeColors = {
            1: GOLD_COLOR,       // Full network - Level 1 (Gold)
            2: '#cc5de8',        // Parent - Level 2 (Purple)
            3: '#63e6be',        // Child - Level 3 (Mint)
            4: '#74c0fc',        // Grandchild - Level 4 (Light Blue)
            5: '#ff8787'         // Further relatives - Level 5 (Coral)
        };
        
        // Node sizes for different levels
        this.nodeRadii = {
            1: 20,  // Gold nodes
            2: 14,  // Purple nodes
            3: 10,  // Blue nodes 
            4: 8    // Green nodes
        };
        
        // Detect browser for color compatibility
        const browser = detectBrowser();
        this.isSafariOrIOS = browser.isSafari || browser.isIOS;
        
        // Enhanced browser logging for debugging
        console.log('[CIRCULAR-TREE] Browser detection:', {
            name: browser.name,
            version: browser.version,
            isSafari: browser.isSafari,
            isIOS: browser.isIOS,
            isSafariOrIOS: this.isSafariOrIOS,
            userAgent: browser.userAgent
        });
        
        // Set color scheme with browser-specific adjustments - store as class property
        this.nodeColors = {
            1: GOLD_COLOR,  // Gold for level 1 - using the constant
            2: '#800080',   // Purple for level 2
            3: '#43D1FF',   // Light blue for level 3
            4: '#1f77b4'    // Dark blue for level 4
        };
        
        // Log the actual colors being used
        console.log('[CIRCULAR-TREE-CREATE] Node colors:', {
            'level1 (gold)': this.nodeColors[1],
            'level2 (purple)': this.nodeColors[2],
            'level3 (blue)': this.nodeColors[3],
            'level4 (green)': this.nodeColors[4]
        });
        
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
     * Mobile device specific configuration for gold-only visualization
     */
    configureMobileColorScheme() {
        if (this.isMobile) {
            console.log('[CIRCULAR-TREE] Configuring mobile-specific gold color scheme');
            
            // Use the exact same hex gold color for all nodes
            const goldColor = GOLD_COLOR;
            
            // Special case for mobile: initialize all nodes as gold for better appearance
            // We'll keep a reference to original colors for when switching back to original state
            this.originalNodeColors = { ...this.nodeColors };
            
            // Override colors for mobile to make all levels gold
            this.mobileGoldMode = true;
            
            // Keep a consistent set of colors for level-based operations - all gold
            this.nodeColors = {
                1: goldColor,
                2: goldColor,
                3: goldColor,
                4: goldColor
            };
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
            console.log(`[CIRCULAR-TREE] Beginning initialization of circular family tree`);
            
            // For mobile, apply the gold color scheme
            if (this.isMobile) {
                this.configureMobileColorScheme();
            }
            
            // Create the main visualization
            this.createCircularTree();
            
            // Add pulsing animation to gold nodes
            this.addPulsingToAllGoldNodes();
            
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
        
        // Log the actual colors being used without re-creating them
        console.log('[CIRCULAR-TREE-CREATE] Using node colors:', {
            'level1 (gold)': this.nodeColors[1],
            'level2 (purple)': this.nodeColors[2],
            'level3 (blue)': this.nodeColors[3],
            'level4 (green)': this.nodeColors[4]
        });
        
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
        
        // Add pulse animation specifically for the central gold nodes - we'll keep track of these
        if (founderNodes.length > 0) {
            console.log('[DEBUG-VISUALIZATION] Adding pulse animations for gold nodes');
            this.pulseGroup = this.vizGroup.append("g").attr("class", "pulse-group");
            
            // Add the pulse elements - these will be referenced later
            founderNodes.forEach((node, i) => {
                this.pulseGroup.append("circle")
                    .attr("class", `node-pulse node-pulse-${i}`)
                    .attr("data-id", node.id)
                    .attr("cx", node.x)
                    .attr("cy", node.y)
                    .attr("r", node.radius * 1.5)
                    .attr("fill", "none")
                    .attr("stroke", GOLD_COLOR)
                    .attr("stroke-width", 1.5)
                    .attr("opacity", 0.6)
                    .style("animation-delay", `${i * 0.2}s`);
            });
        }
        
        // Add legend and buttons
        this.addEnhancedLegendAndButtons();

        console.log('[DEBUG-VISUALIZATION] Visualization setup complete');
    }
    
    /**
     * Add an enhanced legend and control buttons in better positions
     */
    addEnhancedLegendAndButtons() {
        console.log('[DEBUG-VISUALIZATION] Adding enhanced legend and buttons');
        
        // Create simplified legend with position adjusted for mobile/desktop
        let legendX, legendY;
        
        if (this.isMobile) {
            // For mobile, position the legend at the top-right corner, away from the center
            legendX = this.width - 170;
            legendY = 20;
        } else {
            // For desktop, position on the right side
            legendX = this.width - 220;
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
            { color: this.nodeColors[1], text: 'Full Network Nodes' },
            { color: this.nodeColors[2], text: 'Parent Nodes' },
            { color: this.nodeColors[3], text: 'Child Nodes' },
            { color: this.nodeColors[4], text: 'Grandchild Nodes' },
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
        
        // SWAP BUTTON ORDER - First create Grow Network button (on left for mobile)
        const growButton = buttonGroup.append("g")
            .attr("class", "viz-button grow-button")
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
        
        // Then add Reset button (on right for mobile)
        const resetButtonOffset = this.isMobile ? 135 : 155;
        
        const resetButton = buttonGroup.append("g")
            .attr("class", "viz-button reset-button")
            .attr("transform", `translate(${resetButtonOffset}, 0)`)
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
    }

    /**
     * Add hollow gold circles around ALL gold nodes (level 1)
     * Creates a simple static ring around gold nodes - better performance and visual clarity
     */
    addPulsingToAllGoldNodes() {
        console.log('[VISUALIZATION] Adding hollow gold ring effect to gold nodes');
        
        // Remove any existing ring effects
        this.svg.selectAll(".gold-ring").remove();
        
        // Find all nodes that are currently level 1 (gold)
        const goldNodes = this.nodes.filter(node => node.currentLevel === 1);
        
        if (goldNodes.length === 0) {
            console.log('[VISUALIZATION] No gold nodes found to highlight');
            return;
        }
        
        console.log(`[VISUALIZATION] Found ${goldNodes.length} gold nodes to highlight with hollow rings`);
        
        // Add simple hollow gold rings around each gold node - NO ANIMATION for better performance
        goldNodes.forEach((node, i) => {
            // Add a static circle around each gold node
            this.svg.append("circle")
                .attr("class", "gold-ring")
                .attr("cx", node.x)
                .attr("cy", node.y)
                .attr("r", node.radius * 1.5)  // Make the ring 1.5x the radius of the node
                .attr("fill", "none")
                .attr("stroke", GOLD_COLOR)  // Use the constant for consistent color
                .attr("stroke-width", 2)
                .attr("pointer-events", "none"); // Don't intercept mouse events
        });
    }

    addStyles() {
        // Add custom CSS styles to the page
        const styleId = 'circular-family-tree-styles';
        
        // Don't add styles if they already exist
        if (document.getElementById(styleId)) {
            return;
        }
        
        // Detect browser for color compatibility
        const browser = detectBrowser();
        const isSafariOrIOS = browser.isSafari || browser.isIOS;
        
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
                border-top: 2px dashed #ffd700;
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

    /**
     * Add a legend to explain node colors
     */
    addLegend() {
        // Add a legend to the visualization
        const legendContainer = document.createElement('div');
        legendContainer.className = 'legend-container';
        
        // Position legend differently for mobile vs desktop
        if (this.isMobile) {
            // For mobile, position at the top to give more space to the visualization
            legendContainer.style.position = 'absolute';
            legendContainer.style.top = '10px';
            legendContainer.style.left = '50%';
            legendContainer.style.transform = 'translateX(-50%)';
            legendContainer.style.width = '90%';
            legendContainer.style.maxWidth = '300px';
        } else {
            // Keep default positioning for desktop
            legendContainer.style.position = 'absolute';
            legendContainer.style.top = '10px';
            legendContainer.style.right = '10px';
        }
        
        // Define legend data
        const legendData = [
            { color: this.nodeColors[1], text: 'Full Network Nodes' },
            { color: this.nodeColors[2], text: 'Parent Nodes' },
            { color: this.nodeColors[3], text: 'Child Nodes' },
            { color: this.nodeColors[4], text: 'Grandchild Nodes' },
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
        
        // For mobile devices, decide if we should reset to original colors or keep gold mode
        if (this.isMobile && this.mobileGoldMode) {
            console.log('[CIRCULAR-TREE] Maintaining mobile gold mode during reset');
            // Keep gold mode active - everything stays gold
        } else if (this.originalNodeColors && this.mobileGoldMode) {
            // If switching out of gold mode, restore original colors
            console.log('[CIRCULAR-TREE] Restoring original colors from gold mode');
            this.nodeColors = { ...this.originalNodeColors };
            this.mobileGoldMode = false;
        }
        
        // Recreate the visualization
        this.createCircularTree();
        
        // Add pulsing animation to gold nodes
        this.addPulsingToAllGoldNodes();
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
     * Level up all nodes (change color based on level) with optimized performance
     */
    levelUpNodes() {
        console.log('[CIRCULAR-TREE] Starting level-up process');
        
        // Store original levels
        const originalLevels = this.nodes.map(node => ({ id: node.id, level: node.currentLevel }));
        
        // Increment levels immediately
        this.nodes.forEach(node => {
            node.previousLevel = node.currentLevel;
            node.currentLevel = Math.max(1, node.currentLevel - 1); // Ensure level isn't below 1
            
            // Apply color change immediately with consistent gold for level 1
            if (node.currentLevel === 1) {
                node.color = GOLD_COLOR;
            } else {
                node.color = this.nodeColors[node.currentLevel];
            }
        });
        
        // Apply visual changes without delay
        this.nodeElements
            .transition()
            .duration(300)  // Faster transition
            .attr("fill", d => d.currentLevel === 1 ? GOLD_COLOR : this.nodeColors[d.currentLevel]);
        
        // Update the display immediately
        this.addPulsingToAllGoldNodes();
        
        console.log('[CIRCULAR-TREE] Level-up complete');
    }

    /**
     * Show visual feedback while leveling up nodes
     */
    showLevelingUpFeedback() {
        // Create or update a visual indicator to show the leveling up is in progress
        const container = d3.select(this.container);
        let feedbackElement = container.select(".level-up-feedback");
        
        if (feedbackElement.empty()) {
            feedbackElement = container.append("div")
                .attr("class", "level-up-feedback")
                .style("position", "absolute")
                .style("top", "50%")
                .style("left", "50%")
                .style("transform", "translate(-50%, -50%)")
                .style("background-color", "rgba(0,0,0,0.7)")
                .style("color", "white")
                .style("padding", "10px 20px")
                .style("border-radius", "20px")
                .style("z-index", "100")
                .style("pointer-events", "none")
                .style("opacity", "0")
                .text("Growing Network...")
                .transition()
                .duration(200)
                .style("opacity", "1");
        }
    }

    /**
     * Hide the level up feedback
     */
    hideLevelingUpFeedback() {
        d3.select(this.container).select(".level-up-feedback")
            .transition()
            .duration(200)
            .style("opacity", "0")
            .remove();
    }

    // Update the simulation tick function to also update gold ring positions
    tick() {
        // Update node positions
        this.nodeElements
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
        
        // Update gold rings to match node positions
        this.svg.selectAll(".gold-ring")
            .data(this.nodes.filter(node => node.currentLevel === 1))
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
        
        // Update link positions
        this.linkElements
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        
        // Update label positions
        this.labelElements
            .attr("x", d => d.x)
            .attr("y", d => d.y + 3);
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