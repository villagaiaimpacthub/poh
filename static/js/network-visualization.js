/**
 * Web5 Network Visualization for Hero Section
 * Creates an interactive network visualization with founders at the center
 * and expanding network of connections that gradually turn golden
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check if the element exists before initializing
    const networkContainer = document.getElementById('network-visualization');
    if (!networkContainer) return;

    // Configuration
    const config = {
        founderCount: 8,           // Number of founder nodes at the center
        expansionLayers: 3,        // Number of expansion layers around founders
        expansionMultiplier: 2,    // How many regular nodes per founder in each layer
        nodeMinSize: 6,            // Size of regular nodes
        nodeMaxSize: 12,           // Size of founder nodes
        founderNodeSize: 14,       // Size of founder nodes
        nodeMoveSpeed: 0.007,      // Very slow movement for subtle effect
        connectionDistance: 120,   // Connection distance
        transformSpeed: 10000,     // Time in ms for nodes to transform to gold
        initialGoldConversion: 3000, // Time before first nodes start turning gold
        colors: {
            founderNode: '#ffb86c',            // Gold/orange for founder nodes
            regularNode: '#7a43ff',            // Purple for regular nodes
            transformedNode: '#ffb86c',        // Gold for transformed nodes
            connection: 'rgba(122, 67, 255, 0.2)',  // Light purple for connections
            highlightConnection: 'rgba(255, 184, 108, 0.4)',  // Gold for highlighted connections
            pulse: '#43d1ff'             // Cyan for data pulses
        }
    };

    // Canvas setup
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Make canvas fill the container
    canvas.width = networkContainer.offsetWidth;
    canvas.height = networkContainer.offsetHeight;
    networkContainer.appendChild(canvas);

    // Handle resizing
    window.addEventListener('resize', () => {
        canvas.width = networkContainer.offsetWidth;
        canvas.height = networkContainer.offsetHeight;
    });

    // Nodes data structure
    let nodes = [];
    let connections = [];
    let dataPulses = [];
    let transformationTimers = [];

    // Initialize the founder nodes at the center and regular nodes expanding outward
    function initNodes() {
        nodes = [];
        connections = [];
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) * 0.08; // Founder circle radius
        
        // Create founder nodes in a circle at the center
        for (let i = 0; i < config.founderCount; i++) {
            const angle = (i / config.founderCount) * Math.PI * 2;
            nodes.push({
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
                size: config.founderNodeSize,
                vx: (Math.random() - 0.5) * config.nodeMoveSpeed * 0.5,
                vy: (Math.random() - 0.5) * config.nodeMoveSpeed * 0.5,
                isFounder: true,
                isGold: true,
                layer: 0,
                transformProgress: 1.0 // Founders start as gold
            });
        }
        
        // Create expansion layers
        for (let layer = 1; layer <= config.expansionLayers; layer++) {
            const layerRadius = radius * (1 + layer * 0.6);
            const nodesInLayer = config.founderCount * config.expansionMultiplier * layer;
            
            for (let i = 0; i < nodesInLayer; i++) {
                const angle = (i / nodesInLayer) * Math.PI * 2;
                // Add some randomness to the placement
                const randRadius = layerRadius * (0.9 + Math.random() * 0.3);
                const randAngle = angle + (Math.random() * 0.2 - 0.1);
                
                nodes.push({
                    x: centerX + Math.cos(randAngle) * randRadius,
                    y: centerY + Math.sin(randAngle) * randRadius,
                    size: config.nodeMinSize + Math.random() * (config.nodeMaxSize - config.nodeMinSize),
                    vx: (Math.random() - 0.5) * config.nodeMoveSpeed,
                    vy: (Math.random() - 0.5) * config.nodeMoveSpeed,
                    isFounder: false,
                    isGold: false,
                    layer: layer,
                    transformProgress: 0 // Regular nodes start as purple
                });
            }
        }
        
        // Establish connections between nodes
        connectNodes();
        
        // Schedule the gradual transformation of nodes to gold
        scheduleGoldenTransformation();
    }

    // Connect nodes based on proximity and layers
    function connectNodes() {
        // Connect founders to each other (full mesh)
        for (let i = 0; i < config.founderCount; i++) {
            for (let j = i + 1; j < config.founderCount; j++) {
                connections.push({
                    from: i,
                    to: j,
                    highlighted: false
                });
            }
        }
        
        // Connect each node to closest nodes in its own layer and adjacent layers
        for (let i = config.founderCount; i < nodes.length; i++) {
            const nodeLayer = nodes[i].layer;
            
            // Find 2-3 connections within the same layer
            const sameLayerNodes = nodes.filter((node, idx) => 
                idx >= config.founderCount && idx !== i && node.layer === nodeLayer
            );
            
            const closeSameLayerNodes = findClosestNodes(i, sameLayerNodes, 2);
            for (let target of closeSameLayerNodes) {
                connections.push({
                    from: i,
                    to: target,
                    highlighted: false
                });
            }
            
            // Connect to 1-2 nodes in inner layer (if not in first layer)
            if (nodeLayer > 1) {
                const innerLayerNodes = nodes.filter(node => node.layer === nodeLayer - 1);
                const closeInnerLayerNodes = findClosestNodes(i, innerLayerNodes, 1);
                
                for (let target of closeInnerLayerNodes) {
                    connections.push({
                        from: i,
                        to: target,
                        highlighted: false
                    });
                }
            } else if (nodeLayer === 1) {
                // First layer connects to founders
                const founderNodes = nodes.filter(node => node.isFounder);
                const closeFounderNodes = findClosestNodes(i, founderNodes, 1);
                
                for (let target of closeFounderNodes) {
                    connections.push({
                        from: i,
                        to: target,
                        highlighted: false
                    });
                }
            }
        }
    }
    
    // Helper function to find closest nodes
    function findClosestNodes(sourceIdx, targetNodes, count) {
        const source = nodes[sourceIdx];
        const distances = targetNodes.map((node, idx) => {
            const dx = source.x - node.x;
            const dy = source.y - node.y;
            return {
                index: nodes.indexOf(node),
                distance: Math.sqrt(dx * dx + dy * dy)
            };
        });
        
        distances.sort((a, b) => a.distance - b.distance);
        return distances.slice(0, Math.min(count, distances.length)).map(d => d.index);
    }

    // Schedule the gradual transformation of nodes to gold
    function scheduleGoldenTransformation() {
        // Clear existing timers
        transformationTimers.forEach(timer => clearTimeout(timer));
        transformationTimers = [];
        
        // First layer transforms first, then second, etc.
        for (let layer = 1; layer <= config.expansionLayers; layer++) {
            const layerNodes = nodes.filter((node, idx) => !node.isFounder && node.layer === layer);
            
            for (let node of layerNodes) {
                const nodeIndex = nodes.indexOf(node);
                const delay = config.initialGoldConversion + 
                              (layer - 1) * 3000 + 
                              Math.random() * 2000; // Randomize within layer
                
                const timer = setTimeout(() => {
                    // Start the golden transformation
                    startNodeTransformation(nodeIndex);
                }, delay);
                
                transformationTimers.push(timer);
            }
        }
    }
    
    // Start the transformation of a node to gold
    function startNodeTransformation(nodeIndex) {
        const node = nodes[nodeIndex];
        if (!node || node.isGold) return;
        
        // Create golden pulse effect
        createGoldenPulse(nodeIndex);
        
        // Highlight connections when a node begins transformation
        connections.forEach(conn => {
            if (conn.from === nodeIndex || conn.to === nodeIndex) {
                conn.highlighted = true;
                
                // Schedule connection to return to normal
                setTimeout(() => {
                    conn.highlighted = false;
                }, config.transformSpeed * 0.8);
            }
        });
    }
    
    // Create golden pulse effect when a node transforms
    function createGoldenPulse(nodeIndex) {
        const node = nodes[nodeIndex];
        
        // Create pulse animations to connected nodes
        connections.forEach(conn => {
            if (conn.from === nodeIndex || conn.to === nodeIndex) {
                const targetIndex = conn.from === nodeIndex ? conn.to : conn.from;
                
                dataPulses.push({
                    fromNode: nodeIndex,
                    toNode: targetIndex,
                    progress: 0,
                    size: 3 + Math.random() * 2,
                    speed: 0.01 * (0.8 + Math.random() * 0.4),
                    isGolden: true
                });
            }
        });
    }

    // Update node positions and handle transformations
    function updateNodes() {
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            
            // Update position with subtle movement
            node.x += node.vx;
            node.y += node.vy;
            
            // Boundary bounce with damping
            if (node.x <= node.size || node.x >= canvas.width - node.size) {
                node.vx *= -0.9;
                if (node.x <= node.size) node.x = node.size;
                if (node.x >= canvas.width - node.size) node.x = canvas.width - node.size;
            }
            
            if (node.y <= node.size || node.y >= canvas.height - node.size) {
                node.vy *= -0.9;
                if (node.y <= node.size) node.y = node.size;
                if (node.y >= canvas.height - node.size) node.y = canvas.height - node.size;
            }
            
            // Update transformation progress
            if (!node.isFounder && node.transformProgress > 0 && node.transformProgress < 1) {
                node.transformProgress += 0.005; // Slow transition to gold
                
                if (node.transformProgress >= 1) {
                    node.isGold = true;
                    node.transformProgress = 1;
                }
            }
        }
    }

    // Update data pulses
    function updateDataPulses() {
        for (let i = dataPulses.length - 1; i >= 0; i--) {
            const pulse = dataPulses[i];
            
            // Update progress
            pulse.progress += pulse.speed;
            
            // Remove completed pulses
            if (pulse.progress >= 1) {
                const targetNode = nodes[pulse.toNode];
                
                // If this is a golden pulse, start transforming the target node
                if (pulse.isGolden && targetNode && !targetNode.isGold && targetNode.transformProgress === 0) {
                    targetNode.transformProgress = 0.01; // Start transformation
                }
                
                dataPulses.splice(i, 1);
            }
        }
        
        // Occasionally create regular data pulses between nodes
        if (Math.random() < 0.05) {
            const sourceIndex = Math.floor(Math.random() * nodes.length);
            
            // Find a connected node
            const nodeConnections = connections.filter(conn => 
                conn.from === sourceIndex || conn.to === sourceIndex
            );
            
            if (nodeConnections.length > 0) {
                const randomConn = nodeConnections[Math.floor(Math.random() * nodeConnections.length)];
                const targetIndex = randomConn.from === sourceIndex ? randomConn.to : randomConn.from;
                
                dataPulses.push({
                    fromNode: sourceIndex,
                    toNode: targetIndex,
                    progress: 0,
                    size: 2 + Math.random() * 1.5,
                    speed: 0.02 * (0.8 + Math.random() * 0.4),
                    isGolden: false
                });
            }
        }
    }

    // Draw connections between nodes
    function drawConnections() {
        for (let i = 0; i < connections.length; i++) {
            const conn = connections[i];
            const fromNode = nodes[conn.from];
            const toNode = nodes[conn.to];
            
            // Set connection color based on highlight state
            ctx.strokeStyle = conn.highlighted 
                ? config.colors.highlightConnection 
                : config.colors.connection;
            
            ctx.lineWidth = conn.highlighted ? 2 : 1;
            
            // Draw line
            ctx.beginPath();
            ctx.moveTo(fromNode.x, fromNode.y);
            ctx.lineTo(toNode.x, toNode.y);
            ctx.stroke();
        }
    }

    // Draw data pulses
    function drawDataPulses() {
        for (let i = 0; i < dataPulses.length; i++) {
            const pulse = dataPulses[i];
            const fromNode = nodes[pulse.fromNode];
            const toNode = nodes[pulse.toNode];
            
            // Calculate position along the path
            const x = fromNode.x + (toNode.x - fromNode.x) * pulse.progress;
            const y = fromNode.y + (toNode.y - fromNode.y) * pulse.progress;
            
            // Different styling for golden pulses
            if (pulse.isGolden) {
                // Draw the golden pulse
                ctx.globalAlpha = 0.9;
                ctx.fillStyle = config.colors.founderNode;
                ctx.beginPath();
                ctx.arc(x, y, pulse.size + 1, 0, Math.PI * 2);
                ctx.fill();
                
                // Add glow effect
                ctx.globalAlpha = 0.6;
                const gradient = ctx.createRadialGradient(
                    x, y, pulse.size * 0.5,
                    x, y, pulse.size * 3
                );
                gradient.addColorStop(0, config.colors.founderNode);
                gradient.addColorStop(1, 'rgba(255, 184, 108, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, pulse.size * 3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Draw regular pulse
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = config.colors.pulse;
                ctx.beginPath();
                ctx.arc(x, y, pulse.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.globalAlpha = 1;
    }

    // Draw all nodes
    function drawNodes() {
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            
            // Determine node color based on transformation status
            let nodeColor;
            if (node.isFounder) {
                nodeColor = config.colors.founderNode;
            } else if (node.isGold) {
                nodeColor = config.colors.transformedNode;
            } else if (node.transformProgress > 0) {
                // Interpolate between regular and gold color
                nodeColor = interpolateColors(
                    config.colors.regularNode, 
                    config.colors.transformedNode, 
                    node.transformProgress
                );
            } else {
                nodeColor = config.colors.regularNode;
            }
            
            // Draw node
            ctx.fillStyle = nodeColor;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
            ctx.fill();
            
            // Add glow for founder nodes and transforming nodes
            if (node.isFounder || node.transformProgress > 0) {
                ctx.globalAlpha = 0.2 + node.transformProgress * 0.2;
                const glowSize = node.size * (1.2 + node.transformProgress * 0.6);
                
                const gradient = ctx.createRadialGradient(
                    node.x, node.y, node.size * 0.5,
                    node.x, node.y, glowSize
                );
                gradient.addColorStop(0, nodeColor);
                gradient.addColorStop(1, 'rgba(255, 184, 108, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.globalAlpha = 1;
            }
        }
    }

    // Helper function to interpolate between two colors
    function interpolateColors(color1, color2, factor) {
        if (factor === 0) return color1;
        if (factor === 1) return color2;
        
        // Parse the hex values
        const hex1 = parseInt(color1.slice(1), 16);
        const hex2 = parseInt(color2.slice(1), 16);
        
        // Extract RGB components
        const r1 = (hex1 >> 16) & 255;
        const g1 = (hex1 >> 8) & 255;
        const b1 = hex1 & 255;
        
        const r2 = (hex2 >> 16) & 255;
        const g2 = (hex2 >> 8) & 255;
        const b2 = hex2 & 255;
        
        // Interpolate
        const r = Math.round(r1 + factor * (r2 - r1));
        const g = Math.round(g1 + factor * (g2 - g1));
        const b = Math.round(b1 + factor * (b2 - b1));
        
        // Convert back to hex
        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    }

    // Main animation loop
    function animate() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw
        updateNodes();
        updateDataPulses();
        drawConnections();
        drawDataPulses();
        drawNodes();
        
        // Continue animation
        requestAnimationFrame(animate);
    }

    // Initialize and start animation
    initNodes();
    animate();
}); 