/**
 * Simple visualization using D3.js
 * This is a minimal implementation to help debug issues
 */
class SimpleVisualization {
  constructor(config = {}) {
    // Store configuration
    this.config = {
      containerId: config.containerId || 'visualization-container',
      width: config.width || 500,
      height: config.height || 500,
      title: config.title || 'Simple Visualization',
      nodeCount: config.nodeCount || 10
    };
    
    console.log('SimpleVisualization initialized with config:', this.config);
    
    // Try to initialize
    try {
      this.initialize();
    } catch (error) {
      console.error('Error during initialization:', error);
      this.showError(error.message);
    }
  }
  
  initialize() {
    console.log('Starting initialization');
    
    // Find container
    this.container = document.getElementById(this.config.containerId);
    if (!this.container) {
      throw new Error(`Container element with ID "${this.config.containerId}" not found`);
    }
    
    console.log('Container found:', this.container);
    
    // Get container dimensions
    const rect = this.container.getBoundingClientRect();
    console.log('Container dimensions:', rect.width, 'x', rect.height);
    
    // Create SVG element
    this.svg = d3.select(`#${this.config.containerId}`)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.config.width} ${this.config.height}`)
      .style('display', 'block')
      .style('background', 'rgba(0, 0, 0, 0.1)');
    
    console.log('SVG created');
    
    // Add a border to make the SVG visible
    this.svg.append('rect')
      .attr('width', this.config.width)
      .attr('height', this.config.height)
      .attr('fill', 'none')
      .attr('stroke', '#444')
      .attr('stroke-width', 2);
    
    // Add title
    this.svg.append('text')
      .attr('x', this.config.width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .style('font-size', '18px')
      .text(this.config.title);
    
    // Create nodes
    this.createNodes();
    
    // Hide loading indicator if it exists
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
    
    console.log('Initialization complete');
  }
  
  createNodes() {
    console.log('Creating nodes');
    
    // Generate random node data
    const nodes = [];
    for (let i = 0; i < this.config.nodeCount; i++) {
      nodes.push({
        id: i,
        x: Math.random() * (this.config.width - 100) + 50,
        y: Math.random() * (this.config.height - 100) + 50,
        size: Math.random() * 20 + 10,
        color: d3.interpolateRainbow(i / this.config.nodeCount)
      });
    }
    
    // Create nodes
    this.svg.selectAll('.node')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => d.size)
      .attr('fill', d => d.color)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8)
      .on('mouseover', function() {
        d3.select(this)
          .transition()
          .duration(300)
          .attr('opacity', 1)
          .attr('stroke-width', 2);
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(300)
          .attr('opacity', 0.8)
          .attr('stroke-width', 1);
      });
    
    // Add labels
    this.svg.selectAll('.label')
      .data(nodes)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', d => d.x)
      .attr('y', d => d.y + d.size + 15)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .style('font-size', '12px')
      .text(d => `Node ${d.id}`);
    
    console.log('Created', nodes.length, 'nodes');
  }
  
  showError(message) {
    console.error('Showing error:', message);
    
    // Find container
    const container = document.getElementById(this.config.containerId);
    if (!container) {
      console.error('Cannot show error: container not found');
      return;
    }
    
    // Create error message
    const errorElement = document.createElement('div');
    errorElement.style.position = 'absolute';
    errorElement.style.top = '50%';
    errorElement.style.left = '50%';
    errorElement.style.transform = 'translate(-50%, -50%)';
    errorElement.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    errorElement.style.color = '#ff5757';
    errorElement.style.padding = '20px';
    errorElement.style.borderRadius = '5px';
    errorElement.style.textAlign = 'center';
    errorElement.style.maxWidth = '80%';
    
    errorElement.innerHTML = `
      <h3>Visualization Error</h3>
      <p>${message}</p>
      <button id="retry-button" style="background: #7a43ff; color: white; border: none; border-radius: 4px; padding: 8px 16px; margin-top: 10px; cursor: pointer;">
        Retry
      </button>
    `;
    
    container.appendChild(errorElement);
    
    // Add retry button event listener
    const retryButton = document.getElementById('retry-button');
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        console.log('Retry button clicked');
        container.innerHTML = '';
        try {
          this.initialize();
        } catch (error) {
          console.error('Error during retry:', error);
          this.showError(error.message);
        }
      });
    }
  }
}

// Add a global function to create the visualization
function createSimpleVisualization(containerId, options = {}) {
  console.log('Creating simple visualization in container:', containerId);
  return new SimpleVisualization({
    containerId: containerId,
    ...options
  });
} 