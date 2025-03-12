// @ts-check
const { test, expect } = require('@playwright/test');
const { AuthManager } = require('../utils/auth-manager');
const { TestDatabaseManager } = require('../utils/db-manager');

// Test constants
const USER_1 = {
  email: 'test@example.com',
  password: 'Password123!'
};

const USER_2 = {
  email: 'family@example.com',
  password: 'Password123!'
};

test.describe('Family Verification Flow', () => {
  const authManager = new AuthManager();
  const dbManager = new TestDatabaseManager();
  
  test.beforeAll(async () => {
    // Initialize and seed test database
    await dbManager.initTestDb();
    await dbManager.seedTestData();
  });
  
  test.beforeEach(async ({ page }) => {
    // Log in as the first user
    await page.goto('/login');
    await page.fill('input[name="email"]', USER_1.email);
    await page.fill('input[name="password"]', USER_1.password);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await expect(page).toHaveURL(/.*dashboard/);
  });
  
  test('should add a family member and complete verification', async ({ page, context }) => {
    // Navigate to family section
    await page.click('a:has-text("Family")');
    await expect(page).toHaveURL(/.*family/);
    
    // Click "Add family member" button
    await page.click('button:has-text("Add Family Member")');
    
    // Fill in family member details
    await page.fill('input[name="email"]', 'newfamily@example.com');
    await page.selectOption('select[name="relationship_type"]', 'sibling');
    
    // Submit the form
    await page.click('button:has-text("Send Invitation")');
    
    // Check for success message
    await expect(page.locator('.success-message')).toBeVisible();
    await expect(page.locator('.success-message')).toContainText('Invitation sent');
    
    // Check that the pending relationship appears in the list
    await expect(page.locator('.family-list')).toContainText('newfamily@example.com');
    await expect(page.locator('.family-list')).toContainText('Pending');
    
    // Now let's simulate the other user accepting the invitation
    // Open a new page for the second user
    const secondUserPage = await context.newPage();
    
    // Log in as the second user
    await secondUserPage.goto('/login');
    await secondUserPage.fill('input[name="email"]', 'newfamily@example.com');
    await secondUserPage.fill('input[name="password"]', 'Password123!'); // Assuming this is set up in seed data
    await secondUserPage.click('button[type="submit"]');
    
    // Navigate to notifications
    await secondUserPage.click('a:has-text("Notifications")');
    
    // Check for family request notification
    await expect(secondUserPage.locator('.notification-list')).toContainText('family relationship request');
    
    // Accept the invitation
    await secondUserPage.click('button:has-text("Accept")');
    
    // Check for success message
    await expect(secondUserPage.locator('.success-message')).toBeVisible();
    
    // Check that family section shows the relationship
    await secondUserPage.click('a:has-text("Family")');
    await expect(secondUserPage.locator('.family-list')).toContainText(USER_1.email);
    
    // Now switch back to the first user and refresh the family page
    await page.reload();
    
    // Check that the relationship is no longer pending
    await expect(page.locator('.family-list')).not.toContainText('Pending');
    await expect(page.locator('.family-list')).toContainText('Verified');
    
    // Check verification status
    await page.click('a:has-text("Verification")');
    
    // Verify that family verification section is updated
    await expect(page.locator('.verification-status-family')).toContainText('Complete');
    await expect(page.locator('.verification-level')).toContainText('Level 2');
  });
  
  test('should allow video verification call between family members', async ({ page, context }) => {
    // Navigate to verification section
    await page.click('a:has-text("Verification")');
    
    // Request a video verification
    await page.click('button:has-text("Request Video Verification")');
    
    // Select family member for verification
    await page.selectOption('select[name="verifier"]', USER_2.email);
    
    // Submit request
    await page.click('button:has-text("Send Request")');
    
    // Check for success message
    await expect(page.locator('.success-message')).toBeVisible();
    await expect(page.locator('.success-message')).toContainText('Verification request sent');
    
    // Open second user's page
    const secondUserPage = await context.newPage();
    
    // Log in as the second user
    await secondUserPage.goto('/login');
    await secondUserPage.fill('input[name="email"]', USER_2.email);
    await secondUserPage.fill('input[name="password"]', USER_2.password);
    await secondUserPage.click('button[type="submit"]');
    
    // Navigate to verifications
    await secondUserPage.click('a:has-text("Verification Requests")');
    
    // Check for the pending request
    await expect(secondUserPage.locator('.verification-requests')).toContainText(USER_1.email);
    
    // Accept the verification request
    await secondUserPage.click('button:has-text("Accept")');
    
    // Check that video call interface appears
    await expect(secondUserPage.locator('.video-call-container')).toBeVisible();
    
    // Meanwhile, the first user should see that the call is accepted
    await expect(page.locator('.video-call-status')).toContainText('accepted your request');
    
    // Let's check if the first user also has the video call interface
    await expect(page.locator('.video-call-container')).toBeVisible();
    await expect(page.locator('.remote-video')).toBeVisible();
    
    // Verify identity (in a real test we'd interact with the WebRTC UI)
    await secondUserPage.click('button:has-text("Verify Identity")');
    
    // Check for success confirmation
    await expect(secondUserPage.locator('.verification-success')).toBeVisible();
    
    // First user should now see updated verification status
    await page.reload();
    await expect(page.locator('.verification-level')).toContainText('Level 3');
  });
  
  test.afterAll(async () => {
    // Clean up - we're not clearing the database here because
    // these tests rely on seeded data
  });
}); 