// Use global debug function
const debug = window.debug || console.log;

debug('Network visualization script starting...');

// Verify D3.js is available
if (typeof d3 === 'undefined') {
    debug('Error: D3.js not found!');
    throw new Error('D3.js is required but not loaded!');
}

debug('D3.js version: ' + d3.version);

// Global variables for D3 selections and network state
const globals = {
    svg: null,
    container: null,
    linkGroup: null,
    nodeGroup: null,
    simulation: null,
    nodes: [],
    links: [],
    nodeCounter: 0,
    networkState: {
        daysSinceStart: 0,
        lastGrowthTimestamp: null,
        verificationPeriod: 3,
        foundersVerified: false,
        founderPairs: null,
        growthClickCount: 0
    },
    currentlyDisplayedNodeId: null,
    networkHistory: [],
    linkElements: null,
    nodeElements: null,
    labelGroup: null,
    labelElements: null
};

// Network visualization configuration
const config = {
    // Network layout
    width: window.innerWidth,
    height: window.innerHeight,
    padding: 100,
    founderRadius: null,
    founderCount: 8,
    minFounders: 2,
    maxFounders: 12,
    
    // Node spacing
    nodeSpacing: {
        familyBuffer: 50,
        siblingDistance: 80
    },
    
    // Node styling
    nodeRadius: {
        founder: 20,
        grandparent: 15,
        parent: 12,
        child: 10
    },
    nodeColors: {
        founder: '#FFD700',
        grandparent: '#800080',
        parent: '#4169E1',
        child: '#32CD32',
        full: '#00FF00'
    },
    
    // Link styling
    linkStrength: {
        family: 0.7,
        sibling: 0.3,
        founder: 1.0
    },
    linkDistance: {
        family: 100,
        sibling: 60,
        founder: null
    },
    
    // Force simulation
    charge: {
        strength: -2000,
        distanceMax: 1000
    },
    
    // Animation
    transitionDuration: 750,
    
    // Debug
    debug: true,
    
    // Notifications
    notifications: {
        duration: 3000,
        position: {
            x: 20,
            y: 20
        }
    }
};

// Debug logging function
function debugLog(...args) {
    if (config.debug && console && console.log) {
        console.log('[Network Viz]', ...args);
    }
}

// Helper function to generate DIDs
function generatePersonalDID(nodeId) {
    return `did:poh:${nodeId}:${Date.now().toString(36)}`;
}

function generateFamilyUnitDID(verifierId, parentId, childrenIds) {
    const members = [verifierId, parentId, ...childrenIds].sort((a, b) => a - b);
    return `did:poh:family:${members.join('-')}:${Date.now().toString(36)}`;
}

// Helper function to calculate viewport dimensions
function calculateViewport() {
    const container = document.getElementById('network-container');
    if (!container) throw new Error('Network container not found');
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    return {
        width,
        height,
        centerX: width / 2,
        centerY: height / 2
    };
}

// Initialize zoom behavior
const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
        globals.container.attr('transform', event.transform);
    });

// Initialize drag behavior
const drag = d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);

function dragstarted(event, d) {
    if (!event.active) globals.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragended(event, d) {
    if (!event.active) globals.simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

// Tick function for simulation
function ticked() {
    if (!globals.linkElements || !globals.nodeElements || !globals.labelElements) return;
    
    globals.linkElements
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
        
    globals.nodeElements
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
        
    globals.labelElements
        .attr('x', d => d.x)
        .attr('y', d => d.y);
}

// Node states and DID management
const nodeStates = {
    child: {
        type: 'child',
        color: '#32CD32',  // Green
        canInvite: false,
        maxChildren: 0,
        requiredPersonalDIDs: 0,
        requiredFamilyDIDs: 0
    },
    verifiedChild: {
        type: 'child',
        color: '#32CD32',  // Green
        canInvite: false,
        maxChildren: 0,
        requiredPersonalDIDs: 1,
        requiredFamilyDIDs: 1
    },
    parent: {
        type: 'parent',
        color: '#4169E1',  // Blue
        canInvite: true,
        maxChildren: 3,
        requiredPersonalDIDs: 1,
        requiredFamilyDIDs: 1
    },
    grandparent: {
        type: 'grandparent',
        color: '#800080',  // Purple
        canInvite: false,
        maxChildren: 3,
        requiredPersonalDIDs: 1,
        requiredFamilyDIDs: 2
    },
    founder: {
        type: 'founder',
        color: '#FFD700',  // Gold
        canInvite: true,
        maxChildren: 3,
        requiredPersonalDIDs: 1,
        requiredFamilyDIDs: 5
    }
};

// Node verification and progression logic
function verifyHumanity(nodes) {
    debugLog('Verifying humanity for nodes:', nodes.map(n => n.id));
    
    try {
        // Check if this is founder verification
        const isFounderVerification = nodes.every(n => n.generation === 0);
        
        if (isFounderVerification) {
            debugLog('Processing founder group verification');
            // All founders must be present
            const founderCount = globals.nodes.filter(n => n.generation === 0).length;
            if (nodes.length !== founderCount) {
                throw new Error(`All founders (${founderCount}) must verify together`);
            }
            
            // Verify all founders together
            nodes.forEach(founder => {
                founder.type = 'parent'; // Promote from child to parent
                founder.personalDIDs = 1;
                founder.familyDIDs = 1;
                founder.verifiedBy = nodes.filter(n => n.id !== founder.id).map(n => n.id);
                updateNodeAppearance(founder); // Update appearance immediately
            });
            
            // Create verification links between all founders
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    globals.links.push({
                        source: nodes[i],
                        target: nodes[j],
                        isFounderLink: true,
                        distance: config.linkDistance.founder || 200
                    });
                }
            }
            
            globals.networkState.foundersVerified = true;
            debugLog('Founder group verification successful');
            return true;
        }
        
        // Check if this is a family unit verification
        if (nodes.length === 5) {
            const grandparent = nodes.find(n => n.type === 'grandparent');
            const parent = nodes.find(n => n.type === 'parent');
            const children = nodes.filter(n => n.type === 'child');
            
            if (!grandparent || !parent || children.length !== 3) {
                throw new Error('Family unit requires 1 grandparent, 1 parent, and 3 children');
            }
            
            // Generate family unit ID
            const familyUnitId = `${grandparent.id}-${parent.id}-${children.map(c => c.id).sort().join('-')}`;
            
            // Check if this family unit already exists
            if (grandparent.familyUnits?.includes(familyUnitId)) {
                throw new Error('This family unit has already been verified');
            }
            
            // Initialize family unit arrays if needed
            [grandparent, parent, ...children].forEach(node => {
                if (!node.familyUnits) node.familyUnits = [];
                node.familyUnits.push(familyUnitId);
                node.familyDIDs = (node.familyDIDs || 0) + 1;
            });
            
            // Create family unit links
            children.forEach(child => {
                globals.links.push({
                    source: parent,
                    target: child,
                    isFamilyLink: true,
                    distance: config.linkDistance.family
                });
            });
            
            globals.links.push({
                source: grandparent,
                target: parent,
                isFamilyLink: true,
                distance: config.linkDistance.family
            });
            
            debugLog('Family unit verification successful');
            return true;
        }
        
        throw new Error('Invalid verification group. Must be either all founders or a family unit (1 grandparent, 1 parent, 3 children)');
        
    } catch (error) {
        debugLog('Error verifying humanity:', error);
        throw error;
    }
}

