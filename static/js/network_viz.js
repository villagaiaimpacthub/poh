// Global debug indicator
const DEBUG_NETWORK_VIZ = true;
const initAttempts = 0;
const MAX_INIT_ATTEMPTS = 5;
const vizLoadTimestamp = new Date();

// Log initialization information immediately
console.log(`[NETWORK_VIZ] Script loaded at ${vizLoadTimestamp.toISOString()}`);

// Set up global error handling
window.onerror = function(message, source, line, column, error) {
    networkVizDebug(`Global error: ${message} at ${source}:${line}:${column}`, 'error');
    return false;
};

// Enhanced debug helper function that logs to console and to a visible element
function networkVizDebug(message, level = 'info') {
    if (!DEBUG_NETWORK_VIZ) return;
    
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Log to console
    if (level === 'error') {
        console.error(`[NETWORK_VIZ] ${message}`);
    } else if (level === 'warning') {
        console.warn(`[NETWORK_VIZ] ${message}`);
    } else {
        console.log(`[NETWORK_VIZ] ${message}`);
    }
    
    // Try to find or create a debug log element in the DOM
    try {
        let debugLog = document.getElementById('network-viz-debug-log');
        
        if (!debugLog) {
            // Look for any debug element that might exist
            debugLog = document.getElementById('debugBox') || 
                      document.getElementById('viz-diagnostics') || 
                      document.getElementById('globalDebugBox');
                      
            if (!debugLog) {
                // Create a debug log element if none exists
                debugLog = document.createElement('div');
                debugLog.id = 'network-viz-debug-log';
                debugLog.style.cssText = 'position: fixed; bottom: 10px; left: 10px; z-index: 9999; background: rgba(0,0,0,0.8); color: white; padding: 10px; border-radius: 5px; max-height: 200px; overflow: auto; width: 400px; font-family: monospace; font-size: 12px;';
                document.body.appendChild(debugLog);
            }
        }
        
        // Add the message to the debug log
        const logEntry = document.createElement('div');
        logEntry.innerHTML = `<span style="color:${level === 'error' ? 'red' : level === 'warning' ? 'orange' : 'lime'}">${logMessage}</span>`;
        debugLog.appendChild(logEntry);
        debugLog.scrollTop = debugLog.scrollHeight;
    } catch (e) {
        console.error(`[NETWORK_VIZ] Failed to update debug log: ${e.message}`);
    }
    
    // Try to send the message to the parent window if in an iframe
    try {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'network-viz-debug',
                level: level,
                message: message
            }, '*');
        }
    } catch (e) {
        console.error(`[NETWORK_VIZ] Failed to send debug message to parent: ${e.message}`);
    }
}

// Check if we're in the landing page and need a simplified visualization
try {
    const isLandingPage = window.location.pathname === '/' || 
                         window.location.pathname === '/index' || 
                         document.querySelector('.hero-section') !== null;
                         
    const isStandalone = window.location.pathname.includes('/network/viz') || 
                        window.location.pathname.includes('/network-viz');
                        
    const isInIframe = window !== window.parent;
    
    networkVizDebug(`Environment detection: Landing page: ${isLandingPage}, Standalone: ${isStandalone}, In iframe: ${isInIframe}`);
    
    if (isLandingPage && isInIframe) {
        networkVizDebug('Creating simplified visualization for landing page');
        createSimplifiedVisualization();
    }
} catch (e) {
    networkVizDebug(`Error detecting environment: ${e.message}`, 'error');
}

