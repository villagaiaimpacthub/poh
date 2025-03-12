/**
 * Family Tree Visualization
 * D3.js-based interactive visualization for family relationships
 */
class FamilyTreeVisualization {
    /**
     * Constructor for the Family Tree Visualization
     * @param {Object} config - Configuration object
     * @param {string} config.containerId - ID of the container element
     * @param {number} config.currentUserId - ID of the current user
     * @param {string} config.apiEndpoint - API endpoint for getting tree data
     * @param {string} config.verifyEndpoint - API endpoint for verifying relations
     * @param {string} config.removeEndpoint - API endpoint for removing relations
     * @param {string} config.defaultProfileImage - Default profile image URL
     */
    constructor(config) {
        this.containerId = config.containerId;
        this.currentUserId = config.currentUserId;
        this.apiEndpoint = config.apiEndpoint;
        this.verifyEndpoint = config.verifyEndpoint;
        this.removeEndpoint = config.removeEndpoint;
        this.defaultProfileImage = config.defaultProfileImage;

        // D3 visualization elements
        this.svg = null;
        this.simulation = null;
        this.nodesGroup = null;
        this.linksGroup = null;
        this.zoom = null;
        
        // Node and link data
        this.nodes = [];
        this.links = [];
        
        // Visualization settings
        this.width = 0;
        this.height = 0;
        this.nodeRadius = 30;
        this.linkDistance = 150;
        this.chargeStrength = -800;
        
        // State
        this.selectedNode = null;
        this.expandedNodes = new Set();
        this.highlightedNodes = new Set();
        this.isLoading = false;
        this.tooltip = d3.select('#graph-tooltip');
        
        // Node colors based on verification status
        this.nodeColors = {
            current: '#3498db',      // Current user (blue)
            verified: '#2ecc71',     // Verified (green)
            pending: '#f1c40f',      // Pending verification (yellow)
            unverified: '#e74c3c'    // Unverified (red)
        };
        
        // Initialize the visualization
        this.initialize();
    }
    
    /**
     * Initialize the visualization
     */
    initialize() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        // Set dimensions based on container
        this.width = container.clientWidth;
        this.height = container.clientHeight || 500;
        
        // Create SVG element
        this.svg = d3.select(`#${this.containerId}`)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');
        
        // Create container group for zoom behavior
        const g = this.svg.append('g')
            .attr('class', 'everything');
        
        // Create groups for links and nodes (draw links first, then nodes on top)
        this.linksGroup = g.append('g').attr('class', 'links');
        this.nodesGroup = g.append('g').attr('class', 'nodes');
        
        // Create zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 3])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        
        // Apply zoom behavior to SVG
        this.svg.call(this.zoom);
        
