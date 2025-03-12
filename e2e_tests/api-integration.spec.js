// @ts-check
const { test, expect } = require('@playwright/test');
const { AuthManager } = require('./utils/auth-manager');
const { TestDatabaseManager } = require('./utils/db-manager');
const { PerformanceHelper } = require('./utils/performance-helper');

test.describe('API Integration Tests', () => {
  const authManager = new AuthManager();
  const dbManager = new TestDatabaseManager();
  let performanceHelper;
  
  test.beforeAll(async () => {
    // Initialize and seed test database
    await dbManager.initTestDb();
    await dbManager.seedTestData();
  });
  
  test.beforeEach(async ({ page }) => {
    performanceHelper = new PerformanceHelper();
  });
  
  test('should retrieve family tree data through API', async ({ page, request }) => {
    // Login via API to get auth token
    const token = await authManager.login('test@example.com', 'Password123!');
    
    // Use the auth token for API requests
    const response = await request.get('/api/family/tree', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Verify response is successful
    expect(response.ok()).toBeTruthy();
    
    // Verify response data structure
    const data = await response.json();
    expect(data).toHaveProperty('nodes');
    expect(data).toHaveProperty('links');
    expect(Array.isArray(data.nodes)).toBeTruthy();
    expect(Array.isArray(data.links)).toBeTruthy();
    
    // Verify nodes contain expected properties
    if (data.nodes.length > 0) {
      expect(data.nodes[0]).toHaveProperty('id');
      expect(data.nodes[0]).toHaveProperty('name');
      expect(data.nodes[0]).toHaveProperty('verified');
    }
    
    // Measure API response time
    const responseTime = await performanceHelper.measureApiResponse(page, async () => {
      await request.get('/api/family/tree', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    });
    
    // Verify the API response time is acceptable
    console.log(`Family tree API response time: ${responseTime}ms`);
    expect(responseTime).toBeLessThan(500); // 500ms is our performance benchmark
  });
  
  test('should handle verification requests through API', async ({ request }) => {
    // Login via API to get auth token
    const token = await authManager.login('test@example.com', 'Password123!');
    
    // Create a verification request through API
    const createResponse = await request.post('/api/verification/request', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        verification_type: 'document',
        evidence: {
          document_type: 'id_card',
          issuance_date: '2020-01-01'
        }
      }
    });
    
    // Verify response is successful
    expect(createResponse.ok()).toBeTruthy();
    
    // Verify response data structure
    const createData = await createResponse.json();
    expect(createData).toHaveProperty('id');
    expect(createData).toHaveProperty('status', 'pending');
    
    // Get verification requests through API
    const getResponse = await request.get('/api/verification/requests', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Verify response is successful
    expect(getResponse.ok()).toBeTruthy();
    
    // Verify response data contains our request
    const getData = await getResponse.json();
    expect(Array.isArray(getData)).toBeTruthy();
    
    // Find our verification request
    const ourRequest = getData.find(req => req.id === createData.id);
    expect(ourRequest).toBeDefined();
    expect(ourRequest).toHaveProperty('verification_type', 'document');
  });
  
  test('should handle DID operations through API', async ({ request }) => {
    // Login via API as a verified user
    const token = await authManager.login('verifier@example.com', 'Password123!');
    
    // Create a DID document through API
    const createResponse = await request.post('/api/did/document', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        publicKey: 'testAPIPublicKey123',
        service: [
          {
            id: '#test-service',
            type: 'TestService',
            serviceEndpoint: 'https://test.example.com'
          }
        ]
      }
    });
    
    // Verify response is successful
    expect(createResponse.ok()).toBeTruthy();
    
    // Verify response data structure
    const createData = await createResponse.json();
    expect(createData).toHaveProperty('id');
    expect(createData.id).toMatch(/^did:poh:/);
    expect(createData).toHaveProperty('verificationMethod');
    
    // Extract DID identifier
    const didId = createData.id.split(':')[2];
    
    // Resolve the DID through API
    const resolveResponse = await request.get(`/api/did/resolve/did:poh:${didId}`);
    
    // Verify response is successful
    expect(resolveResponse.ok()).toBeTruthy();
    
    // Verify response data contains our DID document
    const resolveData = await resolveResponse.json();
    expect(resolveData).toHaveProperty('didDocument');
    expect(resolveData.didDocument).toHaveProperty('id', `did:poh:${didId}`);
  });
  
  test('should handle WebSocket connections for video calls', async ({ page }) => {
    // Navigate to the verification page
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    // Go to verification page
    await page.goto('/verification');
    
    // Start a video call
    await page.click('button:has-text("Start Video Call")');
    
    // Capture WebSocket events
    let wsConnected = false;
    let wsMessages = [];
    
    page.on('websocket', ws => {
      wsConnected = true;
      
      ws.on('framesent', event => {
        wsMessages.push(event.payload);
      });
      
      ws.on('framereceived', event => {
        wsMessages.push(event.payload);
      });
    });
    
    // Wait for WebSocket to be established and verify its status
    await page.waitForFunction(() => window.webSocketConnected === true, { timeout: 5000 })
      .catch(() => {
        // If the timeout is reached, we'll consider this a failure
        expect(wsConnected).toBeTruthy();
      });
    
    // Send a test message through WebSocket
    await page.evaluate(() => {
      window.sendWebSocketMessage({ type: 'test', content: 'Hello WebSocket' });
    });
    
    // Wait for the message to be sent and received
    await page.waitForFunction(() => window.lastWebSocketMessage !== null, { timeout: 5000 });
    
    // Verify messages were exchanged
    expect(wsMessages.length).toBeGreaterThan(0);
    
    // Verify we can close the WebSocket properly
    await page.click('button:has-text("End Call")');
    
    // Wait for WebSocket to be closed
    await page.waitForFunction(() => window.webSocketConnected === false, { timeout: 5000 });
  });
  
  test.afterAll(async () => {
    // Clean up
    await dbManager.clearTestData();
  });
}); 