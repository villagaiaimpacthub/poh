// Use global debug function
const debug = window.debug || console.log;

debug('Network visualization script starting...');

// Verify D3.js is available
if (typeof d3 === 'undefined') {
    debug('Error: D3.js not found!');
    throw new Error('D3.js is required but not loaded!');
}

debug('D3.js version: ' + d3.version);

// Network visualization configuration
const config = {
    width: 1000,
    height: 800,
    nodeRadius: 20,
    colors: {
        founder: '#FFD700',      // Gold - Original members, retired from validation duties
        grandparent: '#9575CD',  // Purple - Network validators, wise elders, ensure humanity verification
        parent: '#64B5F6',       // Blue - Active inviters, must invite exactly 3 new members
        child: '#4CAF50'         // Green - Invited, pending verification by family unit
    },
    founderRadius: 200,         // Radius for founder circle
    nodeSpacing: 80,            // Spacing between parent and child
    linkDistance: 100,          // Distance for force layout links
    forceStrength: 0.1
};

// Initialize network data
let nodes = [];
let links = [];
let nodeCounter = 0;
let simulation;

function createFounderCircle() {
    const founderNodes = [];
    const founderLinks = [];
    
    // Create 8 founders in a perfect circle
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * 2 * Math.PI - Math.PI / 2; // Start from top
        const x = config.founderRadius * Math.cos(angle);
        const y = config.founderRadius * Math.sin(angle);
        const node = {
            id: nodeCounter++,
            type: 'founder',
            x: x,
            y: y,
            children: [],
            // Fix position permanently
            fx: x,
            fy: y,
            isFounder: true,
            generation: 0
        };
        founderNodes.push(node);
    }

    // Connect founders in a circle
    for (let i = 0; i < 8; i++) {
        founderLinks.push({
            source: founderNodes[i].id,
            target: founderNodes[(i + 1) % 8].id,
            isFounderLink: true
        });
    }

    return { founderNodes, founderLinks };
}