        // Create force simulation
        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(this.linkDistance))
            .force('charge', d3.forceManyBody().strength(this.chargeStrength))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .on('tick', () => this.ticked());
            
        // Create loading indicator
        this.loadingIndicator = d3.select(`#${this.containerId}`)
            .append('div')
            .attr('class', 'loading-indicator')
            .style('position', 'absolute')
            .style('top', '50%')
            .style('left', '50%')
            .style('transform', 'translate(-50%, -50%)')
            .style('display', 'none')
            .html('<i class="fas fa-spinner fa-spin fa-3x"></i><div class="mt-2">Loading family tree...</div>');
    }
    
    /**
     * Load data from the API
     */
    loadData() {
        this.setLoading(true);
        
        fetch(this.apiEndpoint)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Process and visualize the data
                this.processData(data);
                this.setLoading(false);
                
                // Update statistics
                if (typeof window.updateFamilyStats === 'function') {
                    window.updateFamilyStats({
                        totalCount: data.nodes.length - 1, // Exclude the current user
                        verifiedCount: data.nodes.filter(n => n.id !== this.currentUserId && n.verified).length,
                        pendingCount: data.nodes.filter(n => n.id !== this.currentUserId && !n.verified).length
                    });
                }
            })
            .catch(error => {
                console.error('Error loading family tree data:', error);
                this.setLoading(false);
                
                // Show error in visualization container
                d3.select(`#${this.containerId}`)
                    .html('<div class="error-message text-center p-5">' +
                          '<i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3rem;"></i>' +
                          '<h5>Error Loading Family Tree</h5>' +
                          '<p class="text-muted">There was a problem loading your family tree data. Please try again.</p>' +
                          '<button class="btn btn-outline-primary btn-sm retry-btn">Retry</button>' +
                          '</div>');
                          
                // Add retry button event listener
                d3.select('.retry-btn').on('click', () => this.loadData());
            });
    }
    
    /**
     * Process data and prepare for visualization
     * @param {Object} data - Data from the API
     */
    processData(data) {
        this.nodes = data.nodes || [];
        this.links = data.links || [];
        
        // Expand the current user's node by default
        const currentUserNode = this.nodes.find(n => n.id === this.currentUserId);
        if (currentUserNode) {
            this.expandedNodes.add(currentUserNode.id);
        }
        
        // Filter initially visible nodes based on expanded nodes
        const visibleNodes = this.getVisibleNodes();
        const visibleLinks = this.getVisibleLinks(visibleNodes);
        
        // Update the visualization
        this.updateVisualization(visibleNodes, visibleLinks);
    }
    
    /**
     * Get visible nodes based on expanded nodes
     * @returns {Array} Array of visible nodes
     */
    getVisibleNodes() {
        // Start with the current user's node and expanded nodes
        const visibleNodes = [];
        const expandedNodeIds = Array.from(this.expandedNodes);
        
        // Add expanded nodes
        for (const nodeId of expandedNodeIds) {
            const node = this.nodes.find(n => n.id === nodeId);
            if (node) {
                visibleNodes.push(node);
                
                // Add direct connections of expanded nodes
                const connectedLinks = this.links.filter(link => 
                    link.source === nodeId || 
                    (typeof link.source === 'object' && link.source.id === nodeId) ||
                    link.target === nodeId || 
                    (typeof link.target === 'object' && link.target.id === nodeId)
                );
                
                for (const link of connectedLinks) {
                    const connectedId = link.source === nodeId || (typeof link.source === 'object' && link.source.id === nodeId) 
                        ? (typeof link.target === 'object' ? link.target.id : link.target)
                        : (typeof link.source === 'object' ? link.source.id : link.source);
                    
                    const connectedNode = this.nodes.find(n => n.id === connectedId);
                    if (connectedNode && !visibleNodes.some(n => n.id === connectedId)) {
                        visibleNodes.push(connectedNode);
                    }
                }
            }
        }
        
        return visibleNodes;
    }
    
    /**
     * Get visible links based on visible nodes
     * @param {Array} visibleNodes - Array of visible nodes
     * @returns {Array} Array of visible links
     */
    getVisibleLinks(visibleNodes) {
        const visibleNodeIds = visibleNodes.map(n => n.id);
        return this.links.filter(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return visibleNodeIds.includes(sourceId) && visibleNodeIds.includes(targetId);
        });
    }
    
    /**
     * Update the visualization with new data
     * @param {Array} nodes - Array of visible nodes
     * @param {Array} links - Array of visible links
     */
    updateVisualization(nodes, links) {
        // Update the force simulation
        this.simulation.nodes(nodes);
        this.simulation.force('link').links(links);
        
        // Draw the links
        const link = this.linksGroup
            .selectAll('line')
            .data(links, d => `${d.source.id || d.source}-${d.target.id || d.target}`);
        
        link.exit().remove();
        
        const linkEnter = link.enter()
            .append('line')
            .attr('stroke-width', d => d.verified ? 2 : 1)
            .attr('stroke', '#999')
            .attr('stroke-dasharray', d => d.verified ? null : '5,5');
        
        this.links = linkEnter.merge(link);
        
        // Draw the nodes
        const node = this.nodesGroup
            .selectAll('.node')
            .data(nodes, d => d.id);
        
        node.exit().remove();
        
        const nodeEnter = node.enter()
            .append('g')
            .attr('class', 'node')
            .attr('id', d => `node-${d.id}`)
            .call(this.dragBehavior())
            .on('click', (event, d) => this.handleNodeClick(event, d))
            .on('mouseover', (event, d) => this.showTooltip(event, d))
            .on('mouseout', () => this.hideTooltip());
        
        // Add node circle
        nodeEnter.append('circle')
            .attr('r', this.nodeRadius)
            .attr('fill', d => this.getNodeColor(d))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
        
        // Add node image (if available)
        nodeEnter.append('clipPath')
            .attr('id', d => `clip-${d.id}`)
            .append('circle')
            .attr('r', this.nodeRadius - 4);
            
        nodeEnter.append('image')
            .attr('xlink:href', d => d.photo || this.defaultProfileImage)
            .attr('x', -this.nodeRadius + 4)
            .attr('y', -this.nodeRadius + 4)
            .attr('width', (this.nodeRadius - 4) * 2)
            .attr('height', (this.nodeRadius - 4) * 2)
            .attr('clip-path', d => `url(#clip-${d.id})`)
            .on('error', function() {
                // If image fails to load, fall back to default
                d3.select(this).attr('xlink:href', this.defaultProfileImage);
            });
        
        // Add expand/collapse button for nodes with connections
        nodeEnter.append('circle')
            .attr('class', 'expand-btn')
            .attr('r', 8)
            .attr('cx', d => this.nodeRadius * 0.7)
            .attr('cy', d => this.nodeRadius * 0.7)
            .attr('fill', '#fff')
            .attr('stroke', '#333')
            .attr('stroke-width', 1)
            .style('display', d => this.hasConnections(d) ? null : 'none')
            .on('click', (event, d) => {
                event.stopPropagation();
                this.toggleNodeExpansion(d);
            });
            
        nodeEnter.append('text')
            .attr('class', 'expand-icon')
            .attr('x', d => this.nodeRadius * 0.7)
            .attr('y', d => this.nodeRadius * 0.7)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-family', 'FontAwesome')
            .attr('font-size', '10px')
            .attr('fill', '#333')
            .style('pointer-events', 'none')
            .style('display', d => this.hasConnections(d) ? null : 'none')
            .text(d => this.expandedNodes.has(d.id) ? '\uf068' : '\uf067'); // minus/plus icon
        
        // Add node label
        nodeEnter.append('text')
            .attr('class', 'node-label')
            .attr('dy', this.nodeRadius + 15)
            .attr('text-anchor', 'middle')
            .attr('fill', '#333')
            .text(d => d.name.split(' ')[0]);
        
        this.nodes = nodeEnter.merge(node);
        
        // Update expand/collapse icons
        this.nodesGroup.selectAll('.expand-icon')
            .text(d => this.expandedNodes.has(d.id) ? '\uf068' : '\uf067');
            
        // Apply highlighting if any nodes are highlighted
        if (this.highlightedNodes.size > 0) {
            this.applyHighlighting();
        }
        
        // Restart the simulation
        this.simulation.alpha(1).restart();
    }
    
    /**
     * Get the color for a node based on its status
     * @param {Object} node - Node data
     * @returns {string} Color code
     */
    getNodeColor(node) {
        if (node.id === this.currentUserId) {
            return this.nodeColors.current;
        } else if (node.verified) {
            return this.nodeColors.verified;
        } else if (node.pending) {
            return this.nodeColors.pending;
        } else {
            return this.nodeColors.unverified;
        }
    }
    
    /**
     * Check if a node has connections
     * @param {Object} node - Node data
     * @returns {boolean} True if node has connections
     */
    hasConnections(node) {
        return this.links.some(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return sourceId === node.id || targetId === node.id;
        });
    }
    
    /**
     * Handle node click event
     * @param {Event} event - Click event
     * @param {Object} node - Node data
     */
    handleNodeClick(event, node) {
        if (node.id === this.currentUserId) return;
        
        // Show node details panel
        this.showNodeDetails(node);
    }
    
    /**
     * Show tooltip when hovering over a node
     * @param {Event} event - Mouse event
     * @param {Object} node - Node data
     */
    showTooltip(event, node) {
        this.tooltip
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
            .style('opacity', 1)
            .html(`
                <div><strong>${node.name}</strong></div>
                <div>${node.relationship || ''}</div>
                <div class="text-muted small">${node.verified ? 'Verified' : node.pending ? 'Pending' : 'Unverified'}</div>
            `);
    }
    
    /**
     * Hide tooltip
     */
    hideTooltip() {
        this.tooltip.style('opacity', 0);
    }
    
    /**
     * Show node details panel
     * @param {Object} node - Node data
     */
    showNodeDetails(node) {
        const detailsPanel = document.getElementById('node-details');
        const relationId = this.getRelationId(node.id);
        
        // Set node details
        document.getElementById('node-name').textContent = node.name;
        document.getElementById('node-email').textContent = node.email;
        document.getElementById('node-relationship').textContent = this.formatRelationship(node.relationship);
        document.getElementById('node-status').textContent = node.verified ? 'Verified' : node.pending ? 'Pending Verification' : 'Unverified';
        document.getElementById('node-added-date').textContent = this.formatDate(node.added_date);
        document.getElementById('node-verification-level').textContent = `Level ${node.verification_level || 0}`;
        
        // Set photo
        if (node.photo) {
            document.getElementById('node-photo').src = node.photo;
        } else {
            document.getElementById('node-photo').src = this.defaultProfileImage;
        }
        
        // Set relationship badge
        const relationshipBadge = document.getElementById('node-relationship-badge');
        relationshipBadge.textContent = this.formatRelationship(node.relationship);
        
        // Set verification badge
        const verificationBadge = document.getElementById('node-verification-badge');
        verificationBadge.textContent = `Level ${node.verification_level || 0}`;
        verificationBadge.className = `verification-badge verification-level-${node.verification_level || 0}`;
        
        // Set up buttons
        const verifyBtn = document.getElementById('verify-relation-btn');
        const removeBtn = document.getElementById('remove-relation-btn');
        const videoVerifyBtn = document.getElementById('video-verify-btn');
        
        // Only show verify button if the relation is not verified
        if (node.verified || !relationId) {
            verifyBtn.style.display = 'none';
        } else {
            verifyBtn.style.display = 'block';
            verifyBtn.dataset.relationId = relationId;
        }
        
        // Set up remove button
        removeBtn.dataset.relationId = relationId;
        
        // Set up video verify button
        videoVerifyBtn.dataset.userId = node.id;
        
        // Position the details panel
        const nodeElement = document.getElementById(`node-${node.id}`);
        const nodeRect = nodeElement.getBoundingClientRect();
        const containerRect = document.querySelector('.visualization-container').getBoundingClientRect();
        
        // Calculate position relative to the container
        const left = nodeRect.right - containerRect.left + 10;
        const top = nodeRect.top - containerRect.top;
        
        // Check if the panel would go off the right edge of the container
        if (left + 300 > containerRect.width) {
            // Position to the left of the node
            detailsPanel.style.left = `${nodeRect.left - containerRect.left - 310}px`;
        } else {
            // Position to the right of the node
            detailsPanel.style.left = `${left}px`;
        }
        
        detailsPanel.style.top = `${top}px`;
        detailsPanel.style.display = 'block';
        
        // Set selected node
        this.selectedNode = node;
    }
    
    /**
     * Get the relation ID between the current user and a family member
     * @param {number} familyMemberId - Family member ID
     * @returns {number|null} Relation ID or null if not found
     */
    getRelationId(familyMemberId) {
        const relation = this.links.find(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return (sourceId === this.currentUserId && targetId === familyMemberId) ||
                  (sourceId === familyMemberId && targetId === this.currentUserId);
        });
        
        return relation ? relation.id : null;
    }
    
    /**
     * Toggle node expansion
     * @param {Object} node - Node data
     */
    toggleNodeExpansion(node) {
        if (this.expandedNodes.has(node.id)) {
            this.expandedNodes.delete(node.id);
        } else {
            this.expandedNodes.add(node.id);
        }
        
        // Update the visualization with the new visible nodes
        const visibleNodes = this.getVisibleNodes();
        const visibleLinks = this.getVisibleLinks(visibleNodes);
        this.updateVisualization(visibleNodes, visibleLinks);
    }
    
    /**
     * Create drag behavior for nodes
     * @returns {d3.drag} Drag behavior
     */
    dragBehavior() {
        return d3.drag()
            .on('start', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });
    }
    
    /**
     * Update node and link positions on each simulation tick
     */
    ticked() {
        if (!this.nodes || !this.links) return;
        
        this.links
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        this.nodes
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
    }
    
    /**
     * Verify a relation
     * @param {number} relationId - Relation ID
     */
    verifyRelation(relationId) {
        if (!relationId) return;
        
        this.setLoading(true);
        
        fetch(`${this.verifyEndpoint}${relationId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken()
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to verify relation');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Update the relation in the data
                const relation = this.links.find(link => link.id === relationId);
                if (relation) {
                    relation.verified = true;
                }
                
                // If the node details panel is open for the verified relation,
                // close it since the verify button is no longer needed
                if (this.selectedNode) {
                    document.getElementById('node-details').style.display = 'none';
                    this.selectedNode = null;
                }
                
                // Reload the data to ensure consistency
                this.loadData();
            } else {
                throw new Error(data.message || 'Failed to verify relation');
            }
        })
        .catch(error => {
            console.error('Error verifying relation:', error);
            alert('Error verifying relation: ' + error.message);
            this.setLoading(false);
        });
    }
    
    /**
     * Remove a relation
     * @param {number} relationId - Relation ID
     */
    removeRelation(relationId) {
        if (!relationId) return;
        
        this.setLoading(true);
        
        fetch(`${this.removeEndpoint}${relationId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken()
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to remove relation');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Close the node details panel
                document.getElementById('node-details').style.display = 'none';
                this.selectedNode = null;
                
                // Reload the data to ensure consistency
                this.loadData();
            } else {
                throw new Error(data.message || 'Failed to remove relation');
            }
        })
        .catch(error => {
            console.error('Error removing relation:', error);
            alert('Error removing relation: ' + error.message);
            this.setLoading(false);
        });
    }
    
    /**
     * Search for nodes
     * @param {string} term - Search term
     */
    searchNodes(term) {
        if (!term) {
            // Clear highlighting
            this.highlightedNodes.clear();
            this.applyHighlighting();
            return;
        }
        
        // Find nodes matching the search term
        this.highlightedNodes.clear();
        this.nodes.data().forEach(node => {
            if (node.name.toLowerCase().includes(term) || 
                (node.email && node.email.toLowerCase().includes(term)) ||
                (node.relationship && node.relationship.toLowerCase().includes(term))) {
                this.highlightedNodes.add(node.id);
                
                // Auto-expand parent nodes to show the highlighted nodes
                this.expandToShowNode(node.id);
            }
        });
        
        // Update the visualization to show any newly expanded nodes
        const visibleNodes = this.getVisibleNodes();
        const visibleLinks = this.getVisibleLinks(visibleNodes);
        this.updateVisualization(visibleNodes, visibleLinks);
        
        // Apply highlighting
        this.applyHighlighting();
    }
    
    /**
     * Expand nodes to show a specific node
     * @param {number} nodeId - Node ID
     */
    expandToShowNode(nodeId) {
        // Find all paths from the current user to the target node
        const paths = this.findPaths(this.currentUserId, nodeId);
        
        // Expand all nodes along the path
        paths.forEach(path => {
            path.forEach(id => {
                this.expandedNodes.add(id);
            });
        });
    }
    
    /**
     * Find all paths between two nodes
     * @param {number} startId - Start node ID
     * @param {number} endId - End node ID
     * @returns {Array} Array of paths (each path is an array of node IDs)
     */
    findPaths(startId, endId) {
        const visited = new Set();
        const paths = [];
        
        const dfs = (currentId, path) => {
            visited.add(currentId);
            path.push(currentId);
            
            if (currentId === endId) {
                paths.push([...path]);
            } else {
                // Find all connections
                this.links.forEach(link => {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                    
                    if (sourceId === currentId && !visited.has(targetId)) {
                        dfs(targetId, path);
                    } else if (targetId === currentId && !visited.has(sourceId)) {
                        dfs(sourceId, path);
                    }
                });
            }
            
            // Backtrack
            path.pop();
            visited.delete(currentId);
        };
        
        dfs(startId, []);
        return paths;
    }
    
    /**
     * Apply highlighting to nodes
     */
    applyHighlighting() {
        // If no nodes are highlighted, reset all nodes to their original appearance
        if (this.highlightedNodes.size === 0) {
            this.nodesGroup.selectAll('circle')
                .attr('fill', d => this.getNodeColor(d))
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);
                
            this.nodesGroup.selectAll('.node-label')
                .attr('fill', '#333');
                
            this.linksGroup.selectAll('line')
                .attr('stroke', '#999')
                .attr('stroke-opacity', 1);
            
            return;
        }
        
        // Dim nodes and links not in the highlight set
        this.nodesGroup.selectAll('circle')
            .attr('fill', d => this.highlightedNodes.has(d.id) ? this.getNodeColor(d) : '#ddd')
            .attr('stroke', d => this.highlightedNodes.has(d.id) ? '#fff' : '#ddd')
            .attr('stroke-width', d => this.highlightedNodes.has(d.id) ? 2 : 1);
            
        this.nodesGroup.selectAll('.node-label')
            .attr('fill', d => this.highlightedNodes.has(d.id) ? '#333' : '#999');
            
        this.linksGroup.selectAll('line')
            .attr('stroke', d => {
                const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                return (this.highlightedNodes.has(sourceId) && this.highlightedNodes.has(targetId)) ? '#999' : '#ddd';
            })
            .attr('stroke-opacity', d => {
                const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                return (this.highlightedNodes.has(sourceId) && this.highlightedNodes.has(targetId)) ? 1 : 0.5;
            });
    }
    
    /**
     * Format a relationship string for display
     * @param {string} relationship - Relationship type
     * @returns {string} Formatted relationship
     */
    formatRelationship(relationship) {
        if (!relationship) return 'Unknown';
        
        const formatted = relationship.charAt(0).toUpperCase() + relationship.slice(1);
        return formatted.replace('_', ' ');
    }
    
    /**
     * Format a date string
     * @param {string} dateString - Date string
     * @returns {string} Formatted date
     */
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }
    
    /**
     * Zoom in
     */
    zoomIn() {
        this.svg.transition()
            .duration(300)
            .call(this.zoom.scaleBy, 1.3);
    }
    
    /**
     * Zoom out
     */
    zoomOut() {
        this.svg.transition()
            .duration(300)
            .call(this.zoom.scaleBy, 0.7);
    }
    
    /**
     * Reset zoom
     */
    resetZoom() {
        this.svg.transition()
            .duration(300)
            .call(this.zoom.transform, d3.zoomIdentity);
    }
    
    /**
     * Expand all nodes
     */
    expandAll() {
        this.nodes.data().forEach(node => {
            this.expandedNodes.add(node.id);
        });
        
        const visibleNodes = this.getVisibleNodes();
        const visibleLinks = this.getVisibleLinks(visibleNodes);
        this.updateVisualization(visibleNodes, visibleLinks);
    }
    
    /**
     * Collapse all nodes except the current user
     */
    collapseAll() {
        this.expandedNodes.clear();
        // Keep current user expanded
        this.expandedNodes.add(this.currentUserId);
        
        const visibleNodes = this.getVisibleNodes();
        const visibleLinks = this.getVisibleLinks(visibleNodes);
        this.updateVisualization(visibleNodes, visibleLinks);
    }
    
    /**
     * Download the visualization as SVG
     */
    downloadSVG() {
        // Create a copy of the SVG
        const svgData = this.svg.node().outerHTML;
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        // Create a download link
        const a = document.createElement('a');
        a.href = url;
        a.download = 'family_tree.svg';
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    /**
     * Set loading state
     * @param {boolean} isLoading - Whether the visualization is loading
     */
    setLoading(isLoading) {
        this.isLoading = isLoading;
        this.loadingIndicator.style('display', isLoading ? 'block' : 'none');
    }
    
    /**
     * Get CSRF token from cookie
     * @returns {string} CSRF token
     */
    getCsrfToken() {
        return document.cookie.split('; ')
            .find(row => row.startsWith('csrf_token='))
            ?.split('=')[1];
    }
}