function verifyFamilyUnit(grandparent, parent, children) {
    debugLog('Verifying family unit');
    
    try {
        // Validate node types
        if (grandparent.type !== 'grandparent') throw new Error('Invalid grandparent type');
        if (parent.type !== 'parent') throw new Error('Invalid parent type');
        if (!children.every(child => child.type === 'child')) {
            throw new Error('Invalid child type in family unit');
        }
        
        // Check if this family unit already exists
        const familyUnitId = `${grandparent.id}-${parent.id}-${children.map(c => c.id).sort().join('-')}`;
        if (grandparent.familyUnits?.includes(familyUnitId)) {
            throw new Error('This family unit has already been verified');
        }
        
        // Initialize family unit arrays
        if (!grandparent.familyUnits) grandparent.familyUnits = [];
        if (!parent.familyUnits) parent.familyUnits = [];
        children.forEach(child => {
            if (!child.familyUnits) child.familyUnits = [];
        });
        
        // Record family unit for all participants
        [grandparent, parent, ...children].forEach(node => {
            node.familyUnits.push(familyUnitId);
            // Add family DID for each family unit participation
            node.familyDIDs = (node.familyDIDs || 0) + 1;
        });
        
        debugLog('Family unit verification successful');
        return true;
    } catch (error) {
        debugLog('Error verifying family unit:', error);
        throw error;
    }
}

function checkNodeProgression(node) {
    debugLog(`Checking progression for node ${node.id}`);
    
    try {
        const personalDIDs = node.personalDIDs || 0;
        const familyDIDs = node.familyDIDs || 0;
        const totalDIDs = personalDIDs + familyDIDs;
        
        // Parent to Grandparent progression
        if (node.type === 'parent' && 
            node.children?.length >= 3 && 
            familyDIDs >= 2) {
            node.type = 'grandparent';
            debugLog(`Node ${node.id} progressed to grandparent`);
        }
        
        // Grandparent to Full Node progression
        else if (node.type === 'grandparent' && totalDIDs >= 6) {
            node.type = 'full';
            debugLog(`Node ${node.id} progressed to full node`);
        }
        
        // Update node appearance
        updateNodeAppearance(node);
        
    } catch (error) {
        debugLog('Error checking node progression:', error);
        throw error;
    }
}

function updateNodeAppearance(node) {
    debugLog(`Updating appearance for node ${node.id} to type ${node.type}`);
    
    try {
        // Get the expected color for this node type
        const expectedColor = config.nodeColors[node.type];
        
        // Update node color based on type
        const nodeElement = globals.nodeGroup.select(`circle[data-id="${node.id}"]`);
        if (nodeElement.empty()) {
            debugLog(`WARNING: Could not find node element for ${node.id}`);
            return;
        }
        
        nodeElement
            .transition()
            .duration(500)
            .style('fill', expectedColor)
            .attr('r', config.nodeRadius[node.type]);
            
        // Update node label if needed
        const labelElement = globals.labelGroup.select(`text[data-id="${node.id}"]`);
        labelElement.text(node.id);
        
        // Verify the color was applied
        // Note: This will get the pre-transition color since transitions are asynchronous
        // But it's still useful for debugging
        const currentColor = nodeElement.style('fill');
        if (currentColor && currentColor !== expectedColor) {
            debugLog(`Node ${node.id} color transition: ${currentColor} -> ${expectedColor}`);
        }
        
        debugLog(`Node ${node.id} appearance updated to ${node.type}`);
    } catch (error) {
        debugLog('Error updating node appearance:', error);
    }
}

function resetNetwork() {
    debugLog('Resetting network...');
    
    try {
        // Reset click counter
        globals.networkState.growthClickCount = 0;
        const clickCountDisplay = document.getElementById('click-counter');
        if (clickCountDisplay) {
            clickCountDisplay.textContent = 'Click Count: 0';
        }

        // Get founder count from slider
        const founderSlider = document.getElementById('founder-count');
        const founderCount = founderSlider ? parseInt(founderSlider.value) : 8;
        
        // Clear existing network
        globals.nodes = [];
        globals.links = [];
        globals.nodeCounter = 0;
        
        // Create founder nodes in a perfect polygon
        const radius = Math.min(config.width, config.height) * 0.3;
        
        // Create nodes in a circle
        for (let i = 0; i < founderCount; i++) {
            const angle = (i / founderCount) * 2 * Math.PI - Math.PI/2;
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            
            globals.nodes.push({
                id: `C${++globals.nodeCounter}`,
                type: 'child',
                generation: 0,
                x: x,
                y: y,
                personalDIDs: 0,
                familyDIDs: 0,
                children: []
            });
        }
        
        // Create links between adjacent nodes
        for (let i = 0; i < globals.nodes.length; i++) {
            const nextIndex = (i + 1) % globals.nodes.length;
            globals.links.push({
                source: globals.nodes[i],
                target: globals.nodes[nextIndex],
                distance: radius * Math.sin(Math.PI / founderCount) * 2,
                isFounderLink: true,
                strength: 1.0
            });
        }
        
        // Initialize force simulation
        globals.simulation = d3.forceSimulation(globals.nodes)
            .force('link', d3.forceLink(globals.links)
                .id(d => d.id)
                .distance(d => d.isFounderLink ? d.distance : config.linkDistance.family)
                .strength(d => d.isFounderLink ? 1.0 : 0.3))
            .force('charge', d3.forceManyBody()
                .strength(-3000)
                .distanceMax(2000))
            .force('collision', d3.forceCollide()
                .radius(d => (config.nodeRadius[d.type] || 10) * 3)
                .strength(1))
            .force('center', d3.forceCenter(0, 0)
                .strength(0.5))
            .velocityDecay(0.6)
            .on('tick', ticked);
        
        // Update visualization
        updateNetwork();
        centerNetwork();
        
        debugLog('Network reset complete');
    } catch (error) {
        debugLog('Error resetting network:', error);
        throw error;
    }
}

