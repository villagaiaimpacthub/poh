/**
 * Proof of Humanity - Main JavaScript
 * Common functionality used across the site
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('[DEBUG] DOM Content Loaded - Starting page initialization');
    
    // Log page information
    logPageInfo();
    
    // Initialize verification stage dropdowns with enhanced logging
    console.time('initVerificationStageDropdowns');
    initVerificationStageDropdowns();
    console.timeEnd('initVerificationStageDropdowns');
    
    // Initialize login functionality
    console.time('initLoginFunctionality');
    initLoginFunctionality();
    console.timeEnd('initLoginFunctionality');
    
    // Initialize mobile menu
    console.time('initMobileMenu');
    initMobileMenu();
    console.timeEnd('initMobileMenu');
    
    // Fix layout issues for specific pages
    console.time('fixLayoutIssues');
    fixLayoutIssues();
    console.timeEnd('fixLayoutIssues');
    
    // Add document-level click listener to log events for debugging
    document.addEventListener('click', function(event) {
        console.log('[DEBUG] Element clicked:', event.target);
        console.log('[DEBUG] Element classes:', event.target.className);
        console.log('[DEBUG] Element parent:', event.target.parentElement);
    });
    
    console.log('[DEBUG] Page initialization complete');
});

/**
 * Initialize verification stage dropdowns
 */
function initVerificationStageDropdowns() {
    console.log('Initializing verification stage dropdowns');
    const stageCards = document.querySelectorAll('.verification-stage-card');
    console.log(`Found ${stageCards.length} verification stage cards`);
    
    stageCards.forEach(card => {
        const header = card.querySelector('.stage-header');
        const details = card.querySelector('.stage-details');
        
        if (header && details) {
            header.addEventListener('click', function() {
                console.log(`Toggle details for ${card.dataset.stage} stage`);
                const expanded = details.style.display !== 'none';
                
                if (expanded) {
                    details.style.display = 'none';
                    header.querySelector('.toggle-icon i').classList.remove('fa-chevron-up');
                    header.querySelector('.toggle-icon i').classList.add('fa-chevron-down');
                } else {
                    details.style.display = 'block';
                    header.querySelector('.toggle-icon i').classList.remove('fa-chevron-down');
                    header.querySelector('.toggle-icon i').classList.add('fa-chevron-up');
                }
            });
        } else {
            console.warn(`Missing header or details for stage card: ${card.dataset.stage}`);
        }
    });
}

/**
 * Initialize login functionality
 */
function initLoginFunctionality() {
    console.log('Initializing login functionality');
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        console.log('Login form found, setting up event listeners');
        
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const emailInput = loginForm.querySelector('input[type="email"]');
            const passwordInput = loginForm.querySelector('input[type="password"]');
            
            if (!emailInput || !passwordInput) {
                console.error('Login form missing email or password inputs');
                return;
            }
            
            const email = emailInput.value;
            const password = passwordInput.value;
            
            if (!email || !password) {
                console.log('Email or password missing');
                // Show validation error
                return;
            }
            
            console.log('Login form submitted with email:', email);
            
            // For demo purposes, hard-code a successful login
            // In a real app, this would be an AJAX call to the backend
            window.location.href = '/dashboard';
        });
    } else {
        console.log('Login form not found on this page');
    }
}

/**
 * Initialize mobile menu functionality (enhanced version)
 */
function initMobileMenu() {
    console.log('Initializing mobile menu');
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');
    
    if (mobileMenuToggle && mobileMenu) {
        mobileMenuToggle.addEventListener('click', function() {
            console.log('Mobile menu toggle clicked');
            mobileMenu.classList.toggle('open');
        });
    } else {
        console.log('Mobile menu elements not found on this page');
    }
}

/**
 * Fix layout issues on specific pages
 */