/**
 * Family Tree Visualization and Interaction
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tabs
    initTabs();
    
    // Get family data from the template
    const familyDataElement = document.getElementById('family-data');
    const userData = JSON.parse(document.getElementById('user-data').textContent);
    
    if (familyDataElement) {
        const familyData = JSON.parse(familyDataElement.textContent);
        
        if (familyData && familyData.length > 0) {
            // Initialize tree visualization
            initFamilyTree(familyData, userData);
            
            // Initialize modals for tree nodes
            initFamilyModals(familyData);
        } else {
            // Show empty state
            document.getElementById('loading-tree').style.display = 'none';
            document.getElementById('empty-tree').style.display = 'block';
        }
    }
});

/**
 * Initialize tab functionality
 */
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to clicked button and corresponding pane
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

/**
 * Initialize family tree visualization using D3.js
 */
function initFamilyTree(familyData, userData) {
    // Convert flat family data to hierarchical format for D3
    const hierarchicalData = buildHierarchy(familyData, userData);
    
    // Set up dimensions
    const margin = {top: 20, right: 90, bottom: 30, left: 90};
    const width = document.getElementById('family-tree-visualization').offsetWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    
    // Create SVG container
    const svg = d3.select('#family-tree-visualization')
        .append('svg')
        .attr('width', width + margin.right + margin.left)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create tree layout
    const tree = d3.tree().size([height, width]);
    
    // Assign data to layout
    const root = d3.hierarchy(hierarchicalData, d => d.children);
    root.x0 = height / 2;
    root.y0 = 0;
    
    // Set up zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.5, 2])
        .on('zoom', (event) => {
            svg.attr('transform', event.transform);
        });
    
    d3.select('#family-tree-visualization svg')
        .call(zoom);
    
    // Set up zoom controls
    document.getElementById('zoom-in').addEventListener('click', function() {
        d3.select('#family-tree-visualization svg')
            .transition()
            .call(zoom.scaleBy, 1.2);
    });
    
    document.getElementById('zoom-out').addEventListener('click', function() {
        d3.select('#family-tree-visualization svg')
            .transition()
            .call(zoom.scaleBy, 0.8);
    });
    
    document.getElementById('zoom-reset').addEventListener('click', function() {
        d3.select('#family-tree-visualization svg')
            .transition()
            .call(zoom.transform, d3.zoomIdentity);
    });
    
    // Initial update
    update(root);
    
    // Hide loading indicator
    document.getElementById('loading-tree').style.display = 'none';
    
    /**
     * Update the tree visualization
     */
    function update(source) {
        // Compute the new tree layout
        const treeData = tree(root);
        
        // Get nodes and links
        const nodes = treeData.descendants();
        const links = treeData.links();
        
        // Normalize for fixed-depth
        nodes.forEach(d => {
            d.y = d.depth * 180;
        });
        
        // Update nodes
        const node = svg.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = Math.random().toString(36).substr(2, 9)));
        
        // Enter new nodes
        const nodeEnter = node.enter()
            .append('g')
            .attr('class', d => {
                let nodeClass = 'node';
                if (d.data.id === userData.id) {
                    nodeClass += ' node-you';
                } else if (d.data.is_verified) {
                    nodeClass += ' node-verified';
                } else {
                    nodeClass += ' node-pending';
                }
                return nodeClass;
            })
            .attr('transform', d => `translate(${source.y0},${source.x0})`)
            .on('click', function(event, d) {
                // Show member details in modal if not the current user
                if (d.data.id !== userData.id) {
                    showFamilyMemberModal(d.data);
                }
            });
        
        // Add Circle for the nodes
        nodeEnter.append('circle')
            .attr('r', 10)
            .attr('stroke', d => d.data.id === userData.id ? '#2980b9' : (d.data.is_verified ? '#27ae60' : '#f1c40f'));
        
        // Add labels for the nodes
        nodeEnter.append('text')
            .attr('dy', '.35em')
            .attr('x', d => d.children || d._children ? -13 : 13)
            .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
            .text(d => d.data.name.split(' ')[0]); // Just show first name to save space
        
        // Update the node attributes
        const nodeUpdate = nodeEnter.merge(node);
        
        nodeUpdate.transition()
            .duration(750)
            .attr('transform', d => `translate(${d.y},${d.x})`);
        
        // Remove any exiting nodes
        node.exit().transition()
            .duration(750)
            .attr('transform', d => `translate(${source.y},${source.x})`)
            .remove();
        
        // Update links
        const link = svg.selectAll('path.link')
            .data(links, d => d.target.id);
        
        // Enter new links
        const linkEnter = link.enter()
            .insert('path', 'g')
            .attr('class', d => {
                let linkClass = 'link';
                if (d.target.data.is_verified) {
                    linkClass += ' link-verified';
                } else {
                    linkClass += ' link-pending';
                }
                return linkClass;
            })
            .attr('d', d => {
                const o = {x: source.x0, y: source.y0};
                return diagonal(o, o);
            });
        
        // Update links
        linkEnter.merge(link)
            .transition()
            .duration(750)
            .attr('d', d => diagonal(d.source, d.target));
        
        // Remove any exiting links
        link.exit().transition()
            .duration(750)
            .attr('d', d => {
                const o = {x: source.x, y: source.y};
                return diagonal(o, o);
            })
            .remove();
        
        // Store the old positions for transition
        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }
    
    /**
     * Draw a curved path between two points
     */
    function diagonal(s, d) {
        return `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
    }
}

/**
 * Build hierarchical data structure for D3 tree
 */
function buildHierarchy(familyData, userData) {
    // Start with the current user as root
    const root = {
        id: userData.id,
        name: userData.name,
        username: userData.username,
        profile_picture: userData.profile_picture,
        is_verified: true, // User is always verified with themselves
        children: []
    };
    
    // Add direct relationships
    familyData.forEach(relation => {
        const relationNode = {
            id: relation.relative_id,
            name: `${relation.first_name} ${relation.last_name}`,
            username: relation.username,
            profile_picture: relation.profile_picture,
            relation_id: relation.id,
            relationship_type: relation.relationship_type,
            is_verified: relation.is_verified === 1,
            verification_date: relation.verification_date,
            children: []
        };
        
        root.children.push(relationNode);
    });
    
    return root;
}

/**
 * Initialize modal functionality for family members
 */
function initFamilyModals(familyData) {
    const modal = document.getElementById('family-member-modal');
    const closeButton = document.querySelector('.close-modal');
    
    // Close modal when clicking close button
    closeButton.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    // Close modal when clicking outside the modal
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

/**
 * Show modal with family member details
 */
function showFamilyMemberModal(member) {
    const modal = document.getElementById('family-member-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalDetails = document.getElementById('modal-member-details');
    const verificationActions = document.getElementById('modal-verification-actions');
    const removeActions = document.getElementById('modal-remove-actions');
    
    // Set modal title
    modalTitle.textContent = `${member.name} (${formatRelationshipType(member.relationship_type)})`;
    
    // Get template content
    const template = document.getElementById('modal-template');
    const content = template.content.cloneNode(true);
    
    // Fill template with member data
    content.getElementById('template-name').textContent = member.name;
    content.getElementById('template-relationship').textContent = formatRelationshipType(member.relationship_type);
    content.getElementById('template-username').textContent = `@${member.username}`;
    
    if (member.verification_date) {
        content.getElementById('template-verification-date').textContent = formatDate(member.verification_date);
    } else {
        content.getElementById('template-verification-date').textContent = 'Not verified yet';
    }
    
    // Set avatar
    const avatar = content.getElementById('template-avatar');
    if (member.profile_picture) {
        avatar.src = `/static/uploads/${member.profile_picture}`;
        avatar.alt = member.name;
    } else {
        // If no profile picture, create an avatar placeholder with initials
        const nameParts = member.name.split(' ');
        const initials = nameParts.length > 1 
            ? `${nameParts[0][0]}${nameParts[1][0]}` 
            : member.name[0];
            
        avatar.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%233498db"/><text x="50%" y="50%" font-size="30" text-anchor="middle" dominant-baseline="central" fill="white" font-family="sans-serif">${initials}</text></svg>`;
        avatar.alt = initials;
    }
    
    // Set verification status
    const statusElem = content.getElementById('template-status');
    if (member.is_verified) {
        statusElem.innerHTML = '<span class="status-badge verified">Verified</span>';
    } else {
        statusElem.innerHTML = '<span class="status-badge pending">Pending Verification</span>';
    }
    
    // Clear previous content
    modalDetails.innerHTML = '';
    verificationActions.innerHTML = '';
    removeActions.innerHTML = '';
    
    // Add new content
    modalDetails.appendChild(content);
    
    // Add verification action if not verified
    if (!member.is_verified) {
        const verifyForm = document.createElement('form');
        verifyForm.action = `/family/verify/${member.relation_id}`;
        verifyForm.method = 'post';
        verifyForm.classList.add('inline-form');
        
        const verifyButton = document.createElement('button');
        verifyButton.type = 'submit';
        verifyButton.className = 'btn btn-primary';
        verifyButton.textContent = 'Verify Relationship';
        
        verifyForm.appendChild(verifyButton);
        verificationActions.appendChild(verifyForm);
    }
    
    // Add remove action
    const removeForm = document.createElement('form');
    removeForm.action = `/family/remove/${member.relation_id}`;
    removeForm.method = 'post';
    removeForm.classList.add('inline-form');
    removeForm.onsubmit = function() {
        return confirm('Are you sure you want to remove this family member?');
    };
    
    const removeButton = document.createElement('button');
    removeButton.type = 'submit';
    removeButton.className = 'btn btn-danger';
    removeButton.textContent = 'Remove Relationship';
    
    removeForm.appendChild(removeButton);
    removeActions.appendChild(removeForm);
    
    // Show modal
    modal.style.display = 'block';
}

