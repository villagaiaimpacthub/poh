/**
 * Proof of Humanity - Main JavaScript
 * Common functionality used across the site
 */

document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    initMobileMenu();
    
    // Flash message handling
    initFlashMessages();
    
    // Header scroll effects
    initHeaderScroll();
    
    // Initialize tooltips
    initTooltips();
    
    // Initialize dropdowns
    initDropdowns();
    
    // Initialize theme toggle if present
    initThemeToggle();
});

/**
 * Initialize mobile menu functionality
 */
function initMobileMenu() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    
    if (mobileMenuToggle && mainNav) {
        mobileMenuToggle.addEventListener('click', function() {
            mobileMenuToggle.classList.toggle('active');
            mainNav.classList.toggle('active');
            document.body.classList.toggle('menu-open');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (mainNav.classList.contains('active') && 
                !mainNav.contains(event.target) && 
                !mobileMenuToggle.contains(event.target)) {
                mainNav.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });
    }
}

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