function fixLayoutIssues() {
    console.log('Fixing layout issues for current page');
    
    // Determine the current page
    const currentPath = window.location.pathname;
    console.log(`Current path: ${currentPath}`);
    
    // Fix about page layout
    if (currentPath.includes('/about')) {
        console.log('Fixing about page layout');
        const aboutSections = document.querySelectorAll('.section-web5');
        
        aboutSections.forEach((section, index) => {
            section.style.marginBottom = '60px';
            
            // Ensure section container has proper width
            const container = section.querySelector('.container');
            if (container) {
                container.style.width = '100%';
                container.style.maxWidth = '1200px';
                container.style.padding = '0 20px';
            }
        });
    }
    
    // Fix verification page layout
    if (currentPath.includes('/verification')) {
        console.log('Fixing verification page layout');
        
        // Ensure verification stage cards have consistent styling
        const cards = document.querySelectorAll('.verification-stage-card');
        cards.forEach(card => {
            card.style.marginBottom = '20px';
            card.style.cursor = 'pointer';
            
            // Add hover effect
            card.addEventListener('mouseenter', function() {
                this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.05)';
            });
        });
    }
    
    // Fix dashboard page layout
    if (currentPath.includes('/dashboard')) {
        console.log('Fixing dashboard page layout');
        
        // Ensure dashboard sections have proper spacing
        const dashboardSections = document.querySelectorAll('.dashboard-section');
        dashboardSections.forEach(section => {
            section.style.marginBottom = '40px';
        });
        
        // Fix visualization container sizing
        const visualizationContainer = document.querySelector('.visualization-container');
        if (visualizationContainer) {
            visualizationContainer.style.height = '500px';
            visualizationContainer.style.minHeight = '400px';
        }
        
        // Ensure dashboard cards have consistent styling
        const cards = document.querySelectorAll('.dashboard-card');
        cards.forEach(card => {
            card.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.05)';
            card.style.borderRadius = '12px';
            card.style.overflow = 'hidden';
        });
    }
}

// Add CSS styles dynamically to fix common issues
function addFixStyles() {
    console.log('Adding fix styles');
    
    // Create a style element
    const style = document.createElement('style');
    
    // Add CSS rules
    style.innerHTML = `
        /* Fix blank spaces */
        body, html {
            margin: 0;
            padding: 0;
            height: 100%;
        }
        
        /* General container fixes */
        .container {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }
        
        /* Section spacing */
        .section-web5 {
            padding: 60px 0;
            margin-bottom: 40px;
        }
        
        /* Card styling */
        .verification-stage-card {
            border-radius: 12px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
            background-color: #fff;
            margin-bottom: 20px;
            overflow: hidden;
            transition: box-shadow 0.3s ease;
            cursor: pointer;
        }
        
        .verification-stage-card .stage-header {
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }
        
        .verification-stage-card .stage-details {
            padding: 20px;
        }
        
        /* Badge styling */
        .badge {
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
        }
        
        .badge-success {
            background-color: #e6f7ed;
            color: #0f9d58;
        }
        
        .badge-warning {
            background-color: #fef7e0;
            color: #f4b400;
        }
        
        .badge-disabled {
            background-color: #f1f3f4;
            color: #80868b;
        }
        
        /* Button styling */
        .btn-web5 {
            display: inline-block;
            padding: 10px 20px;
            background-color: #8250df;
            color: white;
            border-radius: 25px;
            font-weight: 600;
            text-decoration: none;
            transition: background-color 0.3s ease;
        }
        
        .btn-web5:hover {
            background-color: #6f42c1;
        }
        
        .btn-outlined {
            display: inline-block;
            padding: 10px 20px;
            background-color: transparent;
            color: #8250df;
            border: 2px solid #8250df;
            border-radius: 25px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s ease;
        }
        
        .btn-outlined:hover {
            background-color: #8250df10;
        }
        
        .btn-outlined.disabled {
            border-color: #ccc;
            color: #999;
            cursor: not-allowed;
        }
        
        /* Progress bar */
        .progress-bar {
            height: 10px;
            background-color: #f1f3f4;
            border-radius: 5px;
            overflow: hidden;
            margin-bottom: 20px;
        }
        
        .progress-fill {
            height: 100%;
            background-color: #8250df;
            border-radius: 5px;
        }
        
        .progress-label {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 14px;
            color: #5f6368;
        }
    `;
    
    // Append the style element to the head
    document.head.appendChild(style);
}

