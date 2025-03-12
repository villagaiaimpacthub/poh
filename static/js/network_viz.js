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
        founder: '#FFD700',      // Gold - Full Node Access (Grandparents with 6 DIDs)
        grandparent: '#9575CD',  // Purple - Validators with 3 DIDs
        parent: '#64B5F6',       // Blue - Verified members with 2 DIDs
        child: '#4CAF50'         // Green - Newly invited, no DIDs
    },
    founderRadius: 150,
    nodeSpacing: {
        firstLayer: 250,
        between: 200,
        siblings: 100,
        familyBuffer: 150
    },
    layerRadii: {
        founder: 150,
        grandparent: 300,
        parent: 450,
        child: 650
    },
    linkDistance: 100,
    forceStrength: 0.2,
    didPrefix: 'did:poh:',
    defaultVerificationPeriod: 3,
    notifications: {
        duration: 3000,
        position: { x: 20, y: 20 }
    }
};

// Initialize network data
let nodes = [];
let links = [];
let nodeCounter = 0;
let simulation;

// Add network state tracking
let networkState = {
    daysSinceStart: 0,
    lastGrowthTimestamp: null,
    verificationPeriod: config.defaultVerificationPeriod
};

// Add tracking for currently displayed node
let currentlyDisplayedNodeId = null;

// Add network state history tracking
let networkHistory = [];

// Helper function to generate DIDs
function generatePersonalDID(id) {
    return `${config.didPrefix}person:${id}:${Date.now()}`;
}