// Helper function to create a simplified network visualization
function createSimplifiedVisualization() {
    try {
        networkVizDebug('Initializing simplified visualization');
        
        // Wait for D3.js to be available
        if (typeof d3 === 'undefined') {
            networkVizDebug('D3.js not available for simplified visualization, waiting...', 'warning');
            setTimeout(createSimplifiedVisualization, 500);
            return;
        }
        
        networkVizDebug(`D3.js available (version ${d3.version}), creating visualization`);
        
        // Find or create the container
        let container = document.getElementById('simplified-network');
        if (!container) {
            container = document.createElement('div');
            container.id = 'simplified-network';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.minHeight = '300px';
            document.body.appendChild(container);
            networkVizDebug('Created simplified network container');
        }
        
        // Create an SVG element
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;
        
        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .style('background', 'transparent');
            
        // Create a gradient definition
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'viz-node-gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '100%');
            
        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#7a43ff')
            .attr('stop-opacity', 0.7);
            
        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#43d1ff')
            .attr('stop-opacity', 0.7);
        
        // Create sample data for the visualization
        const nodes = [
            { id: 'center', group: 1, radius: 40, x: width/2, y: height/2 },
            { id: 'child1', group: 2, radius: 20, x: width/3, y: height/3 },
            { id: 'child2', group: 2, radius: 20, x: 2*width/3, y: height/3 },
            { id: 'child3', group: 2, radius: 20, x: width/3, y: 2*height/3 },
            { id: 'child4', group: 2, radius: 20, x: 2*width/3, y: 2*height/3 },
            { id: 'grandchild1', group: 3, radius: 15, x: width/5, y: height/3 },
            { id: 'grandchild2', group: 3, radius: 15, x: 4*width/5, y: height/3 },
            { id: 'grandchild3', group: 3, radius: 15, x: width/3, y: height/5 },
            { id: 'grandchild4', group: 3, radius: 15, x: 2*width/3, y: height/5 },
            { id: 'grandchild5', group: 3, radius: 15, x: width/5, y: 2*height/3 },
            { id: 'grandchild6', group: 3, radius: 15, x: 4*width/5, y: 2*height/3 }
        ];
        
        const links = [
            { source: 'center', target: 'child1', value: 1 },
            { source: 'center', target: 'child2', value: 1 },
            { source: 'center', target: 'child3', value: 1 },
            { source: 'center', target: 'child4', value: 1 },
            { source: 'child1', target: 'grandchild1', value: 1 },
            { source: 'child2', target: 'grandchild2', value: 1 },
            { source: 'child1', target: 'grandchild3', value: 1 },
            { source: 'child2', target: 'grandchild4', value: 1 },
            { source: 'child3', target: 'grandchild5', value: 1 },
            { source: 'child4', target: 'grandchild6', value: 1 }
        ];
        
        // Create the links
        svg.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke-width', d => Math.sqrt(d.value))
            .attr('stroke', '#7a43ff')
            .attr('stroke-opacity', 0.6)
            .attr('x1', d => nodes.find(n => n.id === d.source).x)
            .attr('y1', d => nodes.find(n => n.id === d.source).y)
            .attr('x2', d => nodes.find(n => n.id === d.target).x)
            .attr('y2', d => nodes.find(n => n.id === d.target).y);
        
        // Create the nodes
        const nodeElements = svg.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('r', d => d.radius)
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('fill', d => d.group === 1 ? 'url(#viz-node-gradient)' : (d.group === 2 ? '#7a43ff' : '#43d1ff'))
            .attr('opacity', d => d.group === 1 ? 1 : 0.7)
            .attr('class', 'pulse-circle');
            
        // Add simple animation
        nodeElements.each(function(d) {
            const circle = d3.select(this);
            const originalRadius = d.radius;
            
            function pulseAnimation() {
                circle.transition()
                    .duration(1500 + Math.random() * 1000)
                    .attr('r', originalRadius * (1.1 + Math.random() * 0.1))
                    .transition()
                    .duration(1500 + Math.random() * 1000)
                    .attr('r', originalRadius)
                    .on('end', pulseAnimation);
            }
            
            pulseAnimation();
        });
        
        networkVizDebug('Simplified visualization created successfully');
        
    } catch (e) {
        networkVizDebug(`Error creating simplified visualization: ${e.message}`, 'error');
    }
}

// Check D3 immediately
if (typeof d3 !== 'undefined') {
    console.log(`[NETWORK_VIZ] D3.js is available when script loads: version ${d3.version}`);
} else {
    console.error('[NETWORK_VIZ] D3.js is NOT available when script loads');
}

// Check document readiness
console.log(`[NETWORK_VIZ] Document ready state: ${document.readyState}`);