// Call this function immediately
addFixStyles();

/**
 * Initialize flash message functionality
 */
function initFlashMessages() {
    const flashMessages = document.querySelectorAll('.flash-message');
    const flashContainer = document.querySelector('.flash-messages');
    
    // Auto-dismiss flash messages after 5 seconds
    flashMessages.forEach(message => {
        // Add close button if not present
        if (!message.querySelector('.flash-close')) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'flash-close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.innerHTML = '&times;';
            message.appendChild(closeBtn);
        }
        
        // Set timeout to auto-dismiss
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                message.remove();
                
                // Hide container if empty
                if (flashContainer && flashContainer.children.length === 0) {
                    flashContainer.style.display = 'none';
                }
            }, 300);
        }, 5000);
    });
    
    // Handle close button clicks
    if (flashContainer) {
        flashContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('flash-close')) {
                const message = e.target.parentElement;
                message.style.opacity = '0';
                setTimeout(() => {
                    message.remove();
                    
                    // Hide container if empty
                    if (flashContainer.children.length === 0) {
                        flashContainer.style.display = 'none';
                    }
                }, 300);
            }
        });
    }
}

/**
 * Initialize header scroll effects
 */
function initHeaderScroll() {
    const header = document.querySelector('.header');
    
    if (header) {
        // Add scrolled class on page load if already scrolled
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        }
        
        // Add/remove scrolled class on scroll
        window.addEventListener('scroll', function() {
            if (window.scrollY > 10) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }
}

/**
 * Initialize tooltips
 */
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        const tooltipText = element.getAttribute('data-tooltip');
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = tooltipText;
        
        // Add tooltip to element
        element.appendChild(tooltip);
        
        // Position tooltip on hover
        element.addEventListener('mouseenter', function() {
            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            tooltip.style.top = `-${tooltipRect.height + 8}px`;
            tooltip.style.left = `${(rect.width / 2) - (tooltipRect.width / 2)}px`;
            tooltip.classList.add('visible');
        });
        
        // Hide tooltip on mouse leave
        element.addEventListener('mouseleave', function() {
            tooltip.classList.remove('visible');
        });
    });
}

/**
 * Initialize dropdown menus
 */
function initDropdowns() {
    const dropdownTriggers = document.querySelectorAll('.dropdown-trigger');
    
    dropdownTriggers.forEach(trigger => {
        const dropdown = trigger.nextElementSibling;
        
        if (dropdown && dropdown.classList.contains('dropdown-menu')) {
            // Toggle dropdown on click
            trigger.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Close all other dropdowns
                document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
                    if (menu !== dropdown) {
                        menu.classList.remove('active');
                    }
                });
                
                // Toggle current dropdown
                dropdown.classList.toggle('active');
            });
        }
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        const dropdowns = document.querySelectorAll('.dropdown-menu.active');
        
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target) && 
                !e.target.classList.contains('dropdown-trigger') && 
                !e.target.closest('.dropdown-trigger')) {
                dropdown.classList.remove('active');
            }
        });
    });
}

/**
 * Initialize theme toggle functionality
 */
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    
    if (themeToggle) {
        // Check for saved theme preference or respect OS preference
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggle.checked = true;
        }
        
        // Toggle theme on change
        themeToggle.addEventListener('change', function() {
            if (this.checked) {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
            }
        });
    }
}

/**
 * Show a notification message
 * @param {string} message - The message to display
 * @param {string} type - The type of notification (success, error, warning, info)
 * @param {number} duration - How long to show the notification in ms (default: 5000)
 */
