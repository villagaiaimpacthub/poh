/**
 * Resource and Script Loading Diagnostic Tool
 * This script checks if critical resources are loaded properly
 */

(function() {
    console.log('[LOAD-CHECKER] Initializing load checking...');
    
    // Store load status
    window.loadStatus = {
        d3: false,
        circularFamilyTree: false,
        simpleViz: false,
        networkViz: false,
        loadTime: {},
        errors: []
    };
    
    // Function to safely query the DOM
    function safeQuerySelector(selector) {
        try {
            return document.querySelector(selector);
        } catch (e) {
            console.error('[LOAD-CHECKER] Error querying for', selector, e);
            return null;
        }
    }
    
    // Track script loading
    function trackScriptLoading() {
        const scripts = document.scripts;
        const scriptURLs = Array.from(scripts).map(script => script.src).filter(src => src);
        
        console.log('[LOAD-CHECKER] Found', scriptURLs.length, 'scripts with URLs');
        
        // Check for critical scripts
        const d3Script = scriptURLs.find(url => url.includes('d3.v7.min.js'));
        const circularTreeScript = scriptURLs.find(url => url.includes('circular_family_tree.js'));
        const simpleVizScript = scriptURLs.find(url => url.includes('simple_viz.js'));
        const networkVizScript = scriptURLs.find(url => url.includes('network-visualization.js'));
        
        console.log('[LOAD-CHECKER] Critical scripts:', {
            d3Script,
            circularTreeScript,
            simpleVizScript,
            networkVizScript
        });
        
        // Check if they're loaded in global scope
        window.setTimeout(() => {
            window.loadStatus.d3 = typeof d3 !== 'undefined';
            window.loadStatus.circularFamilyTree = typeof CircularFamilyTree !== 'undefined';
            window.loadStatus.simpleViz = typeof createSimpleVisualization !== 'undefined';
            window.loadStatus.networkViz = typeof window.initNetworkViz !== 'undefined';
            
            console.log('[LOAD-CHECKER] Script load status:', window.loadStatus);
            
            // Look for visualization containers
            const heroViz = safeQuerySelector('#hero-visualization');
            const visualizationIframe = safeQuerySelector('#visualization-iframe');
            const vizContainer = safeQuerySelector('.visualization-container');
            
            console.log('[LOAD-CHECKER] Visualization containers:', {
                heroViz: !!heroViz,
                visualizationIframe: !!visualizationIframe,
                vizContainer: !!vizContainer
            });
            
            // Check container dimensions if they exist
            if (heroViz) {
                const rect = heroViz.getBoundingClientRect();
                console.log('[LOAD-CHECKER] Hero visualization dimensions:', {
                    width: rect.width,
                    height: rect.height,
                    display: window.getComputedStyle(heroViz).display,
                    visibility: window.getComputedStyle(heroViz).visibility,
                    position: window.getComputedStyle(heroViz).position
                });
            }
        }, 500);
    }
    
    // Track page load performance
    function trackPageLoad() {
        const startTime = performance.now();
        
        window.addEventListener('load', () => {
            const loadTime = performance.now() - startTime;
            console.log('[LOAD-CHECKER] Page loaded in', loadTime.toFixed(2), 'ms');
            
            window.loadStatus.loadTime = {
                total: loadTime,
                navigation: performance.timing.navigationStart,
                domInteractive: performance.timing.domInteractive - performance.timing.navigationStart,
                domComplete: performance.timing.domComplete - performance.timing.navigationStart,
                loadEvent: performance.timing.loadEventEnd - performance.timing.navigationStart
            };
            
            // Check resources after load
            trackResourceLoading();
            
            // Check for errors with key elements
            checkForErrors();
        });
    }
    
    // Track resource loading
    function trackResourceLoading() {
        // Check all resources
        const resources = performance.getEntriesByType('resource');
        const scriptResources = resources.filter(r => r.initiatorType === 'script');
        const cssResources = resources.filter(r => r.initiatorType === 'link');
        const imageResources = resources.filter(r => r.initiatorType === 'img');
        
        console.log('[LOAD-CHECKER] Resources loaded:', {
            total: resources.length,
            scripts: scriptResources.length,
            css: cssResources.length,
            images: imageResources.length
        });
        
        // Check for slow resources (taking > 1000ms)
        const slowResources = resources.filter(r => r.duration > 1000);
        if (slowResources.length > 0) {
            console.warn('[LOAD-CHECKER] Slow resources:', slowResources.map(r => ({
                name: r.name,
                duration: r.duration.toFixed(2) + 'ms'
            })));
        }
        
        // Check for failed resources
        const failedResources = [];
        document.querySelectorAll('img, script, link').forEach(el => {
            if (el.tagName === 'IMG' && (!el.complete || el.naturalWidth === 0)) {
                failedResources.push({element: el, src: el.src});
            }
            if (el.tagName === 'SCRIPT' && el.src && !document.body.contains(el)) {
                failedResources.push({element: el, src: el.src});
            }
            if (el.tagName === 'LINK' && el.href && el.rel === 'stylesheet' && !document.styleSheets.length) {
                failedResources.push({element: el, href: el.href});
            }
        });
        
        if (failedResources.length > 0) {
            console.error('[LOAD-CHECKER] Failed resources:', failedResources);
            window.loadStatus.errors.push({
                type: 'resource',
                message: 'Failed to load resources',
                resources: failedResources.map(r => r.src || r.href || 'unknown')
            });
        }
    }
    
    // Check for common errors
    function checkForErrors() {
        // Check if there are error messages visible in the DOM
        const errorElements = document.querySelectorAll('.error, [class*="error"], [class*="Error"]');
        if (errorElements.length > 0) {
            console.warn('[LOAD-CHECKER] Found potential error elements in DOM:', errorElements.length);
        }
        
        // Check for loading indicators that might still be visible
        const loadingIndicators = document.querySelectorAll(
            '#loading-indicator, .loading, .spinner, [class*="loading"], [class*="Loading"]'
        );
        
        loadingIndicators.forEach(indicator => {
            const style = window.getComputedStyle(indicator);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
                console.warn('[LOAD-CHECKER] Loading indicator still visible:', indicator);
                window.loadStatus.errors.push({
                    type: 'ui',
                    message: 'Loading indicator still visible after page load',
                    element: indicator.id || indicator.className
                });
            }
        });
        
        // Check for visualization container issues
        const vizContainers = document.querySelectorAll(
            '#hero-visualization, .visualization-container, #viz-container'
        );
        
        vizContainers.forEach(container => {
            const rect = container.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                console.error('[LOAD-CHECKER] Visualization container has zero dimensions:', container);
                window.loadStatus.errors.push({
                    type: 'container',
                    message: 'Visualization container has zero dimensions',
                    element: container.id || container.className
                });
            }
            
            // Check if the container has any content
            if (container.children.length === 0) {
                console.warn('[LOAD-CHECKER] Visualization container is empty:', container);
                window.loadStatus.errors.push({
                    type: 'container',
                    message: 'Visualization container is empty',
                    element: container.id || container.className
                });
            }
        });
    }
    
    // Run diagnostic checks
    trackScriptLoading();
    trackPageLoad();
    
    // Expose API for checking from console
    window.checkPageLoad = function() {
        console.log('[LOAD-CHECKER] Load status:', window.loadStatus);
        trackResourceLoading();
        checkForErrors();
        return window.loadStatus;
    };
    
    // Log visualization errors
    window.logVizError = function(error, source = 'unknown') {
        console.error('[LOAD-CHECKER] Visualization error:', error, 'in', source);
        window.loadStatus.errors.push({
            type: 'visualization',
            message: error,
            source: source
        });
        
        // Try to log to server
        try {
            fetch('/api/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    error: `Visualization error: ${error}`,
                    source: source
                })
            }).catch(e => console.error('Failed to log visualization error to server:', e));
        } catch (e) {
            console.error('Error sending visualization error to server:', e);
        }
    };
    
    console.log('[LOAD-CHECKER] Initialization complete');
})(); 