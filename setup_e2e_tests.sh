#!/bin/bash
# Setup script for E2E testing in Proof of Humanity
# Optimized for M2 Mac architecture

echo "Setting up E2E testing environment for Proof of Humanity..."

# Ensure we're in the project root
cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is required but not installed. Please install Node.js first."
    exit 1
fi

# Create a package.json if it doesn't exist
if [ ! -f package.json ]; then
    echo "Creating package.json..."
    cat > package.json << EOF
{
  "name": "poh-e2e-tests",
  "version": "1.0.0",
  "description": "E2E tests for Proof of Humanity",
  "scripts": {
    "test": "playwright test",
    "test:chromium": "playwright test --project=chromium",
    "test:firefox": "playwright test --project=firefox",
    "test:webkit": "playwright test --project=webkit",
    "test:mobile": "playwright test --project=mobile-chrome --project=mobile-safari",
    "test:visual": "playwright test --project=visual-tests",
    "report": "playwright show-report",
    "update-snapshots": "playwright test --update-snapshots"
  },
  "keywords": [
    "testing",
    "e2e",
    "playwright"
  ],
  "engines": {
    "node": ">=14.0.0"
  }
}
EOF
fi

# Install dependencies
echo "Installing Playwright and dependencies..."
npm install -D @playwright/test@latest
npm install -D axe-playwright@1.2.2 pixelmatch@5.3.0 pngjs@6.0.0

# Install Playwright browsers (optimized for M2)
echo "Installing Playwright browsers..."
npx playwright install --with-deps chromium firefox webkit

# Create setup and teardown utilities
echo "Creating test utility files..."

mkdir -p e2e_tests/utils

