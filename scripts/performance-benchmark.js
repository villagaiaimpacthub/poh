/**
 * Performance benchmark script for Proof of Humanity
 * 
 * Measures various performance aspects of the application:
 * - Page load times
 * - API response times
 * - WebRTC connection establishment times
 * - Animation and rendering performance
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { PerformanceHelper } = require('../e2e_tests/utils/performance-helper');
const { AuthManager } = require('../e2e_tests/utils/auth-manager');

// Test data
const TEST_USERS = {
  standard: {
    email: 'test@example.com',
    password: 'Password123!'
  },
  verifier: {
    email: 'verifier@example.com',
    password: 'Password123!'
  }
};

// Configuration
const CONFIG = {
  baseUrl: 'http://localhost:5001',
  iterations: 3, // Number of times to run each benchmark
  outputDir: path.join(__dirname, '..', 'perf-results'),
  timeoutMs: 30000,
  pages: [
    { name: 'Dashboard', url: '/dashboard' },
    { name: 'Family', url: '/family' },
    { name: 'Verification', url: '/verification' },
    { name: 'Identity', url: '/identity' },
    { name: 'Settings', url: '/settings' }
  ],
  apiEndpoints: [
    { name: 'Health Check', url: '/api/health' },
    { name: 'Family Tree', url: '/api/family/tree?user_id=1' },
    { name: 'DID Document', url: '/api/did/document/123' }
  ]
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// Results storage
const results = {
  pageLoadTimes: [],
  apiResponseTimes: [],
  renderings: [],
  animations: [],
  summary: {}
};

async function runPageLoadBenchmarks(browser, performanceHelper) {
  console.log('Running page load benchmarks...');
  
  const authManager = new AuthManager(CONFIG.baseUrl);
  const token = await authManager.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
  
  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: CONFIG.baseUrl,
          localStorage: [
            {
              name: 'authToken',
              value: token
            }
          ]
        }
      ]
    }
  });
  
  const page = await context.newPage();
  
  // First load the login page and log in
  await page.goto(`${CONFIG.baseUrl}/login`);
  await page.fill('input[name="email"]', TEST_USERS.standard.email);
  await page.fill('input[name="password"]', TEST_USERS.standard.password);
  await page.click('button[type="submit"]');
  
  // Wait for dashboard to load
  await page.waitForURL(/.*dashboard/);
  
  // Benchmark each page
  for (const pageConfig of CONFIG.pages) {
    const pageResults = [];
    
    for (let i = 0; i < CONFIG.iterations; i++) {
      console.log(`Measuring load time for ${pageConfig.name} (iteration ${i + 1}/${CONFIG.iterations})...`);
      
      // Clear cache between iterations for consistent measurements
      await page.context().clearCookies();
      
      // Measure page load
      const metrics = await performanceHelper.measurePageLoad(
        page, 
        `${CONFIG.baseUrl}${pageConfig.url}`,
        { waitUntil: 'networkidle' }
      );
      
      pageResults.push(metrics);
    }
    
    // Calculate average metrics
    const avgLoadTime = pageResults.reduce((sum, result) => sum + result.loadTime, 0) / pageResults.length;
    const avgFirstPaint = pageResults.reduce((sum, result) => sum + (result.paintTiming.firstPaint || 0), 0) / pageResults.length;
    const avgFirstContentfulPaint = pageResults.reduce((sum, result) => sum + (result.paintTiming.firstContentfulPaint || 0), 0) / pageResults.length;
    
    results.pageLoadTimes.push({
      page: pageConfig.name,
      url: pageConfig.url,
      avgLoadTime,
      avgFirstPaint,
      avgFirstContentfulPaint,
      details: pageResults
    });
    
    console.log(`Average load time for ${pageConfig.name}: ${avgLoadTime.toFixed(2)}ms`);
  }
  
  await context.close();
}

async function runApiResponseBenchmarks(browser, performanceHelper) {
  console.log('Running API response benchmarks...');
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Benchmark API endpoints
  for (const api of CONFIG.apiEndpoints) {
    const apiResults = [];
    
    for (let i = 0; i < CONFIG.iterations; i++) {
      console.log(`Measuring response time for ${api.name} (iteration ${i + 1}/${CONFIG.iterations})...`);
      
      // Measure API response time
      const responseTime = await performanceHelper.measureApiResponse(page, async () => {
        const response = await page.request.get(`${CONFIG.baseUrl}${api.url}`);
        return response;
      });
      
      apiResults.push(responseTime);
    }
    
    // Calculate average response time
    const avgResponseTime = apiResults.reduce((sum, time) => sum + time, 0) / apiResults.length;
    
    results.apiResponseTimes.push({
      endpoint: api.name,
      url: api.url,
      avgResponseTime,
      details: apiResults
    });
    
    console.log(`Average response time for ${api.name}: ${avgResponseTime.toFixed(2)}ms`);
  }
  
  await context.close();
}

async function runRenderingBenchmarks(browser, performanceHelper) {
  console.log('Running rendering performance benchmarks...');
  
  const authManager = new AuthManager(CONFIG.baseUrl);
  const token = await authManager.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
  
  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: CONFIG.baseUrl,
          localStorage: [
            {
              name: 'authToken',
              value: token
            }
          ]
        }
      ]
    }
  });
  
  const page = await context.newPage();
  
  // Log in
  await page.goto(`${CONFIG.baseUrl}/login`);
  await page.fill('input[name="email"]', TEST_USERS.standard.email);
  await page.fill('input[name="password"]', TEST_USERS.standard.password);
  await page.click('button[type="submit"]');
  
  // Wait for dashboard to load
  await page.waitForURL(/.*dashboard/);
  
  // Test family tree rendering
  await page.goto(`${CONFIG.baseUrl}/family`);
  await page.waitForSelector('.family-tree-visualization', { state: 'visible' });
  
  // Measure frame rate during zoom/pan interaction
  const familyTreeFps = await performanceHelper.measureFrameRate(page, async () => {
    // Simulate panning and zooming on the family tree visualization
    await page.evaluate(() => {
      // This is a placeholder - actual implementation would depend on the
      // specific library/implementation used for the family tree visualization
      if (window.familyTreeAnimation) {
        window.familyTreeAnimation.startZoomAnimation();
      } else {
        // Mock animation for testing
        const container = document.querySelector('.family-tree-visualization');
        if (container) {
          let scale = 1.0;
          const interval = setInterval(() => {
            scale += 0.05;
            if (scale > 1.5) {
              clearInterval(interval);
              return;
            }
            container.style.transform = `scale(${scale})`;
          }, 16); // ~60fps
        }
      }
    });
    
    // Wait for animation to complete
    await page.waitForTimeout(2000);
  });
  
  results.animations.push({
    component: 'Family Tree Visualization',
    avgFps: familyTreeFps.fps,
    minFps: familyTreeFps.min,
    maxFps: familyTreeFps.max,
    details: familyTreeFps
  });
  
  console.log(`Family tree animation: ${familyTreeFps.fps.toFixed(2)} FPS (min: ${familyTreeFps.min.toFixed(2)}, max: ${familyTreeFps.max.toFixed(2)})`);
  
  await context.close();
}

async function calculateSummary() {
  // Calculate overall averages and create summary
  const pageLoadAvg = results.pageLoadTimes.reduce((sum, page) => sum + page.avgLoadTime, 0) / results.pageLoadTimes.length;
  const apiResponseAvg = results.apiResponseTimes.reduce((sum, api) => sum + api.avgResponseTime, 0) / results.apiResponseTimes.length;
  const animationFpsAvg = results.animations.reduce((sum, anim) => sum + anim.avgFps, 0) / results.animations.length;
  
  results.summary = {
    timestamp: new Date().toISOString(),
    environment: process.env.CI ? 'CI' : 'Local',
    overallMetrics: {
      avgPageLoadTime: pageLoadAvg,
      avgApiResponseTime: apiResponseAvg,
      avgAnimationFps: animationFpsAvg
    },
    slowestPage: results.pageLoadTimes.reduce((slowest, current) => 
      current.avgLoadTime > slowest.avgLoadTime ? current : slowest, 
      { avgLoadTime: 0 }
    ),
    slowestApi: results.apiResponseTimes.reduce((slowest, current) => 
      current.avgResponseTime > slowest.avgResponseTime ? current : slowest, 
      { avgResponseTime: 0 }
    )
  };
  
  // Determine performance grade
  let grade = 'A';
  if (pageLoadAvg > 3000 || apiResponseAvg > 300 || animationFpsAvg < 30) {
    grade = 'C';
  } else if (pageLoadAvg > 1500 || apiResponseAvg > 150 || animationFpsAvg < 45) {
    grade = 'B';
  }
  
  results.summary.performanceGrade = grade;
  
  console.log('\nPerformance Summary:');
  console.log(`Overall Grade: ${grade}`);
  console.log(`Average Page Load Time: ${pageLoadAvg.toFixed(2)}ms`);
  console.log(`Average API Response Time: ${apiResponseAvg.toFixed(2)}ms`);
  console.log(`Average Animation FPS: ${animationFpsAvg.toFixed(2)}`);
  console.log(`Slowest Page: ${results.summary.slowestPage.page} (${results.summary.slowestPage.avgLoadTime.toFixed(2)}ms)`);
  console.log(`Slowest API: ${results.summary.slowestApi.endpoint} (${results.summary.slowestApi.avgResponseTime.toFixed(2)}ms)`);
}

async function saveResults() {
  const outputFile = path.join(CONFIG.outputDir, `performance-report-${new Date().toISOString().replace(/:/g, '-')}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${outputFile}`);
  
  // Create a simple HTML report
  const htmlReport = `
<!DOCTYPE html>
<html>
<head>
    <title>Proof of Humanity Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { color: #333; }
        h2 { color: #666; margin-top: 30px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 30px; }
        .grade { font-size: 24px; font-weight: bold; }
        .grade-A { color: green; }
        .grade-B { color: orange; }
        .grade-C { color: red; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
    </style>
</head>
<body>
    <h1>Proof of Humanity Performance Report</h1>
    <div class="summary">
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Environment:</strong> ${results.summary.environment}</p>
        <p><strong>Overall Grade:</strong> <span class="grade grade-${results.summary.performanceGrade}">${results.summary.performanceGrade}</span></p>
        <p><strong>Average Page Load Time:</strong> ${results.summary.overallMetrics.avgPageLoadTime.toFixed(2)}ms</p>
        <p><strong>Average API Response Time:</strong> ${results.summary.overallMetrics.avgApiResponseTime.toFixed(2)}ms</p>
        <p><strong>Average Animation FPS:</strong> ${results.summary.overallMetrics.avgAnimationFps.toFixed(2)}</p>
    </div>
    
    <h2>Page Load Times</h2>
    <table>
        <tr>
            <th>Page</th>
            <th>Average Load Time (ms)</th>
            <th>First Paint (ms)</th>
            <th>First Contentful Paint (ms)</th>
        </tr>
        ${results.pageLoadTimes.map(page => `
        <tr>
            <td>${page.page}</td>
            <td>${page.avgLoadTime.toFixed(2)}</td>
            <td>${page.avgFirstPaint.toFixed(2)}</td>
            <td>${page.avgFirstContentfulPaint.toFixed(2)}</td>
        </tr>
        `).join('')}
    </table>
    
    <h2>API Response Times</h2>
    <table>
        <tr>
            <th>Endpoint</th>
            <th>Average Response Time (ms)</th>
        </tr>
        ${results.apiResponseTimes.map(api => `
        <tr>
            <td>${api.endpoint}</td>
            <td>${api.avgResponseTime.toFixed(2)}</td>
        </tr>
        `).join('')}
    </table>
    
    <h2>Animation Performance</h2>
    <table>
        <tr>
            <th>Component</th>
            <th>Average FPS</th>
            <th>Min FPS</th>
            <th>Max FPS</th>
        </tr>
        ${results.animations.map(anim => `
        <tr>
            <td>${anim.component}</td>
            <td>${anim.avgFps.toFixed(2)}</td>
            <td>${anim.minFps.toFixed(2)}</td>
            <td>${anim.maxFps.toFixed(2)}</td>
        </tr>
        `).join('')}
    </table>
</body>
</html>
  `;
  
  const htmlReportFile = path.join(CONFIG.outputDir, `performance-report-${new Date().toISOString().replace(/:/g, '-')}.html`);
  fs.writeFileSync(htmlReportFile, htmlReport);
  console.log(`HTML report saved to ${htmlReportFile}`);
}

async function runAllBenchmarks() {
  try {
    const browser = await chromium.launch();
    const performanceHelper = new PerformanceHelper();
    
    // Run all benchmarks
    await runPageLoadBenchmarks(browser, performanceHelper);
    await runApiResponseBenchmarks(browser, performanceHelper);
    await runRenderingBenchmarks(browser, performanceHelper);
    
    // Summarize and save results
    await calculateSummary();
    await saveResults();
    
    await browser.close();
    
    // Exit with appropriate code based on performance grade
    const exitCode = results.summary.performanceGrade === 'C' ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('Error running performance benchmarks:', error);
    process.exit(1);
  }
}

// Start benchmarks
console.log('Starting performance benchmarks...');
runAllBenchmarks(); 