// Wait for DOM to be ready
function initializeVisualization() {
    debug('Initializing visualization...');

    // Get network container
    const networkContainer = document.getElementById('network');
    if (!networkContainer) {
        debug('Error: Network container not found!');
        return;
    }

    debug('Network container found');

    // Initialize SVG
    const svg = d3.select('#network')
        .append('svg')
        .attr('width', config.width)
        .attr('height', config.height)
        .style('width', '100%')
        .style('height', '100%')
        .attr('viewBox', `0 0 ${config.width} ${config.height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('background', 'rgba(26, 27, 38, 0.5)');

    debug('SVG created');

    // Create container for zoom with initial transform
    const container = svg.append('g')
        .attr('class', 'viz-container')
        .attr('transform', `translate(${config.width / 2}, ${config.height / 2})`);

    debug('Container created and centered');

    // Initialize link and node groups with explicit class names and styles
    const linkGroup = container.append('g')
        .attr('class', 'links')
        .style('stroke', 'rgba(255, 255, 255, 0.3)')
        .style('stroke-width', '2px');

    const nodeGroup = container.append('g')
        .attr('class', 'nodes')
        .style('stroke', '#fff')
        .style('stroke-width', '2px');

    debug('Link and node groups created with styles');

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            container.attr('transform', event.transform);
        });

    svg.call(zoom);

    function initializeNetwork() {
        debug('Initializing network...');
        
        // Reset network
        nodes = [];
        links = [];
        nodeCounter = 0;

        // Create 8 founders in a perfect circle
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * 2 * Math.PI - Math.PI / 2; // Start from top
            const x = config.founderRadius * Math.cos(angle);
            const y = config.founderRadius * Math.sin(angle);
            const node = {
                id: nodeCounter++,
                type: 'founder',
                x: x,
                y: y,
                children: [],
                // Fix position permanently
                fx: x,
                fy: y,
                isFounder: true
            };
            nodes.push(node);
        }

        // Connect founders in a circle
        for (let i = 0; i < 8; i++) {
            links.push({
                source: nodes[i].id,
                target: nodes[(i + 1) % 8].id,
                isFounderLink: true
            });
        }

        // Initialize force simulation
        if (simulation) simulation.stop();
        
        simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links)
                .id(d => d.id)
                .distance(d => d.isFounderLink ? config.founderRadius * 0.765 : config.linkDistance))
            .force('charge', d3.forceManyBody()
                .strength(d => d.isFounder ? 0 : -150))
            .force('collision', d3.forceCollide()
                .radius(config.nodeRadius * 2))
            .velocityDecay(0.6)
            .alphaMin(0.001)
            .on('tick', updateNetwork);

        updateNetwork();
        debug('Network initialized with 8 founders');
    }

    function updateNetwork() {
        debug('Updating network visualization...');
        
        // Update links with explicit styling
        const link = linkGroup
            .selectAll('line')
            .data(links)
            .join('line')
            .style('stroke', 'rgba(255, 255, 255, 0.3)')
            .style('stroke-width', '2px')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        // Update nodes with explicit styling
        const node = nodeGroup
            .selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('r', config.nodeRadius)
            .style('fill', d => config.colors[d.type])
            .style('stroke', '#fff')
            .style('stroke-width', '2px')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .call(drag(simulation));

        debug(`Updated visualization: ${nodes.length} nodes, ${links.length} links`);
        
        // Update statistics
        document.getElementById('user-count').textContent = nodes.length;
    }

    function growNetwork() {
        debug('Growing network...');
        
        // Only parents can invite, and they must invite exactly 3
        const parentNodes = nodes.filter(node => 
            node.type === 'parent' && (!node.children || node.children.length < 3)
        );
        
        // If no parents available, start by giving each founder their first parent
        if (parentNodes.length === 0 && nodes.length === 8) {
            debug('Creating first generation of parents from founders');
            nodes.forEach(founder => {
                if (founder.type === 'founder') {
                    const angle = Math.atan2(founder.y, founder.x);
                    const parent = {
                        id: nodeCounter++,
                        type: 'parent',
                        children: [],
                        x: founder.x + config.nodeSpacing * Math.cos(angle),
                        y: founder.y + config.nodeSpacing * Math.sin(angle)
                    };
                    nodes.push(parent);
                    links.push({
                        source: founder.id,
                        target: parent.id,
                        isFounderLink: false
                    });
                }
            });
            // Update simulation and return to process these new parents in next click
            simulation.nodes(nodes);
            simulation.force('link').links(links);
            simulation.alpha(0.3).restart();
            updateNetwork();
            return;
        }
        
        if (parentNodes.length === 0) {
            debug('No parent nodes available to invite');
            return;
        }

        // Process each parent
        parentNodes.forEach(parent => {
            // Initialize children array if it doesn't exist
            if (!parent.children) {
                parent.children = [];
            }

            // Parents must invite exactly 3
            while (parent.children.length < 3) {
                const childCount = parent.children.length;
                const parentAngle = Math.atan2(parent.y, parent.x);
                
                // Position children in a circle around their parent
                const angleOffset = (childCount * 2 * Math.PI / 3);
                const childAngle = parentAngle + angleOffset;
                
                const childNode = {
                    id: nodeCounter++,
                    type: 'child',
                    children: [],
                    x: parent.x + config.nodeSpacing * Math.cos(childAngle),
                    y: parent.y + config.nodeSpacing * Math.sin(childAngle),
                    pendingVerification: true,
                    familyUnit: {
                        parent: parent.id,
                        grandparent: null,
                        siblings: []
                    }
                };

                // Add child to network
                parent.children.push(childNode.id);
                nodes.push(childNode);
                links.push({
                    source: parent.id,
                    target: childNode.id,
                    isFounderLink: false
                });
            }

            // When parent has exactly 3 children, promote to grandparent
            if (parent.children.length === 3) {
                parent.type = 'grandparent';
                debug(`Parent ${parent.id} completed their 3 invites and became a validator (wise elder)`);
                
                // Assign this grandparent as validator for their grandchildren
                parent.children.forEach(childId => {
                    const child = nodes.find(n => n.id === childId);
                    if (child) {
                        child.familyUnit.grandparent = parent.id;
                        // Assign siblings
                        child.familyUnit.siblings = parent.children.filter(id => id !== childId);
                    }
                });
            }
        });

        // Process verifications
        nodes.forEach(node => {
            if (node.type === 'child' && node.pendingVerification && 
                node.familyUnit.grandparent && 
                node.familyUnit.siblings.length === 2) {
                // Family unit complete, promote to parent
                node.pendingVerification = false;
                node.type = 'parent';
                debug(`Child ${node.id} verified by complete family unit and promoted to parent`);
            }
        });

        // Update simulation
        simulation.nodes(nodes);
        simulation.force('link').links(links);
        simulation.alpha(0.3).restart();
        updateNetwork();

        // Log current network state
        const stats = getNetworkStats();
        debug(`Network state: ${stats.founders} founders (retired), ${stats.grandparents} validators (wise elders), ${stats.parents} active inviters, ${stats.children} pending verification (Total: ${nodes.length})`);
    }

    function getNetworkStats() {
        return nodes.reduce((acc, node) => {
            acc[node.type + 's']++;
            return acc;
        }, { founders: 0, grandparents: 0, parents: 0, children: 0 });
    }

    function promoteToGrandparent(node) {
        if (node.type === 'parent' && node.children.length === 3) {
            node.type = 'grandparent';
            debug(`Parent ${node.id} completed their 3 invites and became a network validator (wise elder)`);
        }
    }

    // Drag behavior
    function drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        return d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended);
    }

    // Initialize network
    try {
        initializeNetwork();
        debug('Network visualization ready');
    } catch (error) {
        debug('Error initializing network: ' + error.message);
    }

    // Initialize event listeners
    try {
        document.getElementById('grow-btn').addEventListener('click', growNetwork);
        document.getElementById('reset-btn').addEventListener('click', initializeNetwork);
        document.getElementById('center-btn').addEventListener('click', () => {
            svg.transition().duration(750).call(
                zoom.transform,
                d3.zoomIdentity
            );
        });

        // Zoom buttons
        document.getElementById('zoom-in').addEventListener('click', () => {
            svg.transition().duration(750).call(zoom.scaleBy, 2);
        });

        document.getElementById('zoom-out').addEventListener('click', () => {
            svg.transition().duration(750).call(zoom.scaleBy, 0.5);
        });

        document.getElementById('zoom-reset').addEventListener('click', () => {
            svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
        });

        debug('Event listeners initialized');
    } catch (error) {
        debug('Error setting up event listeners: ' + error.message);
    }

    // Auto-grow toggle
    const autoGrowToggle = document.getElementById('auto-grow');
    let autoGrowInterval;

    autoGrowToggle.addEventListener('change', () => {
        if (autoGrowToggle.checked) {
            const frequency = document.getElementById('invite-frequency').value;
            autoGrowInterval = setInterval(growNetwork, frequency * 1000);
        } else {
            clearInterval(autoGrowInterval);
        }
    });

    // Frequency slider
    const frequencySlider = document.getElementById('invite-frequency');
    const frequencyValue = document.getElementById('invite-value');

    frequencySlider.addEventListener('input', () => {
        const value = frequencySlider.value;
        frequencyValue.textContent = `${value} days`;
        
        if (autoGrowToggle.checked) {
            clearInterval(autoGrowInterval);
            autoGrowInterval = setInterval(growNetwork, value * 1000);
        }
    });
}

// Initialize when the script loads
debug('Setting up initialization...');
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVisualization);
} else {
    initializeVisualization();
}

debug('Network visualization script loaded'); 