function growNetwork() {
    debugLog('Growing network...');
    // Save previous state before incrementing click count
    const previousClickCount = globals.networkState.growthClickCount;
    globals.networkState.growthClickCount++;
    
    // Update click counter display
    const clickCountDisplay = document.getElementById('click-counter');
    if (clickCountDisplay) {
        clickCountDisplay.textContent = `Click Count: ${globals.networkState.growthClickCount}`;
    }
    
    try {
        // Enhanced logging at the start of each grow operation
        const founderCountBefore = globals.nodes.filter(n => n.generation === 0).length;
        const founderTypesBefore = globals.nodes
            .filter(n => n.generation === 0)
            .map(n => n.type);
        
        debugLog(`GROW START - Click ${globals.networkState.growthClickCount}`);
        debugLog(`Initial state: Found ${founderCountBefore} founders with types: ${founderTypesBefore.join(', ')}`);
        
        // First click: Convert all founders to parents (blue) and give them children
        if (globals.networkState.growthClickCount === 1) {
            const founders = globals.nodes.filter(n => n.generation === 0);
            debugLog(`Click 1: Found ${founders.length} generation 0 nodes to convert to parents`);
            
            founders.forEach(founder => {
                const oldType = founder.type;
                founder.type = 'parent';
                founder.personalDIDs = 1;
                founder.familyDIDs = 1;
                
                // Give each founder 3 children
                for (let i = 0; i < 3; i++) {
                    const pos = calculateNewPosition(founder, i, 3);
                    const child = {
                        id: `C${++globals.nodeCounter}`,
                        type: 'child',
                        generation: founder.generation + 1,
                        x: pos.x,
                        y: pos.y,
                        personalDIDs: 0,
                        familyDIDs: 0,
                        children: []
                    };
                    globals.nodes.push(child);
                    founder.children.push(child.id);
                    
                    globals.links.push({
                        source: founder,
                        target: child,
                        distance: config.linkDistance.family,
                        isFamilyLink: true
                    });
                }
                updateNodeAppearance(founder);
                debugLog(`Changed founder ${founder.id} from ${oldType} to ${founder.type}`);
            });
            debugLog('Click 1: Converted founders to parents (blue) and gave them children');
        }
        // Second click: Convert children to parents and give them children, AND promote founders to grandparents
        else if (globals.networkState.growthClickCount === 2) {
            // First convert first generation children to parents
            const gen1Children = globals.nodes.filter(n => n.type === 'child' && n.generation === 1);
            debugLog(`Click 2: Found ${gen1Children.length} generation 1 children to convert to parents`);
            
            gen1Children.forEach(child => {
                const oldType = child.type;
                child.type = 'parent';
                child.personalDIDs = 1;
                child.familyDIDs = 1;
                
                // Give each new parent 3 children
                for (let i = 0; i < 3; i++) {
                    const pos = calculateNewPosition(child, i, 3);
                    const newChild = {
                        id: `C${++globals.nodeCounter}`,
                        type: 'child',
                        generation: child.generation + 1,
                        x: pos.x,
                        y: pos.y,
                        personalDIDs: 0,
                        familyDIDs: 0,
                        children: []
                    };
                    globals.nodes.push(newChild);
                    if (!child.children) child.children = [];
                    child.children.push(newChild.id);
                    
                    globals.links.push({
                        source: child,
                        target: newChild,
                        distance: config.linkDistance.family,
                        isFamilyLink: true
                    });
                }
                updateNodeAppearance(child);
                debugLog(`Changed child ${child.id} from ${oldType} to ${child.type}`);
            });

            // Now promote founders to grandparents
            const founders = globals.nodes.filter(n => n.generation === 0);
            debugLog(`Click 2: Found ${founders.length} generation 0 nodes to promote to grandparents`);
            
            founders.forEach(founder => {
                const oldType = founder.type;
                founder.type = 'grandparent';
                founder.familyDIDs = 2;
                updateNodeAppearance(founder);
                debugLog(`Changed founder ${founder.id} from ${oldType} to ${founder.type}`);
            });
            
            // Verify founders are now grandparents
            const foundersAfter = globals.nodes.filter(n => n.generation === 0);
            const founderTypesAfter = foundersAfter.map(n => n.type);
            debugLog(`Click 2 VERIFY: Founders are now types: ${founderTypesAfter.join(', ')}`);
            
            debugLog('Click 2: Converted children to parents, gave them children, and promoted founders to grandparents (purple)');
            
            // Ensure founders are all correctly processed
            const allFounders = globals.nodes.filter(n => n.generation === 0);
            allFounders.forEach(founder => {
                if (founder.type !== 'grandparent') {
                    debugLog(`Ensuring founder ${founder.id} is set to grandparent (was ${founder.type})`);
                    founder.type = 'grandparent';
                    founder.familyDIDs = 2;
                    updateNodeAppearance(founder);
                }
            });
        }
        // Third click: Convert generation 2 children to parents, keep generation 1 as parents, promote founders to gold
        else if (globals.networkState.growthClickCount === 3) {
            // Only convert generation 2 children to parents
            const gen2Children = globals.nodes.filter(n => n.type === 'child' && n.generation === 2);
            debugLog(`Click 3: Found ${gen2Children.length} generation 2 children to convert to parents`);
            
            gen2Children.forEach(child => {
                const oldType = child.type;
                child.type = 'parent';
                child.personalDIDs = 1;
                child.familyDIDs = 1;
                
                // Give each new parent 3 children
                for (let i = 0; i < 3; i++) {
                    const pos = calculateNewPosition(child, i, 3);
                    const newChild = {
                        id: `C${++globals.nodeCounter}`,
                        type: 'child',
                        generation: child.generation + 1,
                        x: pos.x,
                        y: pos.y,
                        personalDIDs: 0,
                        familyDIDs: 0,
                        children: []
                    };
                    globals.nodes.push(newChild);
                    if (!child.children) child.children = [];
                    child.children.push(newChild.id);
                    
                    globals.links.push({
                        source: child,
                        target: newChild,
                        distance: config.linkDistance.family,
                        isFamilyLink: true
                    });
                }
                updateNodeAppearance(child);
                debugLog(`Changed child ${child.id} from ${oldType} to ${child.type}`);
            });

            // Now ONLY promote generation 1 parents to grandparents, don't promote newer parents
            const gen1Parents = globals.nodes.filter(n => n.type === 'parent' && n.generation === 1);
            debugLog(`Click 3: Found ${gen1Parents.length} generation 1 parents to promote to grandparents`);
            
            gen1Parents.forEach(parent => {
                const oldType = parent.type;
                parent.type = 'grandparent';
                parent.familyDIDs = 2;
                updateNodeAppearance(parent);
                debugLog(`Changed parent ${parent.id} from ${oldType} to ${parent.type}`);
            });

            // Finally, promote founders to gold
            const founders = globals.nodes.filter(n => n.generation === 0);
            debugLog(`Click 3: Found ${founders.length} generation 0 nodes to promote to gold`);
            
            founders.forEach(founder => {
                const oldType = founder.type;
                // Force the type change regardless of prior state
                founder.type = 'founder';  
                founder.familyDIDs = 5;
                updateNodeAppearance(founder);
                debugLog(`Changed founder ${founder.id} from ${oldType} to ${founder.type} (gold)`);
            });
            
            // Verify founders are now gold
            const foundersAfter = globals.nodes.filter(n => n.generation === 0);
            const founderTypesAfter = foundersAfter.map(n => n.type);
            debugLog(`Click 3 VERIFY: Founders are now types: ${founderTypesAfter.join(', ')}`);
        }
        // Fourth click and beyond: Continue the pattern with generation-based promotion
        else if (globals.networkState.growthClickCount >= 4) {
            // Get the current max generation
            const maxGen = Math.max(...globals.nodes.map(n => n.generation));
            
            // Only convert the latest generation of children to parents
            const latestChildren = globals.nodes.filter(n => n.type === 'child' && n.generation === maxGen);
            debugLog(`Click ${globals.networkState.growthClickCount}: Converting ${latestChildren.length} latest generation children to parents`);
            
            latestChildren.forEach(child => {
                const oldType = child.type;
                child.type = 'parent';
                child.personalDIDs = 1;
                child.familyDIDs = 1;
                
                // Give each new parent 3 children
                for (let i = 0; i < 3; i++) {
                    const pos = calculateNewPosition(child, i, 3);
                    const newChild = {
                        id: `C${++globals.nodeCounter}`,
                        type: 'child',
                        generation: child.generation + 1,
                        x: pos.x,
                        y: pos.y,
                        personalDIDs: 0,
                        familyDIDs: 0,
                        children: []
                    };
                    globals.nodes.push(newChild);
                    if (!child.children) child.children = [];
                    child.children.push(newChild.id);
                    
                    globals.links.push({
                        source: child,
                        target: newChild,
                        distance: config.linkDistance.family,
                        isFamilyLink: true
                    });
                }
                updateNodeAppearance(child);
                debugLog(`Changed child ${child.id} from ${oldType} to ${child.type}`);
            });

            // Only promote parents from generation (maxGen-2) to grandparents
            // This ensures parents stay as parents for one full generation cycle
            const parentsToPromote = globals.nodes.filter(n => n.type === 'parent' && n.generation === (maxGen-2));
            debugLog(`Click ${globals.networkState.growthClickCount}: Promoting ${parentsToPromote.length} parents from generation ${maxGen-2} to grandparents`);
            
            parentsToPromote.forEach(parent => {
                // Only promote if they have the required number of children
                if (parent.children && parent.children.length >= 3) {
                    const oldType = parent.type;
                    parent.type = 'grandparent';
                    parent.familyDIDs = 2;
                    updateNodeAppearance(parent);
                    debugLog(`Changed parent ${parent.id} from ${oldType} to ${parent.type}`);
                }
            });

            // Check if any grandparents should be promoted to founders (gold)
            // Only look at grandparents that have been in that state for at least one generation
            const grandparentsToCheck = globals.nodes.filter(n => n.type === 'grandparent' && n.generation <= (maxGen-3));
            
            grandparentsToCheck.forEach(grandparent => {
                // Get all direct children of this grandparent
                const children = globals.nodes.filter(n => grandparent.children && grandparent.children.includes(n.id));
                
                // Check if ALL children are parents/grandparents and have their own complete set of children
                const allChildrenAreCompleteParents = children.every(child => 
                    (child.type === 'parent' || child.type === 'grandparent') && 
                    child.children && 
                    child.children.length >= 3
                );
                
                // Only promote to gold if all children are complete parents
                if (allChildrenAreCompleteParents) {
                    grandparent.type = 'founder';
                    grandparent.familyDIDs = 5;
                    updateNodeAppearance(grandparent);
                }
            });
            debugLog(`Click ${globals.networkState.growthClickCount}: Continued progression pattern`);
        }

        // Special check for click count issues
        if (globals.networkState.growthClickCount === 2) {
            // We already added this check
        } else if (globals.networkState.growthClickCount === 3) {
            // Verify that founders are properly set as gold
            const founderCheck = globals.nodes.filter(n => n.generation === 0);
            const nonGoldFounders = founderCheck.filter(f => f.type !== 'founder');
            
            if (nonGoldFounders.length > 0) {
                debugLog(`WARNING: Found ${nonGoldFounders.length} founders that are not gold at click 3!`);
                
                nonGoldFounders.forEach(founder => {
                    debugLog(`Fixing founder ${founder.id} from ${founder.type} to gold`);
                    founder.type = 'founder';
                    founder.familyDIDs = 5;
                    
                    // Update directly in the DOM
                    const founderElement = globals.nodeGroup.select(`circle[data-id="${founder.id}"]`);
                    if (!founderElement.empty()) {
                        founderElement
                            .transition()
                            .duration(500)
                            .style('fill', config.nodeColors.founder)
                            .attr('r', config.nodeRadius.founder);
                    }
                });
            }
        }

        // Add additional logging for node types by generation
        const typesByGeneration = {};
        globals.nodes.forEach(node => {
            if (!typesByGeneration[node.generation]) {
                typesByGeneration[node.generation] = { founder: 0, grandparent: 0, parent: 0, child: 0 };
            }
            typesByGeneration[node.generation][node.type]++;
        });
        
        debugLog('Node types by generation:');
        Object.keys(typesByGeneration).sort((a, b) => a - b).forEach(gen => {
            const stats = typesByGeneration[gen];
            debugLog(`Generation ${gen}: F:${stats.founder} G:${stats.grandparent} P:${stats.parent} C:${stats.child}`);
        });
        
        // ADDED: After processing, verify node counts by type for debugging
        const typeStats = {
            founder: globals.nodes.filter(n => n.type === 'founder').length,
            grandparent: globals.nodes.filter(n => n.type === 'grandparent').length,
            parent: globals.nodes.filter(n => n.type === 'parent').length,
            child: globals.nodes.filter(n => n.type === 'child').length
        };
        
        debugLog(`GROW END - Current node types: F:${typeStats.founder} G:${typeStats.grandparent} P:${typeStats.parent} C:${typeStats.child}`);
        
        // Update simulation
        globals.simulation.nodes(globals.nodes);
        globals.simulation.force('link').links(globals.links);
        globals.simulation.alpha(1).restart();
        
        // Update network visualization
        updateNetwork();
        
        debugLog('Network growth complete');
    } catch (error) {
        debugLog('Error growing network:', error);
        showNotification('Error growing network: ' + error.message, 'error');
    }
}

