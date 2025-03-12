// @ts-check
const { test, expect } = require('@playwright/test');
const { AuthManager } = require('../utils/auth-manager');
const { TestDatabaseManager } = require('../utils/db-manager');

// Test user with verification level 3 (required for DID creation)
const VERIFIED_USER = {
  email: 'verifier@example.com',
  password: 'Password123!'
};

test.describe('DID Management Flow', () => {
  const authManager = new AuthManager();
  const dbManager = new TestDatabaseManager();
  
  test.beforeAll(async () => {
    // Initialize and seed test database
    await dbManager.initTestDb();
    await dbManager.seedTestData();
  });
  
  test.beforeEach(async ({ page }) => {
    // Log in as a verified user
    await page.goto('/login');
    await page.fill('input[name="email"]', VERIFIED_USER.email);
    await page.fill('input[name="password"]', VERIFIED_USER.password);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await expect(page).toHaveURL(/.*dashboard/);
  });
  
  test('should create a new DID document', async ({ page }) => {
    // Navigate to DID management section
    await page.click('a:has-text("Identity")');
    await expect(page).toHaveURL(/.*identity/);
    
    // Click "Create New DID" button
    await page.click('button:has-text("Create New DID")');
    
    // Wait for DID creation form/modal
    await expect(page.locator('.did-creation-form')).toBeVisible();
    
    // Add optional service endpoints (if the form allows it)
    await page.click('button:has-text("Add Service Endpoint")');
    await page.fill('input[name="service-type"]', 'ProofOfHumanityProfile');
    await page.fill('input[name="service-endpoint"]', 'https://poh.io/profile/test');
    
    // Submit the form
    await page.click('button:has-text("Create DID")');
    
    // Check for success message
    await expect(page.locator('.success-message')).toBeVisible();
    await expect(page.locator('.success-message')).toContainText('DID created successfully');
    
    // Check that the DID document is displayed
    await expect(page.locator('.did-document')).toBeVisible();
    await expect(page.locator('.did-document')).toContainText('did:poh:');
    
    // Verify that the DID is compliant with the standard format
    const didText = await page.locator('.did-identifier').textContent();
    expect(didText).toMatch(/^did:poh:[a-zA-Z0-9]+$/);
  });
  
  test('should allow exporting the DID document', async ({ page }) => {
    // Navigate to DID management section
    await page.click('a:has-text("Identity")');
    
    // Click "Export DID" button
    await page.click('button:has-text("Export DID")');
    
    // Check for download dialog
    await expect(page.locator('.export-options')).toBeVisible();
    
    // Select JSON format
    await page.click('input[value="json"]');
    
    // Click download
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download")');
    
    // Wait for download to start
    const download = await downloadPromise;
    
    // Verify filename contains DID
    expect(download.suggestedFilename()).toContain('did');
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });
  
  test('should allow signing and verifying data with DID', async ({ page }) => {
    // Navigate to DID management section
    await page.click('a:has-text("Identity")');
    
    // Click "Sign Data" button
    await page.click('button:has-text("Sign Data")');
    
    // Wait for signing interface
    await expect(page.locator('.signing-interface')).toBeVisible();
    
    // Input data to sign
    const dataToSign = 'This is a test message for DID signing.';
    await page.fill('textarea[name="data-to-sign"]', dataToSign);
    
    // Click sign button
    await page.click('button:has-text("Sign Data")');
    
    // Check for signature output
    await expect(page.locator('.signature-output')).toBeVisible();
    
    // Get the signature
    const signature = await page.locator('.signature-value').textContent();
    expect(signature).toBeTruthy();
    
    // Now verify the signature
    await page.click('a:has-text("Verify Signature")');
    
    // Input original data and signature
    await page.fill('textarea[name="original-data"]', dataToSign);
    await page.fill('textarea[name="signature"]', signature);
    
    // Add the DID (in a real app, this might be auto-filled)
    const didValue = await page.locator('.did-identifier').textContent();
    await page.fill('input[name="did"]', didValue);
    
    // Click verify button
    await page.click('button:has-text("Verify Signature")');
    
    // Check for verification success
    await expect(page.locator('.verification-result')).toBeVisible();
    await expect(page.locator('.verification-result')).toContainText('Signature verified successfully');
  });
  
  test('should resolve a DID to get its document', async ({ page }) => {
    // Navigate to DID resolution section
    await page.click('a:has-text("Identity")');
    await page.click('a:has-text("Resolve DID")');
    
    // Wait for resolution interface
    await expect(page.locator('.did-resolution-form')).toBeVisible();
    
    // Get the user's own DID to resolve
    const didText = await page.locator('.did-identifier').textContent();
    
    // Input DID to resolve
    await page.fill('input[name="did-to-resolve"]', didText);
    
    // Click resolve button
    await page.click('button:has-text("Resolve DID")');
    
    // Check for resolution result
    await expect(page.locator('.resolution-result')).toBeVisible();
    await expect(page.locator('.resolution-result')).toContainText(didText);
    
    // Check that the document contains the expected sections
    await expect(page.locator('.resolution-result')).toContainText('@context');
    await expect(page.locator('.resolution-result')).toContainText('verificationMethod');
    await expect(page.locator('.resolution-result')).toContainText('authentication');
  });
  
  test.afterAll(async () => {
    // Clean up - we're not clearing the database here because
    // these tests rely on seeded data
  });
}); 