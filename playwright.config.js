// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for Proof of Humanity E2E testing
 * Optimized for M2 Mac architecture
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './e2e_tests',
  
  // Maximum time one test can run for
  timeout: 30 * 1000,
  
  // Run tests in parallel - optimized for M2 cores
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  
  // Reporter to use
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL to use in navigation - modify to match your local server
    baseURL: 'http://localhost:5001',
    
    // Collect trace when retrying a failed test
    trace: 'on-first-retry',
    
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'on-first-retry',
  },
  
  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Test for mobile viewports
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
    
    // Visual testing project with specific configuration
    {
      name: 'visual-tests',
      testDir: './e2e_tests/visual',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },
  ],
  
  // Local development server options
  webServer: {
    command: 'source venv/bin/activate && PORT=5001 python app.py',
    port: 5001,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
}); 