/**
 * Format relationship type for display
 */
function formatRelationshipType(relationship) {
    if (!relationship) return '';
    return relationship.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Add AJAX functionality to forms
 */
function setupAjaxForms() {
    const forms = document.querySelectorAll('.ajax-form');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const formData = new FormData(form);
            const url = form.action;
            const method = form.method;
            
            fetch(url, {
                method: method,
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success message
                    showAlert(data.message, 'success');
                    
                    // Reload data if needed
                    if (data.reload) {
                        window.location.reload();
                    }
                } else {
                    // Show error message
                    showAlert(data.message, 'error');
                }
            })
            .catch(error => {
                showAlert('An error occurred while processing your request.', 'error');
                console.error('Error:', error);
            });
        });
    });
}

/**
 * Show an alert message
 */
function showAlert(message, type) {
    const alertContainer = document.createElement('div');
    alertContainer.className = `alert alert-${type}`;
    alertContainer.innerHTML = `<p>${message}</p>`;
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.className = 'close-btn';
    closeButton.setAttribute('aria-label', 'Close');
    alertContainer.appendChild(closeButton);
    
    // Add to document
    document.querySelector('.container').insertBefore(alertContainer, document.querySelector('.container').firstChild);
    
    // Add click event to close button
    closeButton.addEventListener('click', function() {
        alertContainer.style.opacity = '0';
        setTimeout(() => {
            alertContainer.remove();
        }, 300);
    });
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        alertContainer.style.opacity = '0';
        setTimeout(() => {
            alertContainer.remove();
        }, 300);
    }, 5000);
} 