// Initialize visualization
function initializeVisualization() {
    debugLog('Initializing visualization...');
    
    try {
        // Add click counter display
        const clickCounter = document.createElement('div');
        clickCounter.id = 'click-counter';
        clickCounter.textContent = 'Click Count: 0';
        clickCounter.style.backgroundColor = '#1a1b26';
        clickCounter.style.color = '#fff';
        clickCounter.style.padding = '10px';
        clickCounter.style.borderRadius = '5px';
        clickCounter.style.position = 'fixed';
        clickCounter.style.top = '20px';
        clickCounter.style.right = '20px';
        clickCounter.style.zIndex = '1000';
        clickCounter.style.fontSize = '16px';
        clickCounter.style.fontWeight = 'bold';
        document.body.appendChild(clickCounter);
        
        // Add tooltip div if it doesn't exist
        if (!document.querySelector('.tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.style.position = 'absolute';
            tooltip.style.visibility = 'hidden';
            tooltip.style.backgroundColor = 'rgba(26, 27, 38, 0.95)';
            tooltip.style.color = '#fff';
            tooltip.style.padding = '15px';
            tooltip.style.borderRadius = '8px';
            tooltip.style.fontSize = '14px';
            tooltip.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
            tooltip.style.zIndex = '1000';
            tooltip.style.maxWidth = '300px';
            tooltip.style.lineHeight = '1.5';
            tooltip.style.border = '1px solid rgba(255,255,255,0.2)';
            document.body.appendChild(tooltip);
        }
        
        const viewport = calculateViewport();
        const networkContainer = document.getElementById('network');
        if (!networkContainer) {
            throw new Error('Network container not found!');
        }
        
        // Clear any existing content
        networkContainer.innerHTML = '';
        
        // Create SVG with viewport dimensions
        globals.svg = d3.select('#network')
            .append('svg')
            .attr('width', viewport.width)
            .attr('height', viewport.height)
            .style('background-color', '#1a1b26')
            .call(zoom);
            
        // Create container group for zoom/pan
        globals.container = globals.svg.append('g')
            .attr('class', 'container')
            .attr('transform', `translate(${viewport.centerX}, ${viewport.centerY})`);
            
        // Create groups for links and nodes
        globals.linkGroup = globals.container.append('g')
            .attr('class', 'links')
            .style('stroke', 'rgba(255, 255, 255, 0.2)')
            .style('stroke-width', '1px');
            
        globals.nodeGroup = globals.container.append('g')
            .attr('class', 'nodes');
            
        globals.labelGroup = globals.container.append('g')
            .attr('class', 'labels');
            
        // Initialize simulation
        globals.simulation = d3.forceSimulation()
            .force('link', d3.forceLink()
                .id(d => d.id)
                .distance(d => d.distance || config.linkDistance.family)
                .strength(d => d.isFounderLink ? config.linkStrength.founder : config.linkStrength.family))
            .force('charge', d3.forceManyBody()
                .strength(config.charge.strength)
                .distanceMax(config.charge.distanceMax))
            .force('collision', d3.forceCollide()
                .radius(d => (config.nodeRadius[d.type] || config.nodeRadius.child) * 2)
                .strength(0.8))
            .force('center', d3.forceCenter(0, 0))
            .velocityDecay(0.4)
            .on('tick', ticked);
            
        // Create initial network
        resetNetwork();
        
        // Initialize UI controls
        initializeControls();
        
        // Add window resize handler
        window.addEventListener('resize', () => {
            const newViewport = calculateViewport();
            config.width = newViewport.width;
            config.height = newViewport.height;
            globals.svg
                .attr('width', newViewport.width)
                .attr('height', newViewport.height);
            centerNetwork();
        });
        
        // Add event listener for founder count slider
        const founderSlider = document.getElementById('founder-count');
        const founderValue = document.getElementById('founder-value');
        
        if (founderSlider && founderValue) {
            founderSlider.addEventListener('input', (e) => {
                const count = e.target.value;
                founderValue.textContent = `${count} founder${count > 1 ? 's' : ''}`;
                resetNetwork(); // Reset network whenever slider changes
            });
        }
        
        debugLog('Visualization initialized successfully');
    } catch (error) {
        debugLog('Error initializing visualization:', error);
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '20px';
        errorDiv.textContent = `Error initializing visualization: ${error.message}`;
        document.getElementById('network').appendChild(errorDiv);
    }
}

// Initialize controls
function initializeControls() {
    debugLog('Initializing controls...');
    
    try {
        // Grow button
        const growBtn = document.getElementById('grow-btn');
        if (growBtn) {
            growBtn.addEventListener('click', () => {
                debugLog('Grow button clicked');
                growNetwork();
            });
        }
        
        // Reset button
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                debugLog('Reset button clicked');
                resetNetwork();
                centerNetwork();
            });
        }
        
        // Center button
        const centerBtn = document.getElementById('center-btn');
        if (centerBtn) {
            centerBtn.addEventListener('click', () => {
                debugLog('Center button clicked');
                centerNetwork();
            });
        }
        
        // Back button
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                debugLog('Back button clicked');
                restorePreviousState();
            });
            backBtn.disabled = true;
        }
        
        // Zoom controls
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const zoomResetBtn = document.getElementById('zoom-reset');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                debugLog('Zoom in clicked');
                globals.svg.transition().call(zoom.scaleBy, 1.5);
            });
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                debugLog('Zoom out clicked');
                globals.svg.transition().call(zoom.scaleBy, 0.75);
            });
        }
        
        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', () => {
                debugLog('Zoom reset clicked');
                centerNetwork();
            });
        }
        
        // Auto-grow toggle
        const autoGrowToggle = document.getElementById('auto-grow');
        const inviteFrequencySlider = document.getElementById('invite-frequency');
        const inviteValue = document.getElementById('invite-value');
        
        if (autoGrowToggle && inviteFrequencySlider && inviteValue) {
            autoGrowToggle.addEventListener('change', (e) => {
                debugLog('Auto-grow toggled:', e.target.checked);
                if (e.target.checked) {
                    globals.networkState.verificationPeriod = parseInt(inviteFrequencySlider.value);
                    globals.autoGrowInterval = setInterval(growNetwork, globals.networkState.verificationPeriod * 1000);
                } else {
                    clearInterval(globals.autoGrowInterval);
                }
            });
            
            inviteFrequencySlider.addEventListener('input', (e) => {
                const days = parseInt(e.target.value);
                inviteValue.textContent = `${days} day${days > 1 ? 's' : ''}`;
                globals.networkState.verificationPeriod = days;
                
                if (autoGrowToggle.checked) {
                    clearInterval(globals.autoGrowInterval);
                    globals.autoGrowInterval = setInterval(growNetwork, days * 1000);
                }
            });
        }
        
        // Verify button
        const verifyBtn = document.getElementById('verify-btn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => {
                debugLog('Verify button clicked');
                handleVerification();
            });
        }
        
        debugLog('Controls initialized successfully');
    } catch (error) {
        debugLog('Error initializing controls:', error);
    }
}

