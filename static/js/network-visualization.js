/**
 * Web5 Network Visualization for Hero Section
 * Creates an interactive network visualization with information flow between nodes
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check if the element exists before initializing
    const networkContainer = document.getElementById('network-visualization');
    if (!networkContainer) return;

    // Configuration
    const config = {
        nodeCount: 24,            // Reduced number of nodes for clarity
        connectionLimit: 4,       // Increased connections per node
        nodeMinSize: 4,           // Slightly larger min size
        nodeMaxSize: 8,           // Slightly larger max size
        nodeMoveSpeed: 0.01,      // Very slow movement to make nodes appear almost stationary
        connectionDistance: 200,  // Increased connection distance
        pulseSpeed: 0.8,          // Speed of data pulse animation
        colors: {
            node: '#ffb86c',              // Gold/orange for nodes
            connection: 'rgba(122, 67, 255, 0.2)',  // Light purple for connections
            pulse: '#43d1ff',             // Cyan for data pulses
            activeNode: '#10b981'         // Green for active nodes
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
    let dataPulses = [];

    // Initialize nodes in a more structured pattern
    function initNodes() {
        nodes = [];
        // Create nodes in a more structured grid-like pattern with some randomness
        const gridSize = Math.ceil(Math.sqrt(config.nodeCount));
        const cellWidth = canvas.width / (gridSize + 1);
        const cellHeight = canvas.height / (gridSize + 1);
        
        let count = 0;
        for (let i = 1; i <= gridSize && count < config.nodeCount; i++) {
            for (let j = 1; j <= gridSize && count < config.nodeCount; j++) {
                // Add some randomness to the grid positions
                const randomOffsetX = (Math.random() - 0.5) * cellWidth * 0.8;
                const randomOffsetY = (Math.random() - 0.5) * cellHeight * 0.8;
                
                nodes.push({
                    x: i * cellWidth + randomOffsetX,
                    y: j * cellHeight + randomOffsetY,
                    size: config.nodeMinSize + Math.random() * (config.nodeMaxSize - config.nodeMinSize),
                    // Very small velocities for subtle movement
                    vx: (Math.random() - 0.5) * config.nodeMoveSpeed,
                    vy: (Math.random() - 0.5) * config.nodeMoveSpeed,
                    connections: [],
                    active: false,
                    activationTime: 0,
                    lastPulseTime: 0
                });
                count++;
            }
        }

        // Establish connections between nodes
        connectNodes();
    }

    // Connect nodes based on proximity
    function connectNodes() {
        for (let i = 0; i < nodes.length; i++) {
            nodes[i].connections = [];
            
            // Find the nearest nodes to connect to
            const distances = [];
            for (let j = 0; j < nodes.length; j++) {
                if (i !== j) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    distances.push({ index: j, distance: distance });
                }
            }
            
            // Sort by distance and connect to the closest nodes
            distances.sort((a, b) => a.distance - b.distance);
            for (let k = 0; k < Math.min(config.connectionLimit, distances.length); k++) {
                nodes[i].connections.push(distances[k].index);
            }
        }
    }

    // Create a data pulse between two nodes
    function createDataPulse(fromNodeIndex, toNodeIndex) {
        dataPulses.push({
            fromNode: fromNodeIndex,
            toNode: toNodeIndex,
            progress: 0, // 0 to 1 to track animation progress
            size: 2 + Math.random() * 2,
            speed: config.pulseSpeed * (0.8 + Math.random() * 0.4) // Slight speed variation
        });
    }

    // Update node states and positions
    function updateNodes() {
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            
            // Update position with very small movements
            node.x += node.vx;
            node.y += node.vy;
            
            // Bounce off walls with damping
            if (node.x <= node.size || node.x >= canvas.width - node.size) {
                node.vx *= -0.8;
                if (node.x <= node.size) node.x = node.size;
                if (node.x >= canvas.width - node.size) node.x = canvas.width - node.size;
            }
            
            if (node.y <= node.size || node.y >= canvas.height - node.size) {
                node.vy *= -0.8;
                if (node.y <= node.size) node.y = node.size;
                if (node.y >= canvas.height - node.size) node.y = canvas.height - node.size;
            }
            
            // Occasionally activate a random node to initiate data flow
            if (!node.active && Math.random() < 0.002) {
                node.active = true;
                node.activationTime = Date.now();
                
                // Send data to connected nodes
                setTimeout(() => {
                    node.connections.forEach(connIndex => {
                        createDataPulse(i, connIndex);
                    });
                    
                    // Deactivate after a random time
                    setTimeout(() => {
                        node.active = false;
                    }, 500 + Math.random() * 2000);
                }, 200);
            }
        }
    }

    // Update data pulses
    function updateDataPulses() {
        // Update existing pulses
        for (let i = dataPulses.length - 1; i >= 0; i--) {
            const pulse = dataPulses[i];
            
            // Update progress
            pulse.progress += pulse.speed / 100;
            
            // Remove completed pulses
            if (pulse.progress >= 1) {
                // Activate the destination node
                nodes[pulse.toNode].active = true;
                nodes[pulse.toNode].activationTime = Date.now();
                
                // Sometimes create new pulses from the destination
                if (Math.random() < 0.6) {
                    setTimeout(() => {
                        const connections = nodes[pulse.toNode].connections;
                        if (connections.length > 0) {
                            // Send to 1-2 random connections
                            const numPulses = Math.floor(Math.random() * 2) + 1;
                            for (let j = 0; j < Math.min(numPulses, connections.length); j++) {
                                const targetIdx = connections[Math.floor(Math.random() * connections.length)];
                                createDataPulse(pulse.toNode, targetIdx);
                            }
                        }
                    }, 100 + Math.random() * 200);
                }
                
                // Remove this pulse
                dataPulses.splice(i, 1);
            }
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
            
            // Draw the pulse
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = config.colors.pulse;
            ctx.beginPath();
            ctx.arc(x, y, pulse.size, 0, Math.PI * 2);
            ctx.fill();
            
            // Add glow effect
            ctx.globalAlpha = 0.4;
            const gradient = ctx.createRadialGradient(
                x, y, pulse.size * 0.5,
                x, y, pulse.size * 2
            );
            gradient.addColorStop(0, config.colors.pulse);
            gradient.addColorStop(1, 'rgba(67, 209, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, pulse.size * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.globalAlpha = 1;
    }

    // Draw active nodes with highlight effect
    function drawActiveNodes() {
        const now = Date.now();
        
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (!node.active) continue;
            
            // Calculate pulse effect (expands and fades out)
            const timeSinceActivation = now - node.activationTime;
            const pulseSize = node.size * (1 + Math.min(timeSinceActivation / 1000, 1.5));
            const pulseOpacity = Math.max(0, 1 - timeSinceActivation / 2000);
            
            // Draw active node highlight
            ctx.globalAlpha = pulseOpacity * 0.6;
            ctx.fillStyle = config.colors.activeNode;
            ctx.beginPath();
            ctx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Restore opacity
            ctx.globalAlpha = 1;
            
            // Draw stronger core for active node
            ctx.fillStyle = config.colors.activeNode;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.size * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Render the scene
    function render() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw connections
        ctx.strokeStyle = config.colors.connection;
        ctx.lineWidth = 0.8;
        
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            
            for (let j = 0; j < node.connections.length; j++) {
                const connectedNode = nodes[node.connections[j]];
                
                ctx.beginPath();
                ctx.moveTo(node.x, node.y);
                ctx.lineTo(connectedNode.x, connectedNode.y);
                ctx.stroke();
            }
        }
        
        // Draw nodes
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            
            // Draw regular nodes
            if (!node.active) {
                ctx.fillStyle = config.colors.node;
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
                ctx.fill();
                
                // Add subtle glow
                const gradient = ctx.createRadialGradient(
                    node.x, node.y, node.size * 0.5,
                    node.x, node.y, node.size * 2
                );
                gradient.addColorStop(0, 'rgba(255, 184, 108, 0.3)');
                gradient.addColorStop(1, 'rgba(255, 184, 108, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.size * 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Draw active nodes with highlight
        drawActiveNodes();
        
        // Draw data pulses
        drawDataPulses();
    }

    // Animation loop
    function animate() {
        updateNodes();
        updateDataPulses();
        render();
        requestAnimationFrame(animate);
    }

    // Initialize and start animation
    initNodes();
    
    // Start with a few active nodes
    for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * nodes.length);
        nodes[randomIndex].active = true;
        nodes[randomIndex].activationTime = Date.now();
        
        // Create initial pulses
        setTimeout(() => {
            const connections = nodes[randomIndex].connections;
            connections.forEach(connIndex => {
                createDataPulse(randomIndex, connIndex);
            });
        }, 500);
    }
    
    animate();
    
    // Interaction handling - create pulses when clicking near nodes
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Find the closest node
        let closestNode = null;
        let closestDistance = Infinity;
        
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const dx = node.x - x;
            const dy = node.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestNode = i;
            }
        }
        
        // Activate the closest node if within a reasonable distance
        if (closestDistance < 50) {
            nodes[closestNode].active = true;
            nodes[closestNode].activationTime = Date.now();
            
            // Send pulses to all connected nodes
            nodes[closestNode].connections.forEach(connIndex => {
                createDataPulse(closestNode, connIndex);
            });
        }
    });
}); 