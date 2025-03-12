// @ts-check
const { test, expect } = require('@playwright/test');
const { VisualTestHelper } = require('../utils/visual-test-helper');
const { TestDatabaseManager } = require('../utils/db-manager');

// Test user with access to all features
const TEST_USER = {
  email: 'verifier@example.com',
  password: 'Password123!'
};

test.describe('UI Component Visual Tests', () => {
  const dbManager = new TestDatabaseManager();
  let visualHelper;
  
  test.beforeAll(async () => {
    // Initialize and seed test database
    await dbManager.initTestDb();
    await dbManager.seedTestData();
  });
  
  test.beforeEach(async ({ page }, testInfo) => {
    // Initialize visual test helper
    visualHelper = new VisualTestHelper(testInfo);
    
    // Log in
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await expect(page).toHaveURL(/.*dashboard/);
  });
  
  test('should match dashboard layout', async ({ page }) => {
    // Ensure dashboard is loaded
    await page.goto('/dashboard');
    
    // Wait for all components to load (you may need to adjust selectors)
    await page.waitForSelector('.dashboard-container', { state: 'visible' });
    await page.waitForSelector('.verification-status', { state: 'visible' });
    await page.waitForSelector('.family-summary', { state: 'visible' });
    
    // Take a screenshot and compare
    await visualHelper.compareScreenshot(page, 'dashboard-layout');
  });
  
  test('should match family tree visualization', async ({ page }) => {
    // Navigate to family tree page
    await page.goto('/family');
    
    // Wait for family tree visualization to load
    await page.waitForSelector('.family-tree-visualization', { state: 'visible' });
    
    // Take a screenshot of just the family tree component
    const familyTreeElement = page.locator('.family-tree-visualization');
    await visualHelper.compareScreenshot(familyTreeElement, 'family-tree-component');
  });
  
  test('should match verification progress indicators', async ({ page }) => {
    // Navigate to verification page
    await page.goto('/verification');
    
    // Wait for verification component to load
    await page.waitForSelector('.verification-progress', { state: 'visible' });
    
    // Take a screenshot of verification progress component
    const verificationElement = page.locator('.verification-progress');
    await visualHelper.compareScreenshot(verificationElement, 'verification-progress-component');
  });
  
  test('should match DID management interface', async ({ page }) => {
    // Navigate to DID/identity page
    await page.goto('/identity');
    
    // Wait for DID management interface to load
    await page.waitForSelector('.did-management', { state: 'visible' });
    
    // Take a screenshot of DID management interface
    const didManagementElement = page.locator('.did-management');
    await visualHelper.compareScreenshot(didManagementElement, 'did-management-component');
  });
  
  test('should match mobile navigation menu', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Refresh to apply mobile layout
    await page.goto('/dashboard');
    
    // Open mobile menu
    await page.click('.mobile-menu-toggle');
    
    // Wait for menu to open
    await page.waitForSelector('.mobile-menu.open', { state: 'visible' });
    
    // Take a screenshot of the mobile menu
    await visualHelper.compareScreenshot(page, 'mobile-navigation-menu');
  });
  
  test('should match dark mode appearance', async ({ page }) => {
    // Navigate to settings
    await page.goto('/settings');
    
    // Enable dark mode
    await page.click('button:has-text("Dark Mode")');
    
    // Go to dashboard to check appearance
    await page.goto('/dashboard');
    
    // Wait for dashboard to load with dark mode
    await page.waitForSelector('.dashboard-container.dark-mode', { state: 'visible' });
    
    // Take a screenshot with dark mode enabled
    await visualHelper.compareScreenshot(page, 'dark-mode-dashboard');
  });
  
  test('should match form validation error states', async ({ page }) => {
    // Navigate to the profile edit page
    await page.goto('/profile/edit');
    
    // Submit the form without filling required fields
    await page.click('button[type="submit"]');
    
    // Wait for validation errors to appear
    await page.waitForSelector('.validation-error', { state: 'visible' });
    
    // Take a screenshot of the form with validation errors
    const formElement = page.locator('form');
    await visualHelper.compareScreenshot(formElement, 'form-validation-errors');
  });
}); 