// Wait for DOM and D3 to be ready
function checkD3AndInitialize() {
    if (typeof d3 !== 'undefined') {
        debugLog('D3.js is loaded, version:', d3.version);
        initializeVisualization();
    } else {
        debugLog('D3.js not loaded yet, retrying in 100ms...');
        setTimeout(checkD3AndInitialize, 100);
    }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkD3AndInitialize);
} else {
    checkD3AndInitialize();
}

// Selected nodes for verification
let selectedNodes = [];

function handleNodeClick(event, d) {
    debugLog('Node clicked:', d);
    
    try {
        // Toggle node selection
        const index = selectedNodes.findIndex(n => n.id === d.id);
        if (index === -1) {
            selectedNodes.push(d);
        } else {
            selectedNodes.splice(index, 1);
        }
        
        // Update node appearance
        globals.nodeGroup.selectAll('circle')
            .transition()
            .duration(200)
            .attr('r', node => selectedNodes.find(n => n.id === node.id) ? 
                config.nodeRadius[node.type] * 1.5 : config.nodeRadius[node.type])
            .style('stroke-width', node => selectedNodes.find(n => n.id === node.id) ? '3px' : '2px');
        
        // Update selected nodes display
        const selectedNodesSpan = document.getElementById('selected-nodes');
        if (selectedNodesSpan) {
            selectedNodesSpan.textContent = selectedNodes.length > 0 ? 
                selectedNodes.map(n => n.id).join(', ') : 'None';
        }
        
        // Update verification status
        updateVerificationStatus();
        
        debugLog('Node click handled');
    } catch (error) {
        debugLog('Error handling node click:', error);
    }
}

function updateVerificationStatus() {
    const statusSpan = document.getElementById('verification-status');
    if (!statusSpan) return;
    
    if (selectedNodes.length === 0) {
        statusSpan.textContent = 'Select nodes for verification';
        return;
    }
    
    // Check if all selected nodes are founders
    const allFounders = selectedNodes.every(n => n.type === 'child' && n.generation === 0);
    if (allFounders) {
        const founderCount = globals.nodes.filter(n => n.generation === 0).length;
        if (selectedNodes.length === founderCount) {
            statusSpan.textContent = 'Ready for founder group verification';
        } else {
            statusSpan.textContent = `Need all ${founderCount} founders for verification`;
        }
        return;
    }
    
    // Check if this is a potential family unit
    if (selectedNodes.length === 5) {
        const types = selectedNodes.map(n => n.type);
        if (types.filter(t => t === 'grandparent').length === 1 &&
            types.filter(t => t === 'parent').length === 1 &&
            types.filter(t => t === 'child').length === 3) {
            statusSpan.textContent = 'Ready for family unit verification';
        } else {
            statusSpan.textContent = 'Family unit requires 1 grandparent, 1 parent, and 3 children';
        }
    } else {
        statusSpan.textContent = `Selected ${selectedNodes.length} nodes. Need either all founders or a family unit (5 nodes)`;
    }
}