# Create a test database manager
cat > e2e_tests/utils/db-manager.js << EOF
/**
 * Database manager for E2E tests
 * Handles test database setup and teardown
 */
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class TestDatabaseManager {
  constructor() {
    this.testDbPath = path.join(process.cwd(), 'instance', 'test_poh.sqlite');
  }

  /**
   * Initialize a fresh test database
   */
  async initTestDb() {
    try {
      // Remove existing test DB if it exists
      if (fs.existsSync(this.testDbPath)) {
        fs.unlinkSync(this.testDbPath);
      }
      
      // Make sure the instance directory exists
      const instanceDir = path.dirname(this.testDbPath);
      if (!fs.existsSync(instanceDir)) {
        fs.mkdirSync(instanceDir, { recursive: true });
      }
      
      // Run schema initialization in Python
      const command = \`source venv/bin/activate && DATABASE_URI=sqlite:///instance/test_poh.sqlite python -c "
import os
os.environ['DATABASE_URI'] = 'sqlite:///instance/test_poh.sqlite'
from app import create_app
app = create_app()
with app.app_context():
    from models.database import Database
    db = Database(app.config['DATABASE_URI'])
    schema_path = os.path.join(os.path.dirname(os.path.abspath('__file__')), 'schema.sql')
    db.init_db(schema_path)
    print('Test database initialized')
"\`;

      const { stdout, stderr } = await execPromise(command);
      console.log('Database initialization:', stdout);
      if (stderr) console.error('Error:', stderr);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize test database:', error);
      return false;
    }
  }

  /**
   * Seed the test database with fixture data
   */
  async seedTestData() {
    try {
      // Run seed script in Python
      const command = \`source venv/bin/activate && DATABASE_URI=sqlite:///instance/test_poh.sqlite python e2e_tests/fixtures/seed_data.py\`;
      
      const { stdout, stderr } = await execPromise(command);
      console.log('Database seeding:', stdout);
      if (stderr) console.error('Error:', stderr);
      
      return true;
    } catch (error) {
      console.error('Failed to seed test database:', error);
      return false;
    }
  }
  
  /**
   * Clear all data in the test database
   */
  async clearTestData() {
    try {
      if (fs.existsSync(this.testDbPath)) {
        fs.unlinkSync(this.testDbPath);
        console.log('Test database cleared');
      }
      return true;
    } catch (error) {
      console.error('Failed to clear test database:', error);
      return false;
    }
  }
}

module.exports = { TestDatabaseManager };
EOF

# Create authentication manager for tests
cat > e2e_tests/utils/auth-manager.js << EOF
/**
 * Authentication manager for E2E tests
 * Handles login, registration, and token management
 */
const { request } = require('@playwright/test');

class AuthManager {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || 'http://localhost:5001';
    this.tokens = new Map();
  }

  /**
   * Log in a user and store their authentication token
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} userId - Optional user ID for reference
   */
  async login(email, password, userId = email) {
    const apiContext = await request.newContext({
      baseURL: this.apiUrl,
    });

    const response = await apiContext.post('/api/auth/login', {
      data: {
        email,
        password
      }
    });

    if (response.ok()) {
      const data = await response.json();
      this.tokens.set(userId, data.token);
      return data.token;
    } else {
      throw new Error(\`Login failed: \${response.status()} \${await response.text()}\`);
    }
  }

  /**
   * Register a new user
   * @param {string} name - User name
   * @param {string} email - User email
   * @param {string} password - User password
   */
  async register(name, email, password) {
    const apiContext = await request.newContext({
      baseURL: this.apiUrl,
    });

    const response = await apiContext.post('/api/auth/register', {
      data: {
        name,
        email,
        password
      }
    });

    if (response.ok()) {
      return await response.json();
    } else {
      throw new Error(\`Registration failed: \${response.status()} \${await response.text()}\`);
    }
  }

  /**
   * Get stored token for a user
   * @param {string} userId - User identifier
   */
  getToken(userId) {
    return this.tokens.get(userId);
  }

  /**
   * Apply authentication to a page by setting cookies or localStorage
   * @param {Page} page - Playwright page
   * @param {string} userId - User identifier
   */
  async applyAuth(page, userId) {
    const token = this.getToken(userId);
    if (!token) {
      throw new Error(\`No token found for user: \${userId}\`);
    }

    await page.evaluate((authToken) => {
      localStorage.setItem('authToken', authToken);
    }, token);
  }
}

module.exports = { AuthManager };
EOF

# Create visual testing helper
cat > e2e_tests/utils/visual-test-helper.js << EOF
/**
 * Visual testing helper for E2E tests
 * Handles screenshot comparison and visual regression testing
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const { expect } = require('@playwright/test');

class VisualTestHelper {
  constructor(testInfo) {
    this.testInfo = testInfo;
    this.snapshotsDir = path.join(process.cwd(), 'e2e_tests', 'visual', 'snapshots');
    
    // Create snapshots directory if it doesn't exist
    if (!fs.existsSync(this.snapshotsDir)) {
      fs.mkdirSync(this.snapshotsDir, { recursive: true });
    }
  }

  /**
   * Compare the current page/element with a baseline screenshot
   * @param {Page|ElementHandle} target - Playwright page or element
   * @param {string} name - Screenshot name
   * @param {object} options - Screenshot options
   */
  async compareScreenshot(target, name, options = {}) {
    const screenshotPath = path.join(this.testInfo.outputDir, \`\${name}.png\`);
    const baselinePath = path.join(this.snapshotsDir, \`\${name}.png\`);
    const diffPath = path.join(this.testInfo.outputDir, \`\${name}-diff.png\`);
    
    // Take a screenshot
    await target.screenshot({ path: screenshotPath, ...options });
    
    // If update mode or baseline doesn't exist, update the baseline
    if (process.env.UPDATE_SNAPSHOTS === 'true' || !fs.existsSync(baselinePath)) {
      fs.copyFileSync(screenshotPath, baselinePath);
      return true;
    }
    
    // Compare screenshots
    const img1 = PNG.sync.read(fs.readFileSync(screenshotPath));
    const img2 = PNG.sync.read(fs.readFileSync(baselinePath));
    
    const { width, height } = img1;
    const diff = new PNG({ width, height });
    
    const threshold = options.threshold || 0.1; // Default threshold
    const mismatchedPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      width,
      height,
      { threshold }
    );
    
    // Calculate mismatch percentage
    const totalPixels = width * height;
    const mismatchPercentage = (mismatchedPixels / totalPixels) * 100;
    
    // Generate diff image if there's a mismatch
    if (mismatchedPixels > 0) {
      fs.writeFileSync(diffPath, PNG.sync.write(diff));
    }
    
    // Define acceptable threshold (e.g., 0.5% difference is acceptable)
    const acceptableThreshold = options.acceptableThreshold || 0.5;
    
    // Check if the difference is acceptable
    const result = mismatchPercentage <= acceptableThreshold;
    
    // Use Playwright's expect to report the test result
    expect(result, 
      \`Visual comparison failed for \${name}: \${mismatchPercentage.toFixed(2)}% different\`).toBeTruthy();
    
    return result;
  }
}

module.exports = { VisualTestHelper };
EOF

# Create accessibility testing helper
cat > e2e_tests/utils/accessibility-helper.js << EOF
/**
 * Accessibility testing helper for E2E tests
 * Uses axe-core via axe-playwright
 */
const { AxeBuilder } = require('axe-playwright');
const { expect } = require('@playwright/test');

class AccessibilityHelper {
  /**
   * Run accessibility audit on a page
   * @param {Page} page - Playwright page
   * @param {object} options - Axe options
   */
  async audit(page, options = {}) {
    const axeBuilder = new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[aria-hidden="true"]'); // Exclude hidden elements
    
    // Apply custom options if provided
    if (options.include) axeBuilder.include(options.include);
    if (options.exclude) axeBuilder.exclude(options.exclude);
    if (options.rules) axeBuilder.disableRules(options.rules);
    
    // Run the audit
    const results = await axeBuilder.analyze();
    
    // Check if there are any violations
    expect(results.violations, 
      \`Found \${results.violations.length} accessibility violations:\n\${JSON.stringify(results.violations, null, 2)}\`
    ).toHaveLength(0);
    
    return results;
  }
  
  /**
   * Check keyboard navigation on page
   * @param {Page} page - Playwright page
   * @param {Array} elements - Selector strings for focusable elements in order
   */
  async checkKeyboardNavigation(page, elements) {
    // Start by focusing on the first element or the body
    await page.focus(elements[0] || 'body');
    
    // Check each element in sequence
    for (let i = 0; i < elements.length; i++) {
      // Press Tab to move to the next element
      await page.keyboard.press('Tab');
      
      // Get the focused element
      const focusedElement = await page.evaluate(() => document.activeElement.outerHTML);
      
      // Check if the right element is focused
      const isFocused = await page.evaluate((selector) => {
        const element = document.activeElement;
        const target = document.querySelector(selector);
        return element === target;
      }, elements[i]);
      
      expect(isFocused, 
        \`Expected element \${elements[i]} to receive focus after Tab key press\`).toBeTruthy();
    }
  }
}

module.exports = { AccessibilityHelper };
EOF

# Create performance testing helper
cat > e2e_tests/utils/performance-helper.js << EOF
/**
 * Performance testing helper for E2E tests
 * Measures timing metrics and performance benchmarks
 */
class PerformanceHelper {
  /**
   * Measure page load time
   * @param {Page} page - Playwright page
   * @param {string} url - URL to navigate to
   * @param {object} options - Options
   * @returns {object} Timing metrics
   */
  async measurePageLoad(page, url, options = {}) {
    // Enable JS performance timeline
    await page.evaluate(() => {
      window.performance.setResourceTimingBufferSize(500);
      window.performanceMetrics = [];
    });
    
    // Set up performance observer
    await page.evaluate(() => {
      const observer = new PerformanceObserver((list) => {
        window.performanceMetrics.push(...list.getEntries());
      });
      observer.observe({ entryTypes: ['navigation', 'resource', 'paint', 'mark', 'measure'] });
    });
    
    // Navigate to the URL and wait for load event
    const startTime = Date.now();
    const response = await page.goto(url, { 
      waitUntil: options.waitUntil || 'networkidle',
      timeout: options.timeout || 30000
    });
    const loadTime = Date.now() - startTime;
    
    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const navigationEntry = performance.getEntriesByType('navigation')[0];
      const paintEntries = performance.getEntriesByType('paint');
      
      return {
        navigationTiming: navigationEntry ? {
          domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.startTime,
          load: navigationEntry.loadEventEnd - navigationEntry.startTime,
          domInteractive: navigationEntry.domInteractive - navigationEntry.startTime,
          firstByte: navigationEntry.responseStart - navigationEntry.startTime,
        } : {},
        paintTiming: {
          firstPaint: paintEntries.find(entry => entry.name === 'first-paint')?.startTime,
          firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime,
        },
        resources: {
          count: window.performanceMetrics.filter(entry => entry.entryType === 'resource').length,
          size: window.performanceMetrics
            .filter(entry => entry.entryType === 'resource')
            .reduce((total, entry) => total + (entry.transferSize || 0), 0) / 1024
        },
        totalTime: performance.now()
      };
    });
    
    return {
      url,
      statusCode: response?.status(),
      loadTime,
      ...metrics
    };
  }
  
  /**
   * Measure API response time
   * @param {Page} page - Playwright page
   * @param {string} apiCall - Function to execute that makes the API call
   * @returns {number} Response time in ms
   */
  async measureApiResponse(page, apiCall) {
    // Create a unique marker name
    const markerStart = \`api-call-start-\${Date.now()}\`;
    const markerEnd = \`api-call-end-\${Date.now()}\`;
    
    // Start timing
    await page.evaluate((marker) => {
      performance.mark(marker);
    }, markerStart);
    
    // Execute the API call
    await apiCall();
    
    // End timing
    await page.evaluate((marker) => {
      performance.mark(marker);
    }, markerEnd);
    
    // Measure and return the duration
    const duration = await page.evaluate((start, end) => {
      performance.measure('apiCallDuration', start, end);
      const measure = performance.getEntriesByName('apiCallDuration')[0];
      return measure.duration;
    }, markerStart, markerEnd);
    
    return duration;
  }
  
  /**
   * Measure frame rate during an interaction
   * @param {Page} page - Playwright page
   * @param {Function} interaction - Function to execute that triggers animation
   * @returns {object} Frame rate metrics
   */
  async measureFrameRate(page, interaction) {
    // Setup FPS monitoring
    await page.evaluate(() => {
      window.frames = [];
      window.lastFrameTime = performance.now();
      
      window.frameObserver = () => {
        const now = performance.now();
        const elapsed = now - window.lastFrameTime;
        window.frames.push(elapsed);
        window.lastFrameTime = now;
        window.requestAnimationFrame(window.frameObserver);
      };
      
      window.requestAnimationFrame(window.frameObserver);
    });
    
    // Run the interaction
    await interaction();
    
    // Stop monitoring and collect results
    const frameMetrics = await page.evaluate(() => {
      window.cancelAnimationFrame(window.frameObserver);
      
      const frameTimes = window.frames;
      if (frameTimes.length === 0) return { fps: 0, min: 0, max: 0, avg: 0 };
      
      // Calculate FPS and other metrics
      const fpsList = frameTimes.map(time => 1000 / time);
      const avg = fpsList.reduce((sum, fps) => sum + fps, 0) / fpsList.length;
      const min = Math.min(...fpsList);
      const max = Math.max(...fpsList);
      
      return {
        fps: avg,
        min,
        max,
        framesCollected: frameTimes.length
      };
    });
    
    return frameMetrics;
  }
}

module.exports = { PerformanceHelper };
EOF

# Create seed data for the test database
mkdir -p e2e_tests/fixtures

cat > e2e_tests/fixtures/seed_data.py << EOF
#!/usr/bin/env python
"""
Seed script for E2E test database
"""
import os
import sys
import time
import sqlite3
import json
import hashlib
import secrets

# Add project root to path to import application modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from models.database import Database
from utils.security import hash_password

# Test user data
TEST_USERS = [
    {
        "name": "Test User",
        "email": "test@example.com",
        "password": "Password123!",
        "verification_level": 1,
        "bio": "I am a test user for e2e testing"
    },
    {
        "name": "Family Member",
        "email": "family@example.com",
        "password": "Password123!",
        "verification_level": 2,
        "bio": "I am a family member for testing"
    },
    {
        "name": "Verifier",
        "email": "verifier@example.com",
        "password": "Password123!",
        "verification_level": 3,
        "bio": "I verify user identities"
    }
]

# Test DID data
TEST_DIDS = [
    {
        "user_email": "test@example.com",
        "identifier": "did:poh:test123",
        "document": json.dumps({
            "@context": "https://www.w3.org/ns/did/v1",
            "id": "did:poh:test123",
            "created": "2023-01-01T12:00:00Z",
            "updated": "2023-01-01T12:00:00Z",
            "verificationMethod": [
                {
                    "id": "did:poh:test123#keys-1",
                    "type": "Ed25519VerificationKey2018",
                    "controller": "did:poh:test123",
                    "publicKeyBase58": "test123publickey"
                }
            ],
            "authentication": ["did:poh:test123#keys-1"],
            "service": [
                {
                    "id": "did:poh:test123#profile",
                    "type": "ProofOfHumanityProfile",
                    "serviceEndpoint": "https://poh.io/profile/test123"
                }
            ]
        })
    }
]

def main():
    """Seed the test database with test data"""
    # Initialize database from environment variable
    db_uri = os.environ.get('DATABASE_URI', 'sqlite:///instance/test_poh.sqlite')
    db = Database(db_uri)
    
    # Add test users
    user_ids = {}
    now = int(time.time())
    
    for user in TEST_USERS:
        # Hash the password
        password_hash, salt = hash_password(user["password"])
        
        # Check if user already exists
        existing_user = db.query_one(
            "SELECT * FROM users WHERE email = ?",
            (user["email"],)
        )
        
        if existing_user:
            user_ids[user["email"]] = existing_user["id"]
            continue
        
        # Insert the user
        user_id = db.insert('users', {
            'name': user["name"],
            'email': user["email"],
            'password_hash': f"{password_hash}:{salt}",  # Store hash and salt
            'verification_level': user["verification_level"],
            'bio': user["bio"],
            'email_verified': True,
            'created_at': now,
            'updated_at': now
        })
        
        user_ids[user["email"]] = user_id
        print(f"Created test user: {user['email']} with ID {user_id}")
    
    # Add family relationships
    if 'test@example.com' in user_ids and 'family@example.com' in user_ids:
        test_user_id = user_ids['test@example.com']
        family_user_id = user_ids['family@example.com']
        
        # Check if relationship already exists
        existing_rel = db.query_one(
            "SELECT * FROM family_relationships WHERE user_id = ? AND relative_id = ?",
            (test_user_id, family_user_id)
        )
        
        if not existing_rel:
            # Insert relationship
            db.insert('family_relationships', {
                'user_id': test_user_id,
                'relative_id': family_user_id,
                'relationship_type': 'sibling',
                'verified': True,
                'created_at': now,
                'updated_at': now
            })
            
            # Insert inverse relationship
            db.insert('family_relationships', {
                'user_id': family_user_id,
                'relative_id': test_user_id,
                'relationship_type': 'sibling',
                'verified': True,
                'created_at': now,
                'updated_at': now
            })
            
            print(f"Created family relationship between {test_user_id} and {family_user_id}")
    
    # Add DIDs
    for did_data in TEST_DIDS:
        if did_data["user_email"] in user_ids:
            user_id = user_ids[did_data["user_email"]]
            
            # Check if DID already exists
            existing_did = db.query_one(
                "SELECT * FROM did_documents WHERE identifier = ?",
                (did_data["identifier"],)
            )
            
            if not existing_did:
                # Insert DID
                did_id = db.insert('did_documents', {
                    'user_id': user_id,
                    'identifier': did_data["identifier"],
                    'document': did_data["document"],
                    'created_at': now,
                    'updated_at': now
                })
                
                print(f"Created DID document with ID {did_id} for user {user_id}")
    
    print("Test data seeding completed successfully")

if __name__ == "__main__":
    main()
EOF

chmod +x e2e_tests/fixtures/seed_data.py
chmod +x setup_e2e_tests.sh

echo "Setup complete! Next steps:"
echo "1. Run 'npm install' to install dependencies"
echo "2. Run 'npx playwright install' to install browsers"
echo "3. Start writing your E2E tests in the e2e_tests directory"
echo ""
echo "Happy testing!" 