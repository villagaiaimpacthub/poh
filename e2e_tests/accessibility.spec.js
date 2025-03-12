// @ts-check
const { test, expect } = require('@playwright/test');
const { AccessibilityHelper } = require('./utils/accessibility-helper');
const { TestDatabaseManager } = require('./utils/db-manager');

// Test constants
const TEST_USER = {
  email: 'test@example.com',
  password: 'Password123!'
};

test.describe('Accessibility Tests', () => {
  const dbManager = new TestDatabaseManager();
  let accessibilityHelper;
  
  test.beforeAll(async () => {
    // Initialize and seed test database
    await dbManager.initTestDb();
    await dbManager.seedTestData();
  });
  
  test.beforeEach(async ({ page }) => {
    accessibilityHelper = new AccessibilityHelper();
    
    // Log in
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await expect(page).toHaveURL(/.*dashboard/);
  });
  
  test('dashboard should be accessible', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Run accessibility audit
    await accessibilityHelper.audit(page);
  });
  
  test('family page should be accessible', async ({ page }) => {
    // Navigate to family page
    await page.goto('/family');
    
    // Run accessibility audit
    await accessibilityHelper.audit(page);
  });
  
  test('verification page should be accessible', async ({ page }) => {
    // Navigate to verification page
    await page.goto('/verification');
    
    // Run accessibility audit
    await accessibilityHelper.audit(page);
  });
  
  test('identity/DID page should be accessible', async ({ page }) => {
    // Navigate to identity page
    await page.goto('/identity');
    
    // Run accessibility audit
    await accessibilityHelper.audit(page);
  });
  
  test('keyboard navigation should work correctly on dashboard', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Define the sequence of elements that should receive focus
    const focusableElements = [
      'nav a:nth-child(1)', // First nav item
      'nav a:nth-child(2)', // Second nav item
      'nav a:nth-child(3)', // Third nav item
      'nav a:nth-child(4)', // Fourth nav item
      '.dashboard-actions button:nth-child(1)', // First dashboard action button
      '.dashboard-actions button:nth-child(2)', // Second dashboard action button
    ];
    
    // Test keyboard navigation
    await accessibilityHelper.checkKeyboardNavigation(page, focusableElements);
  });
  
  test('form elements should have proper labels', async ({ page }) => {
    // Navigate to profile edit page
    await page.goto('/profile/edit');
    
    // Run accessibility audit with focus on form elements
    await accessibilityHelper.audit(page, {
      include: 'form, input, select, textarea, button'
    });
    
    // Check specifically for label associations
    const formControls = await page.$$('input, select, textarea');
    
    for (const control of formControls) {
      // Get element attributes
      const hasLabel = await page.evaluate(el => {
        // Check for associated label
        const id = el.id;
        if (!id) return false;
        
        // Look for explicit label with for attribute
        const explicitLabel = document.querySelector(`label[for="${id}"]`);
        if (explicitLabel) return true;
        
        // Check if input is wrapped in a label
        return el.closest('label') !== null;
      }, control);
      
      expect(hasLabel, 'Form control should have an associated label').toBeTruthy();
    }
  });
  
  test('color contrast should meet WCAG standards', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Run accessibility audit with focus on color contrast
    await accessibilityHelper.audit(page, {
      rules: ['color-contrast']
    });
  });
  
  test('images should have alt text', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Check all images for alt text
    const images = await page.$$('img');
    
    for (const img of images) {
      const hasAlt = await page.evaluate(el => {
        return el.hasAttribute('alt');
      }, img);
      
      expect(hasAlt, 'Image should have alt attribute').toBeTruthy();
    }
  });
  
  test('ARIA attributes should be used correctly', async ({ page }) => {
    // Navigate to dashboard which has interactive components
    await page.goto('/dashboard');
    
    // Run accessibility audit focusing on ARIA
    await accessibilityHelper.audit(page, {
      rules: ['aria-*']
    });
  });
}); 