function handleVerification() {
    debugLog('Handling verification for selected nodes:', selectedNodes);
    
    try {
        if (selectedNodes.length === 0) {
            throw new Error('No nodes selected for verification');
        }
        
        // Attempt verification
        if (verifyHumanity(selectedNodes)) {
            // Check progression for all verified nodes
            selectedNodes.forEach(checkNodeProgression);
            showNotification('Verification successful!');
        }
        
        // Clear selection
        selectedNodes = [];
        updateVerificationStatus();
        
        // Update visualization
        updateNetwork();
        
    } catch (error) {
        debugLog('Error handling verification:', error);
        showNotification('Verification failed: ' + error.message, 'error');
    }
}

function showNodeInfo(node) {
    const nodeDetails = document.getElementById('node-details');
    nodeDetails.innerHTML = `
        <h3>Node ${node.id}</h3>
        <p>Type: ${node.type}</p>
        <p>Personal DID: ${node.did || 'Not assigned'}</p>
        <p>Family DID: ${node.familyUnit?.did || 'Not assigned'}</p>
        <p>Verifier: ${node.verifier?.id !== undefined ? `Node ${node.verifier.id}` : 'None'}</p>
        <p>Children: ${node.children?.length || 0}</p>
    `;
}

function updateNodeInfoPanel(node) {
    if (!globals.currentlyDisplayedNodeId) return;
    showNodeInfo(node);
}

function createFounderCircle() {
    debugLog('Creating founder circle...');
    
    const founderCount = parseInt(document.getElementById('founder-count')?.value || config.founderCount);
    const viewport = calculateViewport();
    const radius = Math.min(viewport.width, viewport.height) * 0.3;
    
    const founderNodes = [];
    const founderLinks = [];
    
    // Create founder nodes in a circle
    for (let i = 0; i < founderCount; i++) {
        const angle = (i / founderCount) * 2 * Math.PI;
        const node = {
            id: `C${++globals.nodeCounter}`,
            type: 'child', // Start as child type instead of parent
            generation: 0,
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle),
            children: [],
            isFounder: true, // Mark as founder for special handling
            personalDIDs: 0,
            familyDIDs: 0
        };
        founderNodes.push(node);
    }
    
    // Create circular links between founders
    for (let i = 0; i < founderCount; i++) {
        const source = founderNodes[i];
        const target = founderNodes[(i + 1) % founderCount];
        founderLinks.push({
            source: source.id,
            target: target.id,
            isFounderLink: true,
            distance: 2 * radius * Math.sin(Math.PI / founderCount)
        });
    }
    
    // Initialize DIDs for the founder circle
    initializeFounderDIDs(founderNodes);
    
    debugLog(`Created founder circle with ${founderCount} nodes`);
    return { founderNodes, founderLinks };
}

function initializeFounderDIDs(nodes) {
    if (!nodes || nodes.length === 0) return;
    
    // Create a shared founder circle DID for all founders
    const founderCircleId = `founder-circle-${Date.now()}`;
    
    nodes.forEach(node => {
        // Start with no DIDs - they should be green children initially
        node.personalDIDs = 0;
        node.familyDIDs = 0;
        node.founderCircleId = founderCircleId;
        debugLog(`Initialized founder ${node.id} as child with no DIDs`);
    });
}

function checkAndUpdateNodeType(node) {
    if (!node) return;
    
    // Initialize DIDs if not set
    if (!node.personalDIDs) node.personalDIDs = 0;
    if (!node.familyDIDs) node.familyDIDs = 0;
    
    const oldType = node.type;
    debugLog(`Checking type progression for node ${node.id} (${node.type}) - Personal DIDs: ${node.personalDIDs}, Family DIDs: ${node.familyDIDs}`);
    
    // Child -> Parent: Requires 1 Personal + 1 Family DID from verification
    if (node.type === 'child' && node.personalDIDs >= 1 && node.familyDIDs >= 1) {
        node.type = 'parent';
        debugLog(`Node ${node.id} promoted to parent with ${node.personalDIDs} Personal + ${node.familyDIDs} Family DIDs`);
    }
    
    // Parent completes family (gets 3 children) -> gets additional Family DID and becomes Grandparent
    if (node.type === 'parent' && node.children?.length >= 3) {
        node.familyDIDs += 1; // Additional Family DID for completing parent status
        node.type = 'grandparent';
        debugLog(`Node ${node.id} completed parent status and promoted to grandparent with ${node.personalDIDs} Personal + ${node.familyDIDs} Family DIDs`);
    }
    
    // Grandparent -> Founder: Track Family DIDs from children's completed families
    if (node.type === 'grandparent') {
        // Count completed families (children with 3 children each)
        const completedFamilies = node.children?.filter(childId => {
            const child = globals.nodes.find(n => n.id === childId);
            return child && child.children?.length >= 3;
        }).length || 0;
        
        // Calculate new Family DIDs (1 for each completed family)
        const currentFamilyDIDs = node.familyDIDs;
        const expectedFamilyDIDs = 2 + completedFamilies; // 2 = initial family DID + parent completion DID
        const newFamilyDIDs = Math.max(0, expectedFamilyDIDs - currentFamilyDIDs);
        
        if (newFamilyDIDs > 0) {
            node.familyDIDs = expectedFamilyDIDs;
            debugLog(`Node ${node.id} received ${newFamilyDIDs} new Family DIDs for completed families, now has ${node.familyDIDs} Family DIDs`);
        }
        
        // Check for promotion to founder (requires 1 Personal + 5 Family DIDs)
        if (node.personalDIDs >= 1 && node.familyDIDs >= 5) {
            node.type = 'founder';
            debugLog(`Node ${node.id} promoted to founder with ${node.personalDIDs} Personal + ${node.familyDIDs} Family DIDs`);
        }
    }
    
    // Update node appearance if type changed
    if (oldType !== node.type) {
        const nodeElement = globals.nodeGroup.select(`circle[data-id="${node.id}"]`);
        if (nodeElement.size() > 0) {
            nodeElement
                .transition()
                .duration(500)
                .style('fill', config.nodeColors[node.type])
                .attr('r', config.nodeRadius[node.type]);
        }
    }
}

function verifyFounders() {
    debugLog('Starting founder verification process...');
    
    try {
        // Reset founder states
        globals.nodes.forEach(node => {
            if (node.isFounder) {
                node.did = generatePersonalDID(node.id);
                node.familyUnits = [];
                node.children = [];
            }
        });
        
        // Create verification pairs
        const founders = globals.nodes.filter(n => n.isFounder);
        const pairs = [];
        
        for (let i = 0; i < founders.length; i += 2) {
            const founder1 = founders[i];
            const founder2 = founders[(i + 1) % founders.length];
            
            // Set up mutual verification
            founder1.verifier = founder2.id;
            founder2.verifier = founder1.id;
            
            pairs.push([founder1.id, founder2.id]);
        }
        
        globals.networkState.founderPairs = pairs;
        globals.networkState.foundersVerified = true;
        
        debugLog('Founder verification complete');
    } catch (error) {
        debugLog('Error verifying founders:', error);
    }
}

function calculateNewPosition(parent, index, total) {
    // Use parent's position as the center point
    const centerX = parent.x;
    const centerY = parent.y;
    const distance = 200; // Fixed distance from parent
    
    // Spread children evenly in a 120-degree arc facing outward from parent
    const spreadAngle = Math.PI / 1.5; // 120 degrees
    const startAngle = -spreadAngle / 2; // Start from the middle and spread outward
    const childAngle = startAngle + (index * spreadAngle / (total - 1));
    
    return {
        x: centerX + distance * Math.cos(childAngle),
        y: centerY + distance * Math.sin(childAngle)
    };
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

function saveNetworkState() {
    const state = {
        nodes: JSON.parse(JSON.stringify(globals.nodes)),
        links: JSON.parse(JSON.stringify(globals.links)),
        nodeCounter: globals.nodeCounter,
        networkState: JSON.parse(JSON.stringify(globals.networkState))
    };
    globals.networkHistory.push(state);
    
    // Enable back button if we have history
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.disabled = globals.networkHistory.length <= 1;
    }
}

