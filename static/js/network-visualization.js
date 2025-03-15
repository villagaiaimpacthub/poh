/**
 * Web5 Network Visualization for Hero Section
 * Creates an interactive network visualization with color progression
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check if the element exists before initializing
    const networkContainer = document.getElementById('network-visualization');
    if (!networkContainer) return;

    // Configuration
    const config = {
        nodeCount: 45,
        connectionLimit: 4,
        nodeMinSize: 3,
        nodeMaxSize: 7,
        nodeSpeed: 0.2,
        connectionDistance: 150,
        colorCycleSpeed: 0.01,
        colors: {
            green: '#10b981',
            blue: '#43d1ff',
            purple: '#7a43ff',
            gold: '#ffb86c'
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
    let colorPhase = 0;

    // Initialize nodes
    function initNodes() {
        nodes = [];
        for (let i = 0; i < config.nodeCount; i++) {
            nodes.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: config.nodeMinSize + Math.random() * (config.nodeMaxSize - config.nodeMinSize),
                vx: (Math.random() - 0.5) * config.nodeSpeed,
                vy: (Math.random() - 0.5) * config.nodeSpeed,
                connections: [],
                interacted: false
            });
        }

        // Establish initial connections
        connectNodes();
    }

    // Calculate color based on the current phase
    function getCurrentColor() {
        if (colorPhase < 0.25) {
            // Green to Blue
            return lerpColor(
                config.colors.green, 
                config.colors.blue, 
                colorPhase * 4
            );
        } else if (colorPhase < 0.5) {
            // Blue to Purple
            return lerpColor(
                config.colors.blue, 
                config.colors.purple, 
                (colorPhase - 0.25) * 4
            );
        } else if (colorPhase < 0.75) {
            // Purple to Gold
            return lerpColor(
                config.colors.purple, 
                config.colors.gold, 
                (colorPhase - 0.5) * 4
            );
        } else {
            // Gold to Green
            return lerpColor(
                config.colors.gold, 
                config.colors.green, 
                (colorPhase - 0.75) * 4
            );
        }
    }

    // Linear interpolation for colors
    function lerpColor(color1, color2, factor) {
        const r1 = parseInt(color1.substring(1, 3), 16);
        const g1 = parseInt(color1.substring(3, 5), 16);
        const b1 = parseInt(color1.substring(5, 7), 16);
        
        const r2 = parseInt(color2.substring(1, 3), 16);
        const g2 = parseInt(color2.substring(3, 5), 16);
        const b2 = parseInt(color2.substring(5, 7), 16);
        
        const r = Math.round(r1 + factor * (r2 - r1));
        const g = Math.round(g1 + factor * (g2 - g1));
        const b = Math.round(b1 + factor * (b2 - b1));
        
        return `rgb(${r}, ${g}, ${b})`;
    }

    // Establish connections between nodes
    function connectNodes() {
        for (let i = 0; i < nodes.length; i++) {
            nodes[i].connections = [];
        }

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            
            // Sort other nodes by distance
            const nodesByDistance = nodes
                .map((otherNode, index) => {
                    if (index === i) return { index: index, distance: Infinity };
                    const dx = node.x - otherNode.x;
                    const dy = node.y - otherNode.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    return { index: index, distance: distance };
                })
                .filter(n => n.distance < config.connectionDistance)
                .sort((a, b) => a.distance - b.distance);
            
            // Connect to closest nodes, up to the connection limit
            const connectionsToAdd = Math.min(config.connectionLimit, nodesByDistance.length);
            for (let j = 0; j < connectionsToAdd; j++) {
                node.connections.push(nodesByDistance[j].index);
            }
        }
    }

    // Update node positions
    function updateNodes() {
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            
            // Move the node
            node.x += node.vx;
            node.y += node.vy;
            
            // Bounce off edges
            if (node.x < 0 || node.x > canvas.width) {
                node.vx = -node.vx;
                node.x = Math.max(0, Math.min(canvas.width, node.x));
            }
            if (node.y < 0 || node.y > canvas.height) {
                node.vy = -node.vy;
                node.y = Math.max(0, Math.min(canvas.height, node.y));
            }
        }
        
        // Update color phase
        colorPhase = (colorPhase + config.colorCycleSpeed) % 1;
        
        // Reconnect nodes periodically
        if (Math.random() < 0.02) {
            connectNodes();
        }
    }

    // Render the visualization
    function render() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const currentColor = getCurrentColor();
        
        // Draw connections first
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.5;
        
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
        
        // Then draw nodes
        ctx.globalAlpha = 0.8;
        
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            
            // Draw the node
            ctx.fillStyle = currentColor;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
            ctx.fill();
            
            // Add a subtle glow to each node
            const gradient = ctx.createRadialGradient(
                node.x, node.y, 0,
                node.x, node.y, node.size * 3
            );
            gradient.addColorStop(0, currentColor.replace('rgb', 'rgba').replace(')', ', 0.3)'));
            gradient.addColorStop(1, currentColor.replace('rgb', 'rgba').replace(')', ', 0)'));
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.size * 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Animation loop
    function animate() {
        updateNodes();
        render();
        requestAnimationFrame(animate);
    }

    // Add mouse interaction
    let mouseX = 0;
    let mouseY = 0;
    let isMouseOver = false;

    networkContainer.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        isMouseOver = true;
        
        // Mark nodes near the mouse as interacted
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const dx = node.x - mouseX;
            const dy = node.y - mouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 50) {
                node.interacted = true;
                
                // Add a slight repulsion effect
                const angle = Math.atan2(dy, dx);
                const force = 0.2 * (1 - distance / 50);
                node.vx += Math.cos(angle) * force;
                node.vy += Math.sin(angle) * force;
            }
        }
    });

    networkContainer.addEventListener('mouseleave', () => {
        isMouseOver = false;
    });

    // Initialize and start animation
    initNodes();
    animate();
}); 