function showNotification(message, type = 'info', duration = 5000) {
    const flashContainer = document.querySelector('.flash-messages');
    
    if (!flashContainer) return;
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `flash-message ${type}`;
    notification.innerHTML = `
        ${message}
        <button class="flash-close" aria-label="Close">&times;</button>
    `;
    
    // Add to container
    flashContainer.appendChild(notification);
    flashContainer.style.display = 'block';
    
    // Ensure it's visible (in case it was previously hidden)
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);
    
    // Auto-dismiss after duration
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.remove();
            
            // Hide container if empty
            if (flashContainer.children.length === 0) {
                flashContainer.style.display = 'none';
            }
        }, 300);
    }, duration);
    
    // Handle close button
    const closeBtn = notification.querySelector('.flash-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
                
                // Hide container if empty
                if (flashContainer.children.length === 0) {
                    flashContainer.style.display = 'none';
                }
            }, 300);
        });
    }
}

/**
 * Format a date string
 * @param {string} dateString - The date string to format
 * @param {object} options - Formatting options for toLocaleDateString
 * @returns {string} Formatted date string
 */
function formatDate(dateString, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', options);
}

/**
 * Debounce function to limit how often a function can be called
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Log detailed page information
function logPageInfo() {
    console.log('[DEBUG] Page Info:');
    console.log('- URL:', window.location.href);
    console.log('- Path:', window.location.pathname);
    console.log('- Window Size:', window.innerWidth, 'x', window.innerHeight);
    console.log('- User Agent:', navigator.userAgent);
    
    // Check for key page elements
    const verificationStages = document.querySelectorAll('.verification-stage-card');
    if (verificationStages.length > 0) {
        console.log(`[DEBUG] Found ${verificationStages.length} verification stage cards`);
        verificationStages.forEach((card, index) => {
            console.log(`[DEBUG] Stage card ${index}:`, card.dataset.stage);
            console.log(`[DEBUG] - Has header:`, !!card.querySelector('.stage-header'));
            console.log(`[DEBUG] - Has details:`, !!card.querySelector('.stage-details'));
        });
    } else {
        console.log('[DEBUG] No verification stage cards found');
    }
    
    // Check if stylesheet has loaded
    const styleSheets = Array.from(document.styleSheets);
    console.log(`[DEBUG] ${styleSheets.length} stylesheets loaded`);
}

// Function to initialize verification stage dropdowns with enhanced logging
function initVerificationStageDropdowns() {
    console.log('[DEBUG] Initializing verification stage dropdowns');
    const stageCards = document.querySelectorAll('.verification-stage-card');
    console.log(`[DEBUG] Found ${stageCards.length} verification stage cards`);
    
    if (stageCards.length === 0) {
        // Try again after a delay if no cards found (possible DOM timing issue)
        console.log('[DEBUG] No stage cards found initially, retrying after 500ms delay');
        setTimeout(() => {
            const retryStageCards = document.querySelectorAll('.verification-stage-card');
            console.log(`[DEBUG] Retry found ${retryStageCards.length} verification stage cards`);
            
            if (retryStageCards.length > 0) {
                setupStageCards(retryStageCards);
            } else {
                console.error('[DEBUG] Failed to find verification stage cards even after delay');
            }
        }, 500);
        return;
    }
    
    setupStageCards(stageCards);
}

// Helper function to set up stage cards
function setupStageCards(stageCards) {
    stageCards.forEach(card => {
        console.log(`[DEBUG] Setting up card:`, card.dataset.stage);
        
        // Check for existing header/details or create them if missing
        let header = card.querySelector('.stage-header');
        let details = card.querySelector('.stage-details');
        
        if (!header) {
            console.log(`[DEBUG] Creating missing header for card:`, card.dataset.stage);
            header = document.createElement('div');
            header.className = 'stage-header';
            
            // Get stage title and status
            const title = card.querySelector('h3, h4');
            const statusBadge = card.querySelector('.badge, .status-badge');
            
            if (title) {
                header.appendChild(title.cloneNode(true));
                title.remove();
            } else {
                const newTitle = document.createElement('h3');
                newTitle.className = 'stage-title';
                newTitle.textContent = capitalizeFirst(card.dataset.stage || 'Verification Stage');
                header.appendChild(newTitle);
            }
            
            if (statusBadge) {
                header.appendChild(statusBadge.cloneNode(true));
                statusBadge.remove();
            }
            
            // Add toggle icon
            const toggleIcon = document.createElement('span');
            toggleIcon.className = 'toggle-icon';
            toggleIcon.innerHTML = '<i class="fas fa-chevron-down"></i>';
            header.appendChild(toggleIcon);
            
            // Add header to card
            card.insertBefore(header, card.firstChild);
        }
        
        if (!details) {
            console.log(`[DEBUG] Creating missing details for card:`, card.dataset.stage);
            details = document.createElement('div');
            details.className = 'stage-details';
            
            // Move all child elements except header into details
            const children = Array.from(card.children);
            children.forEach(child => {
                if (child !== header && !child.classList.contains('stage-details')) {
                    details.appendChild(child);
                }
            });
            
            // If details is empty, add placeholder content
            if (details.children.length === 0) {
                const placeholder = document.createElement('p');
                placeholder.textContent = `Details for ${card.dataset.stage || 'this verification stage'} will be shown here.`;
                details.appendChild(placeholder);
            }
            
            card.appendChild(details);
            details.style.display = 'none';
        }
        
        // Add click event to header
        if (header && details) {
            // Remove existing listeners to avoid duplicates
            const newHeader = header.cloneNode(true);
            header.parentNode.replaceChild(newHeader, header);
            header = newHeader;
            
            header.addEventListener('click', function(event) {
                console.log(`[DEBUG] Header clicked for ${card.dataset.stage}`);
                
                // Toggle details visibility
                const isVisible = details.style.display !== 'none';
                console.log(`[DEBUG] Current visibility: ${isVisible ? 'visible' : 'hidden'}, toggling to ${isVisible ? 'hidden' : 'visible'}`);
                
                // Apply toggle
                details.style.display = isVisible ? 'none' : 'block';
                
                // Update icon
                const icon = header.querySelector('.toggle-icon i');
                if (icon) {
                    icon.className = isVisible ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
                }
                
                // Add active class to card
                card.classList.toggle('active', !isVisible);
                
                // Prevent event bubbling
                event.stopPropagation();
            });
        } else {
            console.error(`[DEBUG] Failed to setup card: missing header or details`);
        }
    });
}

// Helper function to capitalize first letter
function capitalizeFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Function to initialize login functionality with enhanced logging
function initLoginFunctionality() {
    console.log('[DEBUG] Initializing login functionality');
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        console.log('[DEBUG] Login form found');
        
        // Log form structure for debugging
        console.log('[DEBUG] Form action:', loginForm.action);
        console.log('[DEBUG] Form method:', loginForm.method);
        console.log('[DEBUG] Form fields:', Array.from(loginForm.elements).map(el => el.name || el.type));
        
        // Remove existing listeners to avoid duplicates
        const newForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newForm, loginForm);
        
        // Add submit event listener
        newForm.addEventListener('submit', function(event) {
            console.log('[DEBUG] Login form submitted');
            
            const emailInput = newForm.querySelector('input[type="email"], input[name="email"]');
            const passwordInput = newForm.querySelector('input[type="password"], input[name="password"]');
            
            if (!emailInput || !passwordInput) {
                console.error('[DEBUG] Login form missing email or password inputs');
                console.log('[DEBUG] Available inputs:', Array.from(newForm.querySelectorAll('input')).map(i => i.name || i.type));
                return;
            }
            
            console.log('[DEBUG] Login attempted with email:', emailInput.value);
            
            // For demo purposes, we'll let the form submit normally to the server
            // Don't prevent default here, let Flask handle it
        });
    } else {
        console.log('[DEBUG] Login form not found on this page');
    }
    
    // Fix any login buttons
    const loginButtons = document.querySelectorAll('.btn-login, a[href*="login"]');
    loginButtons.forEach(button => {
        console.log('[DEBUG] Found login button:', button);
        
        // Add click event listener
        button.addEventListener('click', function(event) {
            console.log('[DEBUG] Login button clicked');
        });
    });
}

// Function to initialize mobile menu with enhanced logging
function initMobileMenu() {
    console.log('[DEBUG] Initializing mobile menu');
    
    // Try both menu selector patterns
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle, #mobileMenuToggle');
    const mobileMenu = document.querySelector('.mobile-menu, #mobileMenu');
    
    console.log('[DEBUG] Mobile menu toggle found:', !!mobileMenuToggle);
    console.log('[DEBUG] Mobile menu found:', !!mobileMenu);
    
    if (mobileMenuToggle && mobileMenu) {
        // Remove existing listeners to avoid duplicates
        const newToggle = mobileMenuToggle.cloneNode(true);
        mobileMenuToggle.parentNode.replaceChild(newToggle, mobileMenuToggle);
        
        newToggle.addEventListener('click', function(event) {
            console.log('[DEBUG] Mobile menu toggle clicked');
            const isActive = mobileMenu.classList.contains('active') || mobileMenu.classList.contains('open');
            
            if (isActive) {
                mobileMenu.classList.remove('active', 'open');
                document.body.style.overflow = '';
            } else {
                mobileMenu.classList.add('active');
                document.body.style.overflow = 'hidden';
                
                // Force menu visibility
                mobileMenu.style.display = 'block';
                mobileMenu.style.visibility = 'visible';
                mobileMenu.style.opacity = '1';
            }
            
            // Prevent default behavior
            event.preventDefault();
        });
        
        // Add listeners to menu links
        const menuLinks = mobileMenu.querySelectorAll('a');
        menuLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.remove('active', 'open');
                document.body.style.overflow = '';
            });
        });
    } else {
        console.log('[DEBUG] Mobile menu elements not found on this page');
    }
}

// Function to fix layout issues for specific pages with enhanced logging
function fixLayoutIssues() {
    console.log('[DEBUG] Fixing layout issues');
    
    // Get current page path
    const currentPath = window.location.pathname;
    console.log('[DEBUG] Current path:', currentPath);
    
    // Apply fixes based on page
    if (currentPath.includes('/about')) {
        console.log('[DEBUG] Applying About page fixes');
        fixAboutPage();
    } else if (currentPath.includes('/verification')) {
        console.log('[DEBUG] Applying Verification page fixes');
        fixVerificationPage();
    } else if (currentPath.includes('/dashboard')) {
        console.log('[DEBUG] Applying Dashboard page fixes');
        fixDashboardPage();
    } else if (currentPath.includes('/login')) {
        console.log('[DEBUG] Applying Login page fixes');
        fixLoginPage();
    }
    
    // Apply common fixes to all pages
    fixCommonIssues();
}

// Fix About page layout issues
function fixAboutPage() {
    console.log('[DEBUG] Fixing About page layout');
    
    // Fix header spacing
    const header = document.querySelector('header');
    if (header) {
        console.log('[DEBUG] Adjusting header spacing');
        header.style.marginBottom = '0';
    }
    
    // Fix main content area
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        console.log('[DEBUG] Adjusting main content spacing');
        mainContent.style.paddingTop = '80px';
    }
    
    // Fix sections spacing
    const sections = document.querySelectorAll('.section-web5, .about-section');
    console.log(`[DEBUG] Found ${sections.length} sections to fix`);
    
    sections.forEach((section, index) => {
        console.log(`[DEBUG] Fixing section ${index}`);
        section.style.marginTop = index === 0 ? '0' : '60px';
        section.style.marginBottom = '60px';
        section.style.padding = '40px 0';
        
        // Fix container width
        const container = section.querySelector('.container');
        if (container) {
            container.style.maxWidth = '1200px';
            container.style.margin = '0 auto';
            container.style.padding = '0 20px';
        }
    });
}

// Fix Verification page layout issues
function fixVerificationPage() {
    console.log('[DEBUG] Fixing Verification page layout');
    
    // Fix header spacing
    const header = document.querySelector('header');
    if (header) {
        console.log('[DEBUG] Adjusting header spacing');
        header.style.marginBottom = '0';
    }
    
    // Fix main content area
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        console.log('[DEBUG] Adjusting main content spacing');
        mainContent.style.paddingTop = '80px';
    }
    
    // Ensure all verification stage cards have proper structure
    const stageCards = document.querySelectorAll('.verification-stage-card');
    console.log(`[DEBUG] Found ${stageCards.length} verification stage cards`);
    
    stageCards.forEach((card, index) => {
        console.log(`[DEBUG] Styling verification stage card ${index}`);
        
        // Ensure proper layout and styling
        card.style.backgroundColor = 'rgba(15, 23, 42, 0.5)';
        card.style.borderRadius = '12px';
        card.style.marginBottom = '20px';
        card.style.overflow = 'hidden';
        card.style.border = '1px solid rgba(122, 67, 255, 0.2)';
        card.style.transition = 'all 0.3s ease';
        card.style.cursor = 'pointer';
        
        // Fix stage header if it exists
        const header = card.querySelector('.stage-header');
        if (header) {
            header.style.padding = '20px';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.borderBottom = '1px solid rgba(122, 67, 255, 0.1)';
        }
        
        // Fix stage details if it exists
        const details = card.querySelector('.stage-details');
        if (details) {
            details.style.padding = '20px';
        }
    });
}

// Fix Dashboard page layout issues
function fixDashboardPage() {
    console.log('[DEBUG] Fixing Dashboard page layout');
    
    // Fix sections
    const sections = document.querySelectorAll('.dashboard-section');
    console.log(`[DEBUG] Found ${sections.length} dashboard sections`);
    
    sections.forEach((section, index) => {
        console.log(`[DEBUG] Fixing dashboard section ${index}`);
        section.style.marginBottom = '40px';
    });
    
    // Fix cards
    const cards = document.querySelectorAll('.dashboard-card');
    console.log(`[DEBUG] Found ${cards.length} dashboard cards`);
    
    cards.forEach((card, index) => {
        console.log(`[DEBUG] Fixing dashboard card ${index}`);
        card.style.backgroundColor = 'rgba(15, 23, 42, 0.5)';
        card.style.borderRadius = '12px';
        card.style.padding = '20px';
        card.style.marginBottom = '20px';
        card.style.border = '1px solid rgba(122, 67, 255, 0.2)';
    });
    
    // Fix verification status section if it exists
    const verificationStatus = document.querySelector('.verification-status');
    if (verificationStatus) {
        console.log('[DEBUG] Fixing verification status section');
        
        // Find and fix verification stage cards
        const stageCards = verificationStatus.querySelectorAll('.verification-stage-card');
        stageCards.forEach((card, index) => {
            console.log(`[DEBUG] Styling verification stage card ${index} in dashboard`);
            
            // Ensure proper layout and styling
            card.style.backgroundColor = 'rgba(15, 23, 42, 0.5)';
            card.style.borderRadius = '12px';
            card.style.marginBottom = '15px';
            card.style.overflow = 'hidden';
            card.style.border = '1px solid rgba(122, 67, 255, 0.2)';
            card.style.transition = 'all 0.3s ease';
            card.style.cursor = 'pointer';
        });
    }
}

// Fix Login page layout issues
function fixLoginPage() {
    console.log('[DEBUG] Fixing Login page layout');
    
    // Fix login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        console.log('[DEBUG] Fixing login form');
        
        // Ensure login title has proper gradient
        const pageTitle = document.querySelector('.login-gradient');
        if (pageTitle) {
            console.log('[DEBUG] Found login title');
            pageTitle.style.background = 'linear-gradient(135deg, #7a43ff 30%, #43d1ff 100%)';
            pageTitle.style.WebkitBackgroundClip = 'text';
            pageTitle.style.WebkitTextFillColor = 'transparent';
            pageTitle.style.backgroundClip = 'text';
            pageTitle.style.display = 'inline-block';
        }
        
        // Ensure form container has proper styling
        const formContainer = loginForm.closest('.auth-form-container');
        if (formContainer) {
            formContainer.style.marginTop = '2rem';
            formContainer.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2), 0 0 15px rgba(122, 67, 255, 0.1), 0 0 30px rgba(67, 209, 255, 0.1)';
        }
        
        // Add styling to the login button
        const loginButton = loginForm.querySelector('.btn-auth');
        if (loginButton) {
            loginButton.style.background = 'linear-gradient(135deg, #43d1ff 0%, #7a43ff 100%)';
            loginButton.style.color = '#fff';
        }
    }
}

// Add event listener to fix login page when loaded
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.href.includes('/login')) {
        fixLoginPage();
    }
});

// Fix common layout issues across all pages
function fixCommonIssues() {
    console.log('[DEBUG] Fixing common layout issues');
    
    // Fix main container
    const mainContainer = document.querySelector('main');
    if (mainContainer) {
        mainContainer.style.minHeight = 'calc(100vh - 200px)';
    }
    
    // Ensure proper header spacing
    const header = document.querySelector('header');
    if (header) {
        header.style.position = 'relative';
        header.style.zIndex = '100';
    }
    
    // Add fixed styles
    addFixStyles();
}

// Debug helper function to log element info
window.logElement = function(selector) {
    const element = document.querySelector(selector);
    if (element) {
        console.log('[DEBUG] Element found:', selector);
        console.log('- tagName:', element.tagName);
        console.log('- innerHTML:', element.innerHTML);
        console.log('- classList:', element.classList);
        console.log('- style:', element.style);
        console.log('- dimensions:', element.getBoundingClientRect());
    } else {
        console.log('[DEBUG] Element not found:', selector);
    }
    return 'Element logged to console';
};

// Manual initialization function for debugging
window.initPage = function() {
    console.log('[DEBUG] Manual initialization requested');
    initVerificationStageDropdowns();
    fixLayoutIssues();
    return 'Page manually initialized';
};

// Fix any heading styles across all pages
function fixAllHeadingStyles() {
    console.log('[DEBUG] Fixing all heading styles');
    
    // Target all headings that should have gradients
    const headingSelectors = [
        '.page-title.about-gradient',
        '.page-title.services-gradient',
        '.page-title.verification-gradient',
        '.page-title.login-gradient',
        '.page-title.network-gradient',
        '.section-title.about-gradient',
        '.section-title.services-gradient',
        '.visualization-title.network-gradient'
    ];
    
    headingSelectors.forEach(selector => {
        const headings = document.querySelectorAll(selector);
        headings.forEach(heading => {
            if (heading) {
                console.log(`[DEBUG] Fixing heading: ${selector}`);
                heading.style.display = 'inline-block';
                
                // Ensure proper background-clip properties
                if (window.getComputedStyle(heading).webkitBackgroundClip !== 'text') {
                    heading.style.WebkitBackgroundClip = 'text';
                    heading.style.backgroundClip = 'text';
                    heading.style.WebkitTextFillColor = 'transparent';
                }
            }
        });
    });
}

// Add event listener to fix all pages on load
document.addEventListener('DOMContentLoaded', function() {
    // Fix login page if applicable
    if (window.location.href.includes('/login')) {
        fixLoginPage();
    }
    
    // Fix headings on all pages
    fixAllHeadingStyles();
}); 