// Create an improved initialization function
window.initializeNetworkViz = function() {
    // Flag that we've started initialization
    if (window.vizInitializing) return;
    window.vizInitializing = true;
    
    networkVizDebug('Starting network visualization initialization');
    
    // Function to load D3.js
    function loadD3() {
        return new Promise((resolve, reject) => {
            if (typeof d3 !== 'undefined') {
                networkVizDebug(`D3.js already available: ${d3.version}`);
                return resolve(d3.version);
            }
            
            networkVizDebug('Attempting to load D3.js from CDN');
            const script = document.createElement('script');
            script.src = 'https://d3js.org/d3.v7.min.js';
            script.onload = function() {
                networkVizDebug(`D3.js loaded from CDN: ${d3.version}`);
                resolve(d3.version);
            };
            script.onerror = function() {
                networkVizDebug('Failed to load D3.js from CDN, trying local file', 'warn');
                const localScript = document.createElement('script');
                localScript.src = '/static/js/d3.v7.min.js'; // Hardcoded path as fallback
                localScript.onload = function() {
                    networkVizDebug(`D3.js loaded from local file: ${d3.version}`);
                    resolve(d3.version);
                };
                localScript.onerror = function() {
                    networkVizDebug('Failed to load D3.js from local file', 'error');
                    reject(new Error('Failed to load D3.js'));
                };
                document.head.appendChild(localScript);
            };
            document.head.appendChild(script);
        });
    }
    
    // Run our initialization
    loadD3()
        .then(() => {
            networkVizDebug('Successfully loaded D3.js, proceeding with visualization');
            // Call the original initialization with a slight delay
            setTimeout(() => {
                try {
                    // Check if the original initialization function exists
                    if (typeof checkD3AndInitialize === 'function') {
                        checkD3AndInitialize();
                    } else if (typeof initializeVisualization === 'function') {
                        initializeVisualization();
                    } else {
                        networkVizDebug('No initialization function found', 'error');
                        throw new Error('Initialization functions not found');
                    }
                } catch (e) {
                    networkVizDebug(`Error during initialization: ${e.message}`, 'error');
                    showVizError('Initialization Error', e.message);
                }
            }, 100);
        })
        .catch(error => {
            networkVizDebug(`D3.js loading failed: ${error.message}`, 'error');
            showVizError('D3.js Loading Error', 'Could not load D3.js library needed for visualization');
        });
};

// Helper function to show errors
function showVizError(title, message) {
    networkVizDebug(`Showing error: ${title} - ${message}`, 'error');
    
    const container = document.getElementById('network-container');
    if (!container) return;
    
    // Create error element
    const errorElement = document.createElement('div');
    errorElement.style.position = 'absolute';
    errorElement.style.top = '50%';
    errorElement.style.left = '50%';
    errorElement.style.transform = 'translate(-50%, -50%)';
    errorElement.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    errorElement.style.color = 'white';
    errorElement.style.padding = '20px';
    errorElement.style.borderRadius = '8px';
    errorElement.style.textAlign = 'center';
    errorElement.style.maxWidth = '80%';
    errorElement.style.zIndex = '100';
    
    errorElement.innerHTML = `
        <h3>${title}</h3>
        <p>${message}</p>
        <button id="retry-viz-button" style="background: #7a43ff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
            Retry
        </button>
    `;
    
    container.appendChild(errorElement);
    
    // Add retry button handler
    document.getElementById('retry-viz-button').addEventListener('click', function() {
        errorElement.remove();
        window.vizInitializing = false;
        window.initializeNetworkViz();
    });
    
    // Try to notify parent
    try {
        if (window.parent && window !== window.parent) {
            window.parent.postMessage({
                type: 'network-viz-error',
                title: title,
                message: message
            }, '*');
        }
    } catch (e) {
        networkVizDebug(`Error sending message to parent: ${e.message}`, 'error');
    }
}

// Set up our main initialization
document.addEventListener('DOMContentLoaded', function() {
    networkVizDebug('DOMContentLoaded event fired');
    setTimeout(window.initializeNetworkViz, 100);
});

window.addEventListener('load', function() {
    networkVizDebug('Window load event fired');
    if (!window.vizInitialized) {
        setTimeout(window.initializeNetworkViz, 100);
    }
});

// Also try immediate initialization
setTimeout(window.initializeNetworkViz, 500);

// Immediate self-executing function to create a minimal working visualization