function restorePreviousState() {
    if (globals.networkHistory.length <= 1) return; // Keep at least initial state
    
    // Remove current state
    globals.networkHistory.pop();
    // Get previous state
    const previousState = globals.networkHistory[globals.networkHistory.length - 1];
    
    // Restore the state
    globals.nodes = previousState.nodes;
    globals.links = previousState.links;
    globals.nodeCounter = previousState.nodeCounter;
    globals.networkState = previousState.networkState;
    
    // Update simulation with restored nodes and links
    globals.simulation.nodes(globals.nodes);
    globals.simulation.force('link').links(globals.links);
    
    // Update visualization
    globals.simulation.alpha(1).restart();
    updateNetwork();
    
    // Update back button state
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.disabled = globals.networkHistory.length <= 1;
    }
}

// Core network functions
function initializeNetwork() {
    debugLog('Initializing network...');
    
    // Stop any existing simulation
    if (globals.simulation) {
        globals.simulation.stop();
    }
    
    // Reset network state
    globals.nodes = [];
    globals.links = [];
    globals.nodeCounter = 0;
    globals.networkState = {
        daysSinceStart: 0,
        lastGrowthTimestamp: null,
        verificationPeriod: 3,
        foundersVerified: false,
        founderPairs: null
    };
    
    // Create founder circle
    const { founderNodes, founderLinks } = createFounderCircle();
    globals.nodes = founderNodes;
    globals.links = founderLinks;
    
    const viewport = calculateViewport();
    
    // Initialize force simulation
    globals.simulation = d3.forceSimulation(globals.nodes)
        .force('link', d3.forceLink(globals.links)
            .id(d => d.id)
            .distance(d => d.isFounderLink ? d.distance : config.linkDistance.family)
            .strength(d => d.isFounderLink ? 1.0 : 0.3))
        .force('charge', d3.forceManyBody()
            .strength(-3000) // Increased repulsion
            .distanceMax(2000))
        .force('collision', d3.forceCollide()
            .radius(d => (config.nodeRadius[d.type] || 10) * 3) // Increased collision radius
            .strength(1))
        .force('center', d3.forceCenter(0, 0)
            .strength(0.5)) // Increased centering force
        .velocityDecay(0.6) // Increased decay for more stability
        .on('tick', ticked);
        
    // Update visualization
    updateNetwork();
    centerNetwork();
    
    debugLog('Network initialized');
}

function updateNetwork() {
    debugLog('Updating network visualization...');
    
    try {
        // Debug report on node types before updating visualization
        const nodeTypes = {
            founder: globals.nodes.filter(n => n.type === 'founder').length,
            grandparent: globals.nodes.filter(n => n.type === 'grandparent').length,
            parent: globals.nodes.filter(n => n.type === 'parent').length,
            child: globals.nodes.filter(n => n.type === 'child').length
        };
        debugLog(`UPDATE: Visualizing nodes - F:${nodeTypes.founder} G:${nodeTypes.grandparent} P:${nodeTypes.parent} C:${nodeTypes.child}`);
        
        // Report on founders specifically
        const founders = globals.nodes.filter(n => n.generation === 0);
        if (founders.length > 0) {
            debugLog(`UPDATE: Founder types: ${founders.map(f => f.type).join(', ')}`);
        }
        
        // Update links
        const links = globals.linkGroup
            .selectAll('line')
            .data(globals.links, d => `${d.source.id}-${d.target.id}`);
        
        links.exit().remove();
        
        const linksEnter = links.enter()
            .append('line')
            .attr('class', 'link')
            .style('stroke', d => d.isFounderLink ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)')
            .style('stroke-width', d => d.isFounderLink ? '2px' : '1px');
        
        globals.linkElements = linksEnter.merge(links);
        
        // Update nodes
        const nodes = globals.nodeGroup
            .selectAll('circle')
            .data(globals.nodes, d => d.id);
        
        nodes.exit().remove();
        
        const nodesEnter = nodes.enter()
            .append('circle')
            .attr('class', 'node')
            .attr('data-id', d => d.id)
            .attr('r', d => config.nodeRadius[d.type])
            .style('fill', d => {
                const color = config.nodeColors[d.type];
                debugLog(`Setting node ${d.id} (type: ${d.type}) to color: ${color}`);
                return color;
            })
            .style('stroke', 'white')
            .style('stroke-width', '2px')
            .call(drag)
            .on('click', handleNodeClick)
            .on('mouseover', function(event, d) {
                const tooltip = d3.select('.tooltip');
                tooltip.html(`
                    <strong>ID:</strong> ${d.id}<br>
                    <strong>Type:</strong> ${d.type}<br>
                    <strong>Generation:</strong> ${d.generation}<br>
                    <strong>Children:</strong> ${d.children?.length || 0}<br>
                    <strong>Personal DIDs:</strong> ${d.personalDIDs || 0}<br>
                    <strong>Family DIDs:</strong> ${d.familyDIDs || 0}<br>
                    <strong>Total DIDs:</strong> ${(d.personalDIDs || 0) + (d.familyDIDs || 0)}<br>
                    <strong>Status:</strong> ${getStatusMessage(d)}
                `)
                .style('visibility', 'visible')
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select('.tooltip').style('visibility', 'hidden');
            });
        
        // Update existing nodes
        const existingNodes = nodes.transition()
            .duration(500)
            .attr('r', d => selectedNodes.find(n => n.id === d.id) ? 
                config.nodeRadius[d.type] * 1.5 : config.nodeRadius[d.type])
            .style('fill', d => {
                const color = config.nodeColors[d.type];
                // Only log changes for important nodes
                if (d.generation === 0) {
                    debugLog(`Updating founder node ${d.id} (type: ${d.type}) to color: ${color}`);
                }
                return color;
            })
            .style('stroke-width', d => selectedNodes.find(n => n.id === d.id) ? '3px' : '2px');
        
        // Merge new and existing nodes
        globals.nodeElements = nodesEnter.merge(nodes);
        
        // Update labels
        const labels = globals.labelGroup
            .selectAll('text')
            .data(globals.nodes, d => d.id);
            
        labels.exit().remove();
        
        const labelsEnter = labels.enter()
            .append('text')
            .attr('data-id', d => d.id)
            .attr('text-anchor', 'middle')
            .attr('dy', '.35em')
            .style('fill', 'white')
            .style('font-size', '10px')
            .text(d => d.id);
            
        globals.labelElements = labelsEnter.merge(labels);
        
        // Update simulation
        globals.simulation.nodes(globals.nodes);
        globals.simulation.force('link').links(globals.links);
        globals.simulation.alpha(1).restart();
        
        // Update statistics
        updateNetworkStats();
        
        // Special check for click count issues
        if (globals.networkState.growthClickCount === 2) {
            // We already added this check
        } else if (globals.networkState.growthClickCount === 3) {
            // Verify that founders are properly set as gold
            const founderCheck = globals.nodes.filter(n => n.generation === 0);
            const nonGoldFounders = founderCheck.filter(f => f.type !== 'founder');
            
            if (nonGoldFounders.length > 0) {
                debugLog(`WARNING: Found ${nonGoldFounders.length} founders that are not gold at click 3!`);
                
                nonGoldFounders.forEach(founder => {
                    debugLog(`Fixing founder ${founder.id} from ${founder.type} to gold`);
                    founder.type = 'founder';
                    founder.familyDIDs = 5;
                    
                    // Update directly in the DOM
                    const founderElement = globals.nodeGroup.select(`circle[data-id="${founder.id}"]`);
                    if (!founderElement.empty()) {
                        founderElement
                            .transition()
                            .duration(500)
                            .style('fill', config.nodeColors.founder)
                            .attr('r', config.nodeRadius.founder);
                    }
                });
            }
        }
        
        debugLog('Network visualization updated');
    } catch (error) {
        debugLog('Error updating network:', error);
    }
}