function generateFamilyUnitDID(verifierId, parentId, childrenIds) {
    return `${config.didPrefix}family:${verifierId}:${parentId}:${childrenIds.sort().join('-')}`;
}

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

    // Create top control panel
    const controlPanel = document.createElement('div');
    controlPanel.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        padding: 10px;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        gap: 10px;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    // Add buttons to control panel
    const buttonStyles = `
        padding: 8px 16px;
        margin: 0 5px;
        border: none;
        border-radius: 4px;
        background: #4CAF50;
        color: white;
        cursor: pointer;
        font-weight: bold;
    `;
    
    const buttons = [
        { id: 'grow-btn', text: 'Grow Network' },
        { id: 'back-btn', text: '← Back' },
        { id: 'reset-btn', text: 'Reset' },
        { id: 'center-btn', text: 'Center' },
        { id: 'zoom-in', text: 'Zoom In' },
        { id: 'zoom-out', text: 'Zoom Out' },
        { id: 'zoom-reset', text: 'Reset Zoom' }
    ];
    
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.id = btn.id;
        button.textContent = btn.text;
        button.style.cssText = buttonStyles;
        controlPanel.appendChild(button);
    });
    
    // Add auto-grow controls
    const autoGrowContainer = document.createElement('div');
    autoGrowContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        color: white;
    `;
    
    const autoGrowLabel = document.createElement('label');
    autoGrowLabel.id = 'auto-grow-label';
    autoGrowLabel.textContent = 'Auto Verification';
    autoGrowLabel.style.color = 'white';
    
    const autoGrowToggle = document.createElement('input');
    autoGrowToggle.type = 'checkbox';
    autoGrowToggle.id = 'auto-grow';
    
    const frequencyLabel = document.createElement('label');
    frequencyLabel.id = 'frequency-label';
    frequencyLabel.textContent = 'Verification Period (Days)';
    frequencyLabel.style.color = 'white';
    
    const frequencySlider = document.createElement('input');
    frequencySlider.type = 'range';
    frequencySlider.id = 'invite-frequency';
    frequencySlider.min = '1';
    frequencySlider.max = '10';
    frequencySlider.value = config.defaultVerificationPeriod;
    
    const frequencyValue = document.createElement('span');
    frequencyValue.id = 'invite-value';
    frequencyValue.textContent = `${config.defaultVerificationPeriod} days`;
    frequencyValue.style.color = 'white';
    
    autoGrowContainer.appendChild(autoGrowLabel);
    autoGrowContainer.appendChild(autoGrowToggle);
    autoGrowContainer.appendChild(frequencyLabel);
    autoGrowContainer.appendChild(frequencySlider);
    autoGrowContainer.appendChild(frequencyValue);
    
    controlPanel.appendChild(autoGrowContainer);
    
    // Add control panel to document
    document.body.insertBefore(controlPanel, document.body.firstChild);

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
        
        nodes = [];
        links = [];
        nodeCounter = 0;
        networkState = {
            daysSinceStart: 0,
            lastGrowthTimestamp: null,
            verificationPeriod: config.defaultVerificationPeriod
        };

        // Create 8 founders in a perfect circle
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
            const x = config.founderRadius * Math.cos(angle);
            const y = config.founderRadius * Math.sin(angle);
            const node = {
                id: nodeCounter++,
                type: 'founder',
                x: x,
                y: y,
                children: [],
                fx: x,
                fy: y,
                isFounder: true,
                hasInvited: false,
                did: generatePersonalDID(nodeCounter - 1), // Personal DID
                familyUnits: [], // Will accumulate family DIDs through verifications
                verifiedCount: 0 // Track number of families verified
            };
            nodes.push(node);
            debug(`Created founder #${node.id} with personal DID`);
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
                .distance(d => {
                    if (d.isFounderLink) return config.founderRadius * 0.765;
                    if (d.source.type === 'founder' || d.target.type === 'founder') {
                        return config.nodeSpacing.firstLayer;
                    }
                    if (d.isSiblingLink) {
                        return config.nodeSpacing.siblings;
                    }
                    // Add extra distance between different family groups
                    if (d.source.familyUnit?.parent !== d.target.familyUnit?.parent) {
                        return config.nodeSpacing.between + config.nodeSpacing.familyBuffer;
                    }
                    return config.nodeSpacing.between;
                }))
            .force('charge', d3.forceManyBody()
                .strength(d => {
                    if (d.isFounder) return -200;
                    if (d.type === 'child') return -300;
                    return -400;
                }))
            .force('collision', d3.forceCollide()
                .radius(d => {
                    const baseRadius = config.nodeRadius * 2.5;
                    return baseRadius;
                })
                .strength(1))
            .force('radial', d3.forceRadial(d => config.layerRadii[d.type]).strength(0.9))
            .velocityDecay(0.7)
            .alphaMin(0.001)
            .on('tick', updateNetwork);

        updateNetwork();
        debug('Network initialized with 8 founders with DIDs');

        // Save initial state
        networkHistory = [];
        saveNetworkState();

        // Update initial stats
        updateNetworkStats();
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

        // Update nodes with explicit styling and click handling
        const node = nodeGroup
            .selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('r', config.nodeRadius)
            .style('fill', d => config.colors[d.type])
            .style('stroke', '#fff')
            .style('stroke-width', '2px')
            .style('cursor', 'pointer')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .on('click', (event, d) => showNodeInfo(d))
            .call(drag(simulation));

        // Update info panel if a node is being displayed
        if (currentlyDisplayedNodeId !== null) {
            const displayedNode = nodes.find(n => n.id === currentlyDisplayedNodeId);
            if (displayedNode) {
                updateNodeInfoPanel(displayedNode);
            }
        }

        debug(`Updated visualization: ${nodes.length} nodes, ${links.length} links`);
        
        // Update statistics
        updateNetworkStats();
    }

    function updateNetworkStats() {
        const stats = getNetworkStats();
        const personalDIDs = nodes.filter(n => n.did).length;
        const familyUnitDIDs = nodes.reduce((acc, n) => acc + (n.familyUnits ? n.familyUnits.length : 0), 0);
        
        // Update statistics in the UI
        document.getElementById('user-count').textContent = nodes.length;
        document.getElementById('days-count').textContent = networkState.daysSinceStart;
        document.getElementById('network-stats').textContent = 
            `Founders: ${stats.founders} | Grandparents: ${stats.grandparents} | ` +
            `Parents: ${stats.parents} | Children: ${stats.children}`;
        document.getElementById('did-stats').textContent = 
            `Personal DIDs: ${personalDIDs} | Family Unit DIDs: ${familyUnitDIDs}`;
    }

    function getNodeRadius(node) {
        return Math.sqrt(node.x * node.x + node.y * node.y);
    }

    function calculateNewPosition(parentNode, index, numChildren) {
        const targetRadius = config.layerRadii.child;
        const baseAngle = Math.atan2(parentNode.y, parentNode.x);
        
        // Calculate family group size and add buffer
        const familySize = nodes.filter(n => n.familyUnit && n.familyUnit.parent === parentNode.id).length;
        const familyBuffer = config.nodeSpacing.familyBuffer * (familySize / 2);
        
        // Adjust target radius based on parent's position and family buffer
        const adjustedRadius = targetRadius + familyBuffer;
        
        // Further reduce angle spread for tighter family grouping
        // Reduce angle spread and center children more tightly around parent
        const angleSpread = Math.PI / 4; // 45 degrees spread
        const angle = baseAngle + ((index - (numChildren - 1) / 2) * (angleSpread / (numChildren - 1)));
        
        return {
            x: adjustedRadius * Math.cos(angle),
            y: adjustedRadius * Math.sin(angle)
        };
    }

    function growNetwork() {
        debug('Growing network...');
        
        // Update days counter
        const now = Date.now();
        if (networkState.lastGrowthTimestamp) {
            networkState.daysSinceStart += networkState.verificationPeriod;
        }
        networkState.lastGrowthTimestamp = now;

        // First stage: Founders invite initial children (Gold → Green)
        const uninvitedFounders = nodes.filter(node => 
            node.type === 'founder' && !node.hasInvited
        );
        
        if (uninvitedFounders.length > 0) {
            debug('Creating first generation of children from founders');
            uninvitedFounders.forEach(founder => {
                const childrenIds = [];
                for (let i = 0; i < 3; i++) {
                    const pos = calculateNewPosition(founder, i, 3);
                    const child = {
                        id: nodeCounter++,
                        type: 'child',  // Start as green
                        children: [],
                        x: pos.x,
                        y: pos.y,
                        pendingVerification: true,
                        did: null,
                        familyUnits: [],
                        familyUnit: {
                            parent: founder.id,
                            verifier: null,
                            siblings: []
                        }
                    };
                    nodes.push(child);
                    childrenIds.push(child.id);
                    links.push({
                        source: founder.id,
                        target: child.id,
                        value: 1
                    });
                }

                // Add sibling links
                for (let i = 0; i < childrenIds.length; i++) {
                    for (let j = i + 1; j < childrenIds.length; j++) {
                        links.push({
                            source: childrenIds[i],
                            target: childrenIds[j],
                            isSiblingLink: true,
                            value: 0.5
                        });
                    }
                }
                
                founder.children = founder.children || [];
                founder.children = founder.children.concat(childrenIds);
                founder.hasInvited = true;
            });
            
            simulation.nodes(nodes);
            simulation.force('link').links(links);
            simulation.alpha(1).restart();
            updateNetwork();
            return;
        }

        // Verification stage: Convert green children to blue parents
        const unverifiedChildren = nodes.filter(node => 
            node.type === 'child' && 
            node.pendingVerification
        );

        if (unverifiedChildren.length > 0) {
            debug('Verifying children and converting to parents');
            const childrenByParent = {};
            
            // Group all children by their parent
            unverifiedChildren.forEach(child => {
                const parentId = child.familyUnit.parent;
                if (!childrenByParent[parentId]) {
                    childrenByParent[parentId] = [];
                }
                childrenByParent[parentId].push(child);
            });

            // Process all complete family groups at once
            const completeGroups = Object.entries(childrenByParent).filter(([_, children]) => children.length === 3);
            debug(`Found ${completeGroups.length} complete family groups to verify`);

            if (completeGroups.length > 0) {
                // First, collect all DIDs that will be generated
                const familyUnitDIDs = completeGroups.map(([parentId, children]) => {
                    const parent = nodes.find(n => n.id === parseInt(parentId));
                    const verifier = nodes.find(n => 
                        (n.type === 'founder' && n.id !== parent.id) || 
                        (parent.familyUnit && n.id === parent.familyUnit.parent)
                    );
                    if (verifier) {
                        return {
                            parentId: parseInt(parentId),
                            verifierId: verifier.id,
                            childrenIds: children.map(c => c.id),
                            did: generateFamilyUnitDID(verifier.id, parentId, children.map(c => c.id))
                        };
                    }
                    return null;
                }).filter(Boolean);

                debug(`Generated ${familyUnitDIDs.length} family unit DIDs`);

                // Then apply all DIDs and promotions at once
                familyUnitDIDs.forEach(({ parentId, verifierId, childrenIds, did }) => {
                    const parent = nodes.find(n => n.id === parentId);
                    const verifier = nodes.find(n => n.id === verifierId);
                    const children = childrenIds.map(id => nodes.find(n => n.id === id));

                    debug(`Processing family unit: Parent #${parentId}, Verifier #${verifierId}`);

                    // Verify children
                    children.forEach(child => {
                        child.did = generatePersonalDID(child.id);
                        child.familyUnit.verifier = verifierId;
                        child.familyUnit.siblings = childrenIds.filter(id => id !== child.id);
                        child.familyUnits = [did];
                        child.type = 'parent';
                        child.pendingVerification = false;
                        child.verifiedCount = 0;
                        debug(`Child #${child.id} verified: Got personal DID and family DID (total: 2)`);
                        
                        // Immediately check for promotion
                        checkAndPromoteNode(child);
                    });

                    // Update parent's DIDs
                    if (parent) {
                        parent.familyUnits = parent.familyUnits || [];
                        if (!parent.familyUnits.includes(did)) {
                            parent.familyUnits.push(did);
                            parent.verifiedCount = (parent.verifiedCount || 0) + 1;
                            debug(`Parent #${parent.id} received family DID (total DIDs: ${parent.familyUnits.length + 1})`);
                            
                            // Immediately check for promotion
                            checkAndPromoteNode(parent);
                        }
                    }

                    // Update verifier's DIDs
                    if (verifier) {
                        verifier.familyUnits = verifier.familyUnits || [];
                        if (!verifier.familyUnits.includes(did)) {
                            verifier.familyUnits.push(did);
                            verifier.verifiedCount = (verifier.verifiedCount || 0) + 1;
                            debug(`Verifier #${verifier.id} verified family unit (total DIDs: ${verifier.familyUnits.length + 1}, verified: ${verifier.verifiedCount})`);
                            
                            // Immediately check for promotion
                            checkAndPromoteNode(verifier);
                        }
                    }
                });

                // Force network update
                simulation.alpha(1).restart();
                updateNetwork();
                return;
            }
        }

        // Parent invitation stage: Blue parents invite green children
        const activeParents = nodes.filter(node => 
            node.type === 'parent' && 
            node.did && 
            (!node.children || node.children.length < 3)
        );

        if (activeParents.length > 0) {
            debug(`Found ${activeParents.length} parents ready to invite children`);
            activeParents.forEach(parent => {
                const childrenIds = [];
                
                // Create 3 children (Green)
                for (let i = 0; i < 3; i++) {
                    const pos = calculateNewPosition(parent, i, 3);
                    const child = {
                        id: nodeCounter++,
                        type: 'child',  // Start as green
                        children: [],
                        x: pos.x,
                        y: pos.y,
                        pendingVerification: true,
                        did: null,
                        familyUnits: [],
                        familyUnit: {
                            parent: parent.id,
                            verifier: parent.familyUnit.parent,
                            siblings: []
                        }
                    };
                    childrenIds.push(child.id);
                    nodes.push(child);
                    links.push({
                        source: parent.id,
                        target: child.id,
                        value: 1
                    });
                }

                // Add sibling links
                for (let i = 0; i < childrenIds.length; i++) {
                    for (let j = i + 1; j < childrenIds.length; j++) {
                        links.push({
                            source: childrenIds[i],
                            target: childrenIds[j],
                            isSiblingLink: true,
                            value: 0.5
                        });
                    }
                }

                parent.children = parent.children || [];
                parent.children = parent.children.concat(childrenIds);
            });

            simulation.nodes(nodes);
            simulation.force('link').links(links);
            simulation.alpha(1).restart();
            updateNetwork();
            return;
        }

        updateNetworkStats();
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

    function showNotification(message, type = 'info') {
        const notification = d3.select('body')
            .append('div')
            .attr('class', `notification ${type}`)
            .style('position', 'fixed')
            .style('top', `${config.notifications.position.y}px`)
            .style('left', `${config.notifications.position.x}px`)
            .style('background-color', 'rgba(0, 0, 0, 0.8)')
            .style('color', '#fff')
            .style('padding', '10px 20px')
            .style('border-radius', '5px')
            .style('z-index', 1000)
            .style('opacity', 0)
            .text(message);

        notification
            .transition()
            .duration(300)
            .style('opacity', 1)
            .transition()
            .delay(config.notifications.duration - 300)
            .duration(300)
            .style('opacity', 0)
            .remove();
    }

    function showNodeInfo(node) {
        currentlyDisplayedNodeId = node.id;  // Track currently displayed node
        updateNodeInfoPanel(node);
    }

    function updateNodeInfoPanel(node) {
        // Remove any existing info panel
        d3.select('#node-info').remove();

        const infoPanel = d3.select('body')
            .append('div')
            .attr('id', 'node-info')
            .style('position', 'fixed')
            .style('top', '20px')
            .style('right', '20px')
            .style('background-color', 'rgba(0, 0, 0, 0.8)')
            .style('color', '#fff')
            .style('padding', '20px')
            .style('border-radius', '5px')
            .style('max-width', '300px')
            .style('z-index', 1000);

        // Basic info
        infoPanel.append('h3')
            .style('margin', '0 0 10px 0')
            .style('color', config.colors[node.type])
            .text(`${node.type.charAt(0).toUpperCase() + node.type.slice(1)} #${node.id}`);

        // Enhanced DID info
        const didInfo = infoPanel.append('div')
            .style('margin', '10px 0')
            .style('padding', '10px')
            .style('background', 'rgba(0, 0, 0, 0.3)')
            .style('border-radius', '3px');

        // DID Counts
        const personalDIDCount = node.did ? 1 : 0;
        const familyDIDCount = node.familyUnits ? node.familyUnits.length : 0;
        const totalDIDs = personalDIDCount + familyDIDCount;

        didInfo.append('div')
            .style('margin-bottom', '5px')
            .html(`<strong>Personal DID:</strong> ${node.did ? '✓' : '✗'}`);

        didInfo.append('div')
            .style('margin-bottom', '5px')
            .html(`<strong>Family DIDs:</strong> ${familyDIDCount}`);

        didInfo.append('div')
            .style('margin-bottom', '10px')
            .style('color', '#FFD700')
            .html(`<strong>Total DIDs:</strong> ${totalDIDs}`);

        // Promotion Progress
        const promotionInfo = didInfo.append('div')
            .style('margin-top', '10px');

        switch(node.type) {
            case 'child':
                promotionInfo.html(`<strong>Needs verification to become Parent (0/2 DIDs)</strong>`);
                break;
            case 'parent':
                promotionInfo
                    .style('color', totalDIDs >= 3 ? '#4CAF50' : '#FFA726')
                    .html(`<strong>Progress to Grandparent:</strong> ${totalDIDs}/3 DIDs`);
                break;
            case 'grandparent':
                promotionInfo
                    .style('color', totalDIDs >= 6 ? '#4CAF50' : '#FFA726')
                    .html(`<strong>Progress to Full Node Access:</strong> ${totalDIDs}/6 DIDs`);
                break;
            case 'founder':
                promotionInfo
                    .style('color', '#FFD700')
                    .html(`<strong>Full Node Access (6 DIDs)</strong>`);
                break;
        }

        // Add verification count to the info panel
        if (node.type === 'grandparent' || node.type === 'founder') {
            didInfo.append('div')
                .style('margin-bottom', '5px')
                .html(`<strong>Families Verified:</strong> ${node.verifiedCount || 0}`);
        }

        // Connected users
        const connectedUsers = links
            .filter(link => link.source.id === node.id || link.target.id === node.id)
            .map(link => link.source.id === node.id ? link.target : link.source);

        if (connectedUsers.length > 0) {
            infoPanel.append('div')
                .style('margin-bottom', '10px')
                .text(`Connected Users: ${connectedUsers.length}`);
        }

        // Close button
        infoPanel.append('button')
            .style('position', 'absolute')
            .style('top', '5px')
            .style('right', '5px')
            .style('background', 'none')
            .style('border', 'none')
            .style('color', '#fff')
            .style('cursor', 'pointer')
            .text('×')
            .on('click', () => {
                currentlyDisplayedNodeId = null;  // Clear tracking when panel is closed
                infoPanel.remove();
            });
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
        document.getElementById('grow-btn').addEventListener('click', () => {
            saveNetworkState(); // Save current state before growing
            growNetwork();
        });
        
        document.getElementById('back-btn').addEventListener('click', restorePreviousState);
        document.getElementById('back-btn').disabled = true; // Initially disabled
        
        document.getElementById('reset-btn').addEventListener('click', () => {
            networkHistory = []; // Clear history on reset
            initializeNetwork();
        });
        
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

        // Update auto-grow toggle and slider labels
        const autoGrowToggle = document.getElementById('auto-grow');
        const frequencySlider = document.getElementById('invite-frequency');
        const frequencyValue = document.getElementById('invite-value');
        
        let autoGrowInterval;

        autoGrowToggle.addEventListener('change', () => {
            if (autoGrowToggle.checked) {
                networkState.verificationPeriod = parseInt(frequencySlider.value);
                autoGrowInterval = setInterval(() => {
                    saveNetworkState(); // Save state before auto-growing
                    growNetwork();
                }, frequencySlider.value * 1000);
            } else {
                clearInterval(autoGrowInterval);
            }
        });

        frequencySlider.addEventListener('input', () => {
            const value = parseInt(frequencySlider.value);
            networkState.verificationPeriod = value;
            frequencyValue.textContent = `${value} days`;
            
            if (autoGrowToggle.checked) {
                clearInterval(autoGrowInterval);
                autoGrowInterval = setInterval(() => {
                    saveNetworkState(); // Save state before auto-growing
                    growNetwork();
                }, value * 1000);
            }
        });

        debug('Event listeners initialized');
    } catch (error) {
        debug('Error setting up event listeners: ' + error.message);
    }

    // Add CSS styles
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            transition: opacity 0.3s ease-in-out;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .notification.success {
            background-color: rgba(76, 175, 80, 0.9) !important;
        }
        #node-info {
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
    `;
    document.head.appendChild(style);
}

// Initialize when the script loads
debug('Setting up initialization...');
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVisualization);
} else {
    initializeVisualization();
}

debug('Network visualization script loaded');

// Update the checkAndPromoteNode function
function checkAndPromoteNode(node) {
    const totalDIDs = (node.familyUnits ? node.familyUnits.length : 0) + (node.did ? 1 : 0);
    
    debug(`Checking promotion for #${node.id} (${node.type}): ${totalDIDs} DIDs (${node.did ? 1 : 0} personal + ${node.familyUnits ? node.familyUnits.length : 0} family)`);

    // Parent → Grandparent: Needs exactly 3 DIDs total
    if (node.type === 'parent' && totalDIDs >= 3) {
        debug(`PROMOTING: Parent #${node.id} to Grandparent with ${totalDIDs} DIDs`);
        node.type = 'grandparent';
        showNotification(`Parent #${node.id} promoted to Grandparent (${totalDIDs} DIDs)`, 'success');
        
        // Update node position for the new type
        node.fx = null;
        node.fy = null;
        
        // Force an immediate network update
        simulation.alpha(1).restart();
        updateNetwork();
        return true;
    }
    
    // Grandparent → Full Node Access: Needs 6 DIDs total
    if (node.type === 'grandparent' && totalDIDs >= 6) {
        debug(`PROMOTING: Grandparent #${node.id} to Full Node Access with ${totalDIDs} DIDs`);
        node.type = 'founder';
        node.isFounder = true;
        
        // Position in founder circle
        const founderCount = nodes.filter(n => n.type === 'founder').length;
        const angle = (founderCount / 8) * 2 * Math.PI - Math.PI / 2;
        node.fx = config.founderRadius * Math.cos(angle);
        node.fy = config.founderRadius * Math.sin(angle);
        
        showNotification(`Grandparent #${node.id} achieved Full Node Access! (${totalDIDs} DIDs)`, 'success');
        
        // Force an immediate network update
        simulation.alpha(1).restart();
        updateNetwork();
        return true;
    }
    
    return false;
}

function saveNetworkState() {
    const state = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        links: JSON.parse(JSON.stringify(links)),
        nodeCounter: nodeCounter,
        networkState: JSON.parse(JSON.stringify(networkState))
    };
    networkHistory.push(state);
    
    // Enable back button if we have history
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.disabled = networkHistory.length <= 1;
    }
}

function restorePreviousState() {
    if (networkHistory.length <= 1) return; // Keep at least initial state
    
    // Remove current state
    networkHistory.pop();
    // Get previous state
    const previousState = networkHistory[networkHistory.length - 1];
    
    // Restore the state
    nodes = previousState.nodes;
    links = previousState.links;
    nodeCounter = previousState.nodeCounter;
    networkState = previousState.networkState;
    
    // Update simulation with restored nodes and links
    simulation.nodes(nodes);
    simulation.force('link').links(links);
    
    // Update visualization
    simulation.alpha(1).restart();
    updateNetwork();
    
    // Update back button state
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.disabled = networkHistory.length <= 1;
    }
} 