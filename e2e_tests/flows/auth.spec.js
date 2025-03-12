// @ts-check
const { test, expect } = require('@playwright/test');
const { AuthManager } = require('../utils/auth-manager');
const { TestDatabaseManager } = require('../utils/db-manager');

// Test data
const TEST_USER = {
  name: 'Test E2E User',
  email: `test${Date.now()}@example.com`,
  password: 'TestPassword123!'
};

test.describe('Authentication Flow', () => {
  const authManager = new AuthManager();
  const dbManager = new TestDatabaseManager();
  
  test.beforeAll(async () => {
    // Initialize test database
    await dbManager.initTestDb();
  });
  
  test('should allow user registration and login', async ({ page }) => {
    // Navigate to the registration page
    await page.goto('/register');
    
    // Fill in registration form
    await page.fill('input[name="name"]', TEST_USER.name);
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.fill('input[name="confirm_password"]', TEST_USER.password);
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Check for success message
    await expect(page.locator('.registration-success')).toBeVisible();
    await expect(page.locator('.registration-success')).toContainText('Registration successful');
    
    // Mock email verification
    // In a real test, we might interact with a mock email service
    // For now, we'll just simulate the verification
    await page.goto('/verify-email?token=mock-token');
    await expect(page.locator('.verification-success')).toBeVisible();
    
    // Navigate to login page
    await page.goto('/login');
    
    // Fill in login form
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    
    // Submit login form
    await page.click('button[type="submit"]');
    
    // Check if we're redirected to the dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Check if user name is displayed in the header
    await expect(page.locator('.user-name')).toContainText(TEST_USER.name);
  });
  
  test('should handle failed login attempts', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Try to login with incorrect credentials
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', 'WrongPassword123!');
    
    // Submit login form
    await page.click('button[type="submit"]');
    
    // Check for error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('Invalid credentials');
    
    // Check that we're still on the login page
    await expect(page).toHaveURL(/.*login/);
  });
  
  test('should handle password reset flow', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Click on "Forgot Password" link
    await page.click('a:has-text("Forgot Password")');
    
    // Check we're on the password reset request page
    await expect(page).toHaveURL(/.*reset-password/);
    
    // Fill in email for password reset
    await page.fill('input[name="email"]', TEST_USER.email);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Check for success message
    await expect(page.locator('.reset-request-success')).toBeVisible();
    
    // Mock receiving a reset link
    // In a real test, we might interact with a mock email service
    await page.goto('/reset-password?token=mock-reset-token');
    
    // Fill in new password
    const newPassword = 'NewPassword123!';
    await page.fill('input[name="password"]', newPassword);
    await page.fill('input[name="confirm_password"]', newPassword);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Check for success message
    await expect(page.locator('.password-reset-success')).toBeVisible();
    
    // Try logging in with the new password
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', newPassword);
    await page.click('button[type="submit"]');
    
    // Check if we're redirected to the dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });
  
  test.afterAll(async () => {
    // Clean up test data
    await dbManager.clearTestData();
  });
}); 