function updateNetworkStats() {
    debugLog('Updating network statistics...');
    
    try {
        // Update user count
        const userCount = document.getElementById('user-count');
        if (userCount) {
            userCount.textContent = globals.nodes.length;
        }
        
        // Update days count
        const daysCount = document.getElementById('days-count');
        if (daysCount) {
            daysCount.textContent = globals.networkState.daysSinceStart;
        }
        
        // Update network stats
        const networkStats = document.getElementById('network-stats');
        if (networkStats) {
            const stats = {
                founders: globals.nodes.filter(n => n.type === 'founder').length,
                grandparents: globals.nodes.filter(n => n.type === 'grandparent').length,
                parents: globals.nodes.filter(n => n.type === 'parent').length,
                children: globals.nodes.filter(n => n.type === 'child').length
            };
            
            networkStats.textContent = `F:${stats.founders} G:${stats.grandparents} P:${stats.parents} C:${stats.children}`;
        }
        
        // Update DID stats
        const didStats = document.getElementById('did-stats');
        if (didStats) {
            const stats = {
                personalDIDs: globals.nodes.filter(n => n.did).length,
                familyDIDs: new Set(globals.nodes.flatMap(n => n.familyUnits || [])).size
            };
            
            didStats.textContent = `Personal: ${stats.personalDIDs} Family: ${stats.familyDIDs}`;
        }
        
        debugLog('Network statistics updated');
    } catch (error) {
        debugLog('Error updating network statistics:', error);
    }
}

function centerNetwork() {
    const viewport = calculateViewport();
    globals.svg
        .transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity
            .translate(viewport.centerX, viewport.centerY)
            .scale(1));
}

let autoGrowInterval = null;

function startAutoGrow() {
    debugLog('Starting auto-grow');
    if (autoGrowInterval) {
        clearInterval(autoGrowInterval);
    }
    
    const period = globals.networkState.verificationPeriod * 1000; // Convert to milliseconds
    autoGrowInterval = setInterval(() => {
        growNetwork();
    }, period);
}

function stopAutoGrow() {
    debugLog('Stopping auto-grow');
    if (autoGrowInterval) {
        clearInterval(autoGrowInterval);
        autoGrowInterval = null;
    }
}

// Add logging functionality
function sendNetworkLogs() {
    const networkState = {
        nodes: globals.nodes.map(node => ({
            id: node.id,
            type: node.type,
            x: Math.round(node.x),
            y: Math.round(node.y),
            fx: node.fx ? Math.round(node.fx) : null,
            fy: node.fy ? Math.round(node.fy) : null,
            fixed: node.fixed,
            isFounder: node.isFounder,
            did: node.did,
            familyUnits: node.familyUnits,
            familyUnit: node.familyUnit,
            children: node.children,
            pendingVerification: node.pendingVerification,
            generation: node.generation
        })),
        links: globals.links.map(link => ({
            source: typeof link.source === 'object' ? link.source.id : link.source,
            target: typeof link.target === 'object' ? link.target.id : link.target,
            isFounderLink: link.isFounderLink,
            value: link.value,
            distance: link.distance
        })),
        config: {
            width: config.width,
            height: config.height,
            padding: config.padding,
            founderRadius: config.founderRadius,
            nodeSpacing: config.nodeSpacing,
            nodeRadius: config.nodeRadius,
            nodeColors: config.nodeColors,
            linkStrength: config.linkStrength,
            linkDistance: config.linkDistance,
            charge: config.charge
        },
        simulation: {
            alpha: globals.simulation ? globals.simulation.alpha() : null,
            forces: {
                link: globals.simulation ? globals.simulation.force('link').strength()() : null,
                charge: globals.simulation ? globals.simulation.force('charge').strength()() : null,
                collision: globals.simulation ? globals.simulation.force('collision').strength()() : null,
                center: globals.simulation ? globals.simulation.force('center').strength()() : null
            }
        },
        networkState: globals.networkState,
        viewport: calculateViewport()
    };

    const logData = JSON.stringify({
        timestamp: new Date().toISOString(),
        networkState: networkState
    }, null, 2);

    fetch('/network/viz/logs', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ log_data: logData })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            debugLog('Network logs saved:', data.log_file);
        } else {
            debugLog('Error saving network logs:', data.message);
        }
    })
    .catch(error => {
        debugLog('Error sending network logs:', error);
    });
}

// Add keyboard shortcut for manual log generation
document.addEventListener('keydown', function(event) {
    // Press Ctrl+L to generate logs
    if (event.ctrlKey && event.key === 'l') {
        sendNetworkLogs();
        debugLog('Manual log generation triggered');
    }
});

// Helper functions for zoom operations
function zoomBy(factor) {
    globals.svg.transition()
        .duration(config.transitionDuration)
        .call(zoom.scaleBy, factor);
}

function resetZoom() {
    globals.svg.transition()
        .duration(config.transitionDuration)
        .call(zoom.transform, d3.zoomIdentity);
}

function updateFamilyShapes() {
    debugLog('Updating family shapes');
    
    try {
        // Update founder shape if it exists
        const founderShape = globals.container.select('.containing-shape');
        if (founderShape.size() > 0) {
            const founders = globals.nodes.filter(n => n.generation === 0);
            const centerX = d3.mean(founders, d => d.x);
            const centerY = d3.mean(founders, d => d.y);
            const radius = Math.max(
                config.linkDistance.founder * 1.2,
                d3.max(founders, d => 
                    Math.sqrt(Math.pow(d.x - centerX, 2) + Math.pow(d.y - centerY, 2))
                ) * 1.2
            );
            
            // Create regular polygon for founders
            const points = [];
            const sides = founders.length;
            for (let i = 0; i < sides; i++) {
                const angle = (i / sides) * 2 * Math.PI - Math.PI/2;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                points.push([x, y]);
            }
            
            founderShape
                .attr('d', d3.line()(points) + 'Z')
                .style('stroke', globals.networkState.foundersVerified ? 
                    'rgba(255, 215, 0, 0.5)' : 'rgba(255, 215, 0, 0.3)')
                .style('stroke-dasharray', globals.networkState.foundersVerified ? 
                    'none' : '5,5');
        }
        
        // Update all family unit shapes
        globals.nodes.forEach(node => {
            if (node.familyUnits) {
                node.familyUnits.forEach(familyUnitId => {
                    const familyMembers = getFamilyMembers(familyUnitId);
                    if (familyMembers.length === 5) {
                        createFamilyShape(familyMembers, familyUnitId);
                    }
                });
            }
        });
    } catch (error) {
        debugLog('Error updating family shapes